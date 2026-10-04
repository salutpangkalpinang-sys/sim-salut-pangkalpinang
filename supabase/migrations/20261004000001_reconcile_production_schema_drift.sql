BEGIN;

-- ============================================================================
-- Migration: 20261004000001_reconcile_production_schema_drift.sql
-- Description:
--   1. Ensure public.delete_student_cascade RPC exists with SECURITY DEFINER
--      and strict search_path, supporting atomic student deletion.
--   2. Ensure public.verify_lip_document RPC exists with SECURITY DEFINER
--      and strict search_path, supporting atomic LIP document verification.
--   3. Safely drop public.delete_student_by_name RPC (unused, dangerous fuzzy delete).
--   4. Standardize public.cash_accounts RLS read policy (Authenticated users can view cash_accounts).
--   5. Synchronize reset_student_transactions RPC body across environments.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP UNUSED & RISKY RPC: delete_student_by_name
-- ----------------------------------------------------------------------------
-- The application does not use fuzzy name-based bulk student deletion.
-- Safely drop this helper using RESTRICT to ensure parity across all environments.
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
-- 2. RECONCILE RPC: reset_student_transactions
-- ----------------------------------------------------------------------------
-- Ensures child void requests, payment allocations, and lip items are cleaned
-- up atomically before registration and student deletion.
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

REVOKE ALL ON FUNCTION public.reset_student_transactions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_transactions(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. RECONCILE RPC: delete_student_cascade
-- ----------------------------------------------------------------------------
-- Required by deleteStudentAction (src/features/students/actions.ts).
-- Atomically resets student transactions, status history, and student row.
CREATE OR REPLACE FUNCTION public.delete_student_cascade(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
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
-- 4. RECONCILE RPC: verify_lip_document
-- ----------------------------------------------------------------------------
-- Required by verifyLIPDocument (src/features/lip-invoices/actions.ts).
-- Atomically marks old verified LIP documents as superseded and sets target to verified.
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
    v_registration_id UUID;
    v_lip_number VARCHAR;
    v_actor_id UUID;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_user_id);
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated request to verify_lip_document.');
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
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lip_document(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_lip_document(UUID, UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. RECONCILE RLS POLICY: public.cash_accounts
-- ----------------------------------------------------------------------------
-- Standardizes read access across environments so authenticated users can view
-- master cash account references (names/codes) for transaction forms and receipts.
DROP POLICY IF EXISTS "Authenticated users can view cash_accounts" ON public.cash_accounts;

CREATE POLICY "Authenticated users can view cash_accounts"
    ON public.cash_accounts
    FOR SELECT
    TO authenticated
    USING (true);


-- ----------------------------------------------------------------------------
-- 6. RECONCILE RPC: create_ut_remittance_with_items
-- ----------------------------------------------------------------------------
-- Synchronizes robust JSONB parsing (supporting both camelCase and snake_case keys,
-- as well as stringified JSONB scalars) and strict search_path across all environments.
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
    v_remittance_id UUID;
    v_items_array JSONB;
    v_item JSONB;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Insert Remittance Header
    INSERT INTO public.ut_remittances (
        idempotency_key,
        paid_at,
        amount,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        created_by,
        status
    ) VALUES (
        p_idempotency_key,
        p_paid_at,
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        p_notes,
        v_actor_id,
        'unverified'
    ) RETURNING id INTO v_remittance_id;

    -- Parse JSONB payload safely
    IF jsonb_typeof(p_items) = 'string' THEN
        v_items_array := (p_items #>> '{}')::JSONB;
    ELSE
        v_items_array := p_items;
    END IF;

    IF jsonb_typeof(v_items_array) <> 'array' THEN
        RAISE EXCEPTION 'p_items must be a JSON array';
    END IF;

    -- Insert Remittance Items
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

COMMIT;
