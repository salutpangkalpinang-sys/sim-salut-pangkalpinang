BEGIN;

-- ============================================================================
-- Migration: 20261004000001_reconcile_production_schema_drift.sql
-- Description:
--   1. Reconcile delete_student_cascade RPC with strict internal DB-level RBAC
--      (owner, admin, academic_admin) & active profile guard.
--   2. Reconcile verify_lip_document RPC with strict internal DB-level RBAC
--      (owner, admin, academic_admin), active profile guard, and anti-spoofing
--      (p_user_id must match auth.uid() for authenticated callers).
--   3. Reconcile create_ut_remittance_with_items RPC with strict internal DB-level RBAC
--      (owner, admin, finance_admin), active profile guard, anti-spoofing
--      (p_created_by must match auth.uid()), and robust JSONB array/string parsing.
--   4. Reconcile reset_student_transactions RPC: revoke EXECUTE from PUBLIC, anon,
--      and authenticated. Only executable internally by cascade RPC or service_role.
--   5. Reconcile reset_all_system_data, reset_all_system_transactions, and update_cash_account:
--      revoke EXECUTE from PUBLIC and anon, enforce strict RBAC guard on update_cash_account,
--      and restrict reset procedures to owner and service_role.
--   6. Standardize public.cash_accounts RLS read policy (Authenticated users can view cash_accounts).
--   7. Safely drop public.delete_student_by_name RPC (unused, dangerous fuzzy delete).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP UNUSED & RISKY RPC: delete_student_by_name
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'delete_student_by_name'
    ) THEN
        REVOKE ALL ON FUNCTION public.delete_student_by_name(TEXT) FROM PUBLIC, anon, authenticated, service_role;
        DROP FUNCTION public.delete_student_by_name(TEXT) RESTRICT;
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. RECONCILE RPC: reset_student_transactions (INTERNAL ONLY)
-- ----------------------------------------------------------------------------
-- Cleans up child void requests, payment allocations, payments, invoices, and
-- lip documents before registration/student deletion.
-- REVOKED from PUBLIC, anon, AND authenticated to prevent direct arbitrary wipes.
CREATE OR REPLACE FUNCTION public.reset_student_transactions(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reg_ids UUID[];
    v_pay_ids UUID[];
    v_inv_ids UUID[];
    v_lip_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(id) INTO v_reg_ids FROM public.registrations WHERE student_id = p_student_id;

    IF v_reg_ids IS NOT NULL AND array_length(v_reg_ids, 1) > 0 THEN
        SELECT ARRAY_AGG(id) INTO v_lip_ids FROM public.lip_documents WHERE registration_id = ANY(v_reg_ids);
        IF v_lip_ids IS NOT NULL AND array_length(v_lip_ids, 1) > 0 THEN
            DELETE FROM public.ut_remittance_items WHERE lip_document_id = ANY(v_lip_ids);
        END IF;

        SELECT ARRAY_AGG(id) INTO v_pay_ids FROM public.student_payments WHERE registration_id = ANY(v_reg_ids);
        IF v_pay_ids IS NOT NULL AND array_length(v_pay_ids, 1) > 0 THEN
            DELETE FROM public.payment_allocations WHERE payment_id = ANY(v_pay_ids);
            DELETE FROM public.payment_void_requests WHERE payment_id = ANY(v_pay_ids);
            DELETE FROM public.student_payments WHERE id = ANY(v_pay_ids);
        END IF;

        SELECT ARRAY_AGG(id) INTO v_inv_ids FROM public.invoices WHERE registration_id = ANY(v_reg_ids);
        IF v_inv_ids IS NOT NULL AND array_length(v_inv_ids, 1) > 0 THEN
            DELETE FROM public.invoice_items WHERE invoice_id = ANY(v_inv_ids);
            DELETE FROM public.invoices WHERE id = ANY(v_inv_ids);
        END IF;

        DELETE FROM public.lip_documents WHERE registration_id = ANY(v_reg_ids);
        DELETE FROM public.registration_fee_snapshots WHERE registration_id = ANY(v_reg_ids);
        DELETE FROM public.registrations WHERE id = ANY(v_reg_ids);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Explicitly revoke from authenticated users:
REVOKE ALL ON FUNCTION public.reset_student_transactions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_student_transactions(UUID) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. RECONCILE RPC: delete_student_cascade (STRICT RBAC & ACTIVE PROFILE)
-- ----------------------------------------------------------------------------
-- Required by deleteStudentAction.
-- Atomically resets student transactions, status history, and student row.
-- Enforces: auth.uid() present, active profile, and role IN ('owner', 'admin', 'academic_admin').
CREATE OR REPLACE FUNCTION public.delete_student_cascade(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_is_active BOOLEAN;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to delete_student_cascade'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller profile is active
    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'User profile is inactive or not found'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller has authorized role
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner, Admin, and Academic Admin can cascade delete student'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1. Reset all transactions first
    PERFORM public.reset_student_transactions(p_student_id);

    -- 2. Delete Student Status History & Student row
    DELETE FROM public.student_status_history WHERE student_id = p_student_id;
    DELETE FROM public.students WHERE id = p_student_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_student_cascade(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_cascade(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. RECONCILE RPC: verify_lip_document (STRICT RBAC & ANTI-SPOOFING)
-- ----------------------------------------------------------------------------
-- Required by verifyLIPDocument.
-- Atomically marks old verified LIP documents as superseded and sets target to verified.
-- Enforces: auth.uid() present, anti-spoofing (p_user_id = auth.uid()),
-- active profile, and role IN ('owner', 'admin', 'academic_admin').
CREATE OR REPLACE FUNCTION public.verify_lip_document(
    p_lip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_is_active BOOLEAN;
    v_registration_id UUID;
    v_lip_number VARCHAR;
BEGIN
    v_actor_id := auth.uid();

    -- Anti-spoofing: For authenticated callers, p_user_id MUST match auth.uid()
    IF v_actor_id IS NOT NULL THEN
        IF p_user_id IS NOT NULL AND p_user_id <> v_actor_id THEN
            RAISE EXCEPTION 'Identity mismatch: p_user_id does not match authenticated identity'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSE
        -- Fallback for service_role / background jobs
        v_actor_id := p_user_id;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_lip_document'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify active profile
    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'User profile is inactive or not found'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller role
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner, Admin, and Academic Admin can verify LIP documents'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1. Fetch target LIP details
    SELECT registration_id, lip_number
    INTO v_registration_id, v_lip_number
    FROM public.lip_documents
    WHERE id = p_lip_id;

    IF v_registration_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dokumen LIP tidak ditemukan.');
    END IF;

    -- 2. Mark any existing verified LIP for the same registration as 'superseded'
    UPDATE public.lip_documents
    SET status = 'superseded',
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE registration_id = v_registration_id
      AND status = 'verified'
      AND id <> p_lip_id;

    -- 3. Mark target LIP as 'verified'
    UPDATE public.lip_documents
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_lip_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lip_document(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_lip_document(UUID, UUID) TO authenticated, service_role;


-- Reconcile trigger function check_lip_status_consistency to prevent session search_path leakage
CREATE OR REPLACE FUNCTION public.check_lip_status_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_already_verified BIGINT;
BEGIN
    IF NEW.status = 'paid_to_ut' AND (OLD.status IS NULL OR OLD.status <> 'paid_to_ut') THEN
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = NEW.id
          AND r.status = 'verified';

        IF v_already_verified < NEW.official_amount THEN
            RAISE EXCEPTION 'Consistency error: Cannot manually set LIP status to paid_to_ut without sufficient verified UT remittances (Paid: Rp %, Official: Rp %)',
                v_already_verified, NEW.official_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 5. RECONCILE RPC: create_ut_remittance_with_items (STRICT RBAC & ANTI-SPOOFING)
-- ----------------------------------------------------------------------------
-- Enforces: auth.uid() present, anti-spoofing (p_created_by = auth.uid()),
-- active profile, role IN ('owner', 'admin', 'finance_admin'), and robust JSONB.
CREATE OR REPLACE FUNCTION public.create_ut_remittance_with_items(
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID,
    p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_is_active BOOLEAN;
    v_remittance_id UUID;
    v_rem_number VARCHAR(50);
    v_items_array JSONB;
    v_item JSONB;
    v_sum_items BIGINT := 0;
    v_existing_id UUID;
    v_lip_status VARCHAR(30);
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_outstanding BIGINT;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    v_actor_id := auth.uid();

    -- Anti-spoofing: For authenticated callers, p_created_by MUST match auth.uid()
    IF v_actor_id IS NOT NULL THEN
        IF p_created_by IS NOT NULL AND p_created_by <> v_actor_id THEN
            RAISE EXCEPTION 'Identity mismatch: p_created_by does not match authenticated identity'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSE
        -- Fallback for service_role / background jobs
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify active profile
    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'User profile is inactive or not found'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Strict RBAC check (Owner, Admin, and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner, Admin, and Finance Admin can record UT remittances'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Idempotency Check: Return existing remittance ID if idempotency_key matches
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.ut_remittances
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Handle scalar JSON string vs JSON array defensive conversion
    IF jsonb_typeof(p_items) = 'string' THEN
        v_items_array := (p_items #>> '{}')::JSONB;
    ELSE
        v_items_array := p_items;
    END IF;

    IF jsonb_typeof(v_items_array) <> 'array' THEN
        RAISE EXCEPTION 'p_items must be a JSON array';
    END IF;

    -- Validate Items array and SUM(items.amount) == p_amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := COALESCE(v_item->>'lip_document_id', v_item->>'lipDocumentId')::UUID;
        v_reg_id := COALESCE(v_item->>'registration_id', v_item->>'registrationId')::UUID;

        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Item allocation amount must be greater than 0';
        END IF;

        -- Validate LIP document status & official amount
        SELECT status, official_amount INTO v_lip_status, v_lip_official
        FROM public.lip_documents
        WHERE id = v_lip_id AND registration_id = v_reg_id;

        IF v_lip_status IS NULL THEN
            RAISE EXCEPTION 'Target LIP document not found or registration mismatch';
        END IF;

        IF v_lip_status = 'cancelled' THEN
            RAISE EXCEPTION 'Cannot allocate remittance to a cancelled LIP document';
        END IF;

        -- Check current outstanding liability for LIP
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_lip_id
          AND r.status = 'verified';

        v_outstanding := v_lip_official - v_already_verified;

        IF v_item_amount > v_outstanding THEN
            RAISE EXCEPTION 'Over-remittance error: Allocation amount (Rp %) exceeds current outstanding UT liability (Rp %) for LIP',
                v_item_amount, v_outstanding;
        END IF;

        v_sum_items := v_sum_items + v_item_amount;
    END LOOP;

    IF v_sum_items <> p_amount THEN
        RAISE EXCEPTION 'Total remittance amount (Rp %) does not match total item allocations (Rp %)',
            p_amount, v_sum_items;
    END IF;

    -- Generate Remittance Number atomically
    v_rem_number := public.generate_remittance_number();

    -- Insert Header record
    INSERT INTO public.ut_remittances (
        remittance_number,
        paid_at,
        amount,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        status,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_rem_number,
        p_paid_at,
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        p_notes,
        'pending_verification',
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_remittance_id;

    -- Insert Item Detail records
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := COALESCE(v_item->>'lip_document_id', v_item->>'lipDocumentId')::UUID;
        v_reg_id := COALESCE(v_item->>'registration_id', v_item->>'registrationId')::UUID;

        INSERT INTO public.ut_remittance_items (
            remittance_id,
            lip_document_id,
            registration_id,
            amount
        ) VALUES (
            v_remittance_id,
            v_lip_id,
            v_reg_id,
            v_item_amount
        );
    END LOOP;

    RETURN v_remittance_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, JSONB) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6. RECONCILE RPC: update_cash_account (STRICT RBAC GUARD & SEARCH_PATH)
-- ----------------------------------------------------------------------------
-- Enforces: auth.uid() present, active profile, and role IN ('owner', 'admin', 'finance_admin', 'academic_admin').
CREATE OR REPLACE FUNCTION public.update_cash_account(
    p_id UUID,
    p_name VARCHAR,
    p_account_number VARCHAR DEFAULT NULL,
    p_bank_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_is_active BOOLEAN;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to update_cash_account'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'User profile is inactive or not found'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin', 'finance_admin', 'academic_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner, Admin, Finance Admin, and Academic Admin can manage cash accounts'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    UPDATE public.cash_accounts
    SET name = TRIM(p_name),
        account_number = NULLIF(TRIM(p_account_number), ''),
        bank_name = NULLIF(TRIM(p_bank_name), ''),
        updated_at = NOW()
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rekening tidak ditemukan.');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_cash_account(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_cash_account(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. RECONCILE SYSTEM RESET PROCEDURES (REVOKE EXECUTE FROM PUBLIC/ANON/AUTH)
-- ----------------------------------------------------------------------------
-- Protect destructive system-wide wipe procedures.
-- Only executable by Owner and service_role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_all_system_data' AND pronamespace = 'public'::regnamespace) THEN
        REVOKE ALL ON FUNCTION public.reset_all_system_data() FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.reset_all_system_data() TO service_role;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_all_system_transactions' AND pronamespace = 'public'::regnamespace) THEN
        REVOKE ALL ON FUNCTION public.reset_all_system_transactions() FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.reset_all_system_transactions() TO service_role;
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 8. RECONCILE RLS POLICY: public.cash_accounts
-- ----------------------------------------------------------------------------
-- Standardizes read access across environments so authenticated users can view
-- master cash account references (names/codes) for transaction forms and receipts.
DROP POLICY IF EXISTS "Authenticated users can view cash_accounts" ON public.cash_accounts;

CREATE POLICY "Authenticated users can view cash_accounts"
    ON public.cash_accounts
    FOR SELECT
    TO authenticated
    USING (true);

COMMIT;
