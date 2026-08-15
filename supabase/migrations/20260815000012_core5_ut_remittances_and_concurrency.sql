-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 5: UT Remittances, Multi-LIP Allocation, Concurrency & Void
-- ============================================================================

-- 1. ENSURE IDEMPOTENCY KEY COLUMN ON UT REMITTANCES
ALTER TABLE public.ut_remittances
ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ut_remittances_idempotency
ON public.ut_remittances (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. ENSURE VOID AUDIT COLUMNS ON UT REMITTANCES
ALTER TABLE public.ut_remittances
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

-- 3. ATOMIC STORED PROCEDURE FOR CREATING UT REMITTANCE WITH MULTI-LIP ITEMS
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
RETURNS UUID AS $$
DECLARE
    v_remittance_id UUID;
    v_rem_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
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
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record UT remittances';
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

    -- Validate Items array and SUM(items.amount) == p_amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := (v_item->>'lip_document_id')::UUID;
        v_reg_id := (v_item->>'registration_id')::UUID;

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
        RAISE EXCEPTION 'Remittance total amount (Rp %) must exactly match sum of allocated items (Rp %)',
            p_amount, v_sum_items;
    END IF;

    v_rem_number := public.generate_transaction_number();
    -- Replace prefix to UTR- if default returned PAY-
    IF v_rem_number LIKE 'PAY-%' THEN
        v_rem_number := 'UTR-' || SUBSTRING(v_rem_number FROM 5);
    END IF;

    -- Insert Remittance Header
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
        status,
        notes,
        received_by,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_rem_number,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_remittance_id;

    -- Insert Remittance Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.ut_remittance_items (
            remittance_id,
            registration_id,
            lip_document_id,
            amount,
            created_by
        ) VALUES (
            v_remittance_id,
            (v_item->>'registration_id')::UUID,
            (v_item->>'lip_document_id')::UUID,
            (v_item->>'amount')::BIGINT,
            v_actor_id
        );
    END LOOP;

    RETURN v_remittance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. ATOMIC STORED PROCEDURE FOR VERIFYING UT REMITTANCE WITH ROW LOCKING & CONCURRENCY PROTECTION
CREATE OR REPLACE FUNCTION public.verify_ut_remittance(
    p_remittance_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_new_verified_total BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_ut_remittance';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify UT remittances';
    END IF;

    -- Lock remittance header
    SELECT status INTO v_status
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'UT Remittance not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending remittances can be verified';
    END IF;

    -- Lock LIP records & re-verify concurrency over-remittance protection
    FOR v_item IN 
        SELECT ri.lip_document_id, ri.amount 
        FROM public.ut_remittance_items ri 
        WHERE ri.remittance_id = p_remittance_id
    LOOP
        -- Lock target LIP row
        SELECT official_amount INTO v_lip_official
        FROM public.lip_documents
        WHERE id = v_item.lip_document_id
        FOR UPDATE;

        -- Re-calculate verified UT paid within transaction
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_item.lip_document_id
          AND r.status = 'verified'
          AND r.id <> p_remittance_id;

        v_new_verified_total := v_already_verified + v_item.amount;

        IF v_new_verified_total > v_lip_official THEN
            RAISE EXCEPTION 'Over-remittance protection: Concurrent verification caused total setoran (Rp %) to exceed LIP official amount (Rp %)',
                v_new_verified_total, v_lip_official;
        END IF;

        -- Update LIP status to paid_to_ut if fully paid to UT
        IF v_new_verified_total >= v_lip_official THEN
            UPDATE public.lip_documents
            SET status = 'paid_to_ut',
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_item.lip_document_id;
        END IF;
    END LOOP;

    -- Update Remittance Header
    UPDATE public.ut_remittances
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. ATOMIC STORED PROCEDURE FOR OWNER APPROVAL OF REMITTANCE VOID
CREATE OR REPLACE FUNCTION public.approve_ut_remittance_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_remittance_id UUID;
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_ut_remittance_void_request';
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve UT remittance void requests';
    END IF;

    SELECT remittance_id, status INTO v_remittance_id, v_req_status
    FROM public.ut_remittance_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.ut_remittance_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.ut_remittances
        SET status = 'voided',
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = p_review_notes,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_remittance_id;

        -- Re-evaluate target LIP statuses
        FOR v_item IN 
            SELECT ri.lip_document_id 
            FROM public.ut_remittance_items ri 
            WHERE ri.remittance_id = v_remittance_id
        LOOP
            SELECT official_amount INTO v_lip_official
            FROM public.lip_documents
            WHERE id = v_item.lip_document_id;

            SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
            FROM public.ut_remittance_items ri
            JOIN public.ut_remittances r ON ri.remittance_id = r.id
            WHERE ri.lip_document_id = v_item.lip_document_id
              AND r.status = 'verified';

            IF v_already_verified < v_lip_official THEN
                UPDATE public.lip_documents
                SET status = 'verified',
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_item.lip_document_id AND status = 'paid_to_ut';
            END IF;
        END LOOP;
    ELSE
        UPDATE public.ut_remittance_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. PRIVATE STORAGE BUCKET (ut-remittance-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ut-remittance-proofs', 'ut-remittance-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view ut remittance proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ut-remittance-proofs');
DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload ut remittance proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
DROP POLICY IF EXISTS "Owner/FinanceAdmin can update ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update ut remittance proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
