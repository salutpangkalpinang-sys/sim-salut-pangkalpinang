-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 6: Preflight Hardening, UT Remittances, Allocations, Void & Storage
-- ============================================================================

-- 1. HARDENING CHECKPOINT 5: Add idempotency_key to student_payments
ALTER TABLE public.student_payments 
ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE NULL;

-- Hardening RLS Policies for student_payments & payment_allocations (Academic Admin Read-Only)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert student_payments" ON public.student_payments;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update student_payments" ON public.student_payments;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_void_requests" ON public.payment_void_requests;

CREATE POLICY "Owner/FinanceAdmin can insert student_payments" ON public.student_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can update student_payments" ON public.student_payments
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can insert payment_allocations" ON public.payment_allocations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can insert payment_void_requests" ON public.payment_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));


-- Update RPC create_payment_with_allocation with Idempotency & RBAC Fix
CREATE OR REPLACE FUNCTION public.create_payment_with_allocation(
    p_student_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_payment_method_id UUID,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_invoice_id UUID,
    p_allocated_amount BIGINT,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record student payments';
    END IF;

    -- Idempotency Check: Return existing payment ID if idempotency_key matches
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.student_payments
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate invoice student relation & status
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'Target invoice not found';
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot allocate payment to a cancelled invoice';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student mismatch: Invoice does not belong to the selected student';
    END IF;

    IF p_allocated_amount > p_amount THEN
        RAISE EXCEPTION 'Allocated amount cannot exceed total payment amount';
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- Insert Payment Header
    INSERT INTO public.student_payments (
        transaction_number,
        student_id,
        paid_at,
        amount,
        payment_method_id,
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
        v_txn_number,
        p_student_id,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_payment_method_id,
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
    ) RETURNING id INTO v_payment_id;

    -- Insert Payment Allocation
    INSERT INTO public.payment_allocations (
        payment_id,
        invoice_id,
        amount,
        created_by
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        p_allocated_amount,
        v_actor_id
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. UT REMITTANCE SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.remittance_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_remittance_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.remittance_number_seq');
    RETURN 'UTR-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 3. UT REMITTANCES TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_remittance_number(),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key UUID UNIQUE NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    void_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_remittances_status ON public.ut_remittances (status);
CREATE INDEX IF NOT EXISTS idx_remittances_num ON public.ut_remittances (remittance_number);


-- 4. UT REMITTANCE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittance_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_id UUID NOT NULL REFERENCES public.ut_remittances(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_remittance_items_parent ON public.ut_remittance_items (remittance_id);
CREATE INDEX IF NOT EXISTS idx_remittance_items_lip ON public.ut_remittance_items (lip_document_id);


-- 5. UT REMITTANCE VOID REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittance_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_id UUID NOT NULL REFERENCES public.ut_remittances(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remittance_void_parent ON public.ut_remittance_void_requests (remittance_id);


-- 6. ATOMIC STORED PROCEDURE FOR CREATING UT REMITTANCE WITH ITEMS
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
    v_lip_status VARCHAR(20);
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_outstanding BIGINT;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record UT remittances';
    END IF;

    -- Idempotency check
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

    v_rem_number := public.generate_remittance_number();

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


-- 7. ATOMIC STORED PROCEDURE FOR VERIFYING UT REMITTANCE WITH ROW LOCKING
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

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_verifier_id;
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


-- 8. ATOMIC STORED PROCEDURE FOR OWNER APPROVAL OF REMITTANCE VOID
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

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_reviewer_id;
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


-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.ut_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_remittance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_remittance_void_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ut_remittances" ON public.ut_remittances
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view ut_remittance_items" ON public.ut_remittance_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner/FinanceAdmin can insert ut_remittances" ON public.ut_remittances
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can update ut_remittances" ON public.ut_remittances
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can insert ut_remittance_items" ON public.ut_remittance_items
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can insert ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner can update ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'owner');


-- 10. SUPABASE PRIVATE STORAGE BUCKET (ut-remittance-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ut-remittance-proofs', 'ut-remittance-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Authenticated users can view ut remittance proof storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ut-remittance-proofs');

CREATE POLICY "Owner/FinanceAdmin can upload ut remittance proof storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));

CREATE POLICY "Owner/FinanceAdmin can update ut remittance proof storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
