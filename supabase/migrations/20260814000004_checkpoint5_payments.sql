-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 5: Security Preflight, Student Payments, Allocations, Void & Receipts
-- ============================================================================

-- 1. PREFLIGHT SECURITY PATCH ON RPC FUNCTIONS (Enforcing auth.uid() requirement)
CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_study_program_id UUID,
    p_service_scheme_id UUID,
    p_credits INTEGER,
    p_notes TEXT,
    p_created_by UUID,
    p_fee_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_registration_with_snapshots: auth.uid() is required';
    END IF;

    v_reg_number := public.generate_registration_number();

    INSERT INTO public.registrations (
        registration_number,
        student_id,
        academic_period_id,
        registration_type_id,
        study_program_id,
        service_scheme_id,
        credits,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_reg_number,
        p_student_id,
        p_academic_period_id,
        p_registration_type_id,
        p_study_program_id,
        p_service_scheme_id,
        p_credits,
        'active',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_registration_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fee_items)
    LOOP
        INSERT INTO public.registration_fee_snapshots (
            registration_id,
            source_fee_rate_id,
            fee_type_id,
            fee_name_snapshot,
            calculation_type,
            quantity,
            unit_amount,
            total_amount,
            source_snapshot,
            notes
        ) VALUES (
            v_registration_id,
            (v_item->>'source_fee_rate_id')::UUID,
            (v_item->>'fee_type_id')::UUID,
            (v_item->>'fee_name_snapshot')::VARCHAR,
            (v_item->>'calculation_type')::VARCHAR,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_amount')::BIGINT,
            (v_item->>'quantity')::INTEGER * (v_item->>'unit_amount')::BIGINT,
            COALESCE(v_item->>'source_snapshot', 'Master Rate Snapshot'),
            v_item->>'notes'
        );
    END LOOP;

    RETURN v_registration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. TRANSACTION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.transaction_number_seq');
    RETURN 'PAY-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 3. STUDENT PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.student_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_transaction_number(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON public.student_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.student_payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_txn ON public.student_payments (transaction_number);


-- 4. PAYMENT ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.student_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON public.payment_allocations (invoice_id);


-- 5. PAYMENT VOID REQUESTS TABLE (Owner Approval Workflow)
CREATE TABLE IF NOT EXISTS public.payment_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.student_payments(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_void_requests_payment ON public.payment_void_requests (payment_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_status ON public.payment_void_requests (status);


-- 6. INVOICE FINANCIAL LOCK TRIGGER
CREATE OR REPLACE FUNCTION public.check_invoice_locked_before_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_verified_count INTEGER;
    v_inv_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COUNT(*) INTO v_verified_count
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = v_inv_id
      AND sp.status = 'verified';

    IF v_verified_count > 0 THEN
        RAISE EXCEPTION 'Financial structure locked: Invoice has verified student payments and items cannot be modified';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_invoice_item_lock ON public.invoice_items;
CREATE TRIGGER trg_invoice_item_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_locked_before_item_mutation();


-- 7. ATOMIC STORED PROCEDURE FOR CREATING STUDENT PAYMENT + ALLOCATION
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
    p_allocated_amount BIGINT
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
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


-- 8. STORED PROCEDURE FOR PAYMENT VERIFICATION
CREATE OR REPLACE FUNCTION public.verify_student_payment(
    p_payment_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_verifier_id;
    END IF;

    -- Lock payment row for verification
    SELECT status INTO v_status
    FROM public.student_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending payments can be verified';
    END IF;

    UPDATE public.student_payments
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_payment_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 9. STORED PROCEDURE FOR OWNER APPROVAL OF VOID REQUEST
CREATE OR REPLACE FUNCTION public.approve_payment_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR, -- 'approve' or 'reject'
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_payment_id UUID;
    v_req_status VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_reviewer_id;
    END IF;

    SELECT payment_id, status INTO v_payment_id, v_req_status
    FROM public.payment_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.payment_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.student_payments
        SET status = 'voided',
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_payment_id;
    ELSE
        UPDATE public.payment_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_void_requests ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
CREATE POLICY "Authenticated users can view student_payments" ON public.student_payments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view payment_allocations" ON public.payment_allocations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view payment_void_requests" ON public.payment_void_requests
    FOR SELECT TO authenticated USING (true);

-- Write policies (Owner and Academic Admin/Finance can insert/update payments)
CREATE POLICY "Owner/AcademicAdmin can insert student_payments" ON public.student_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner/AcademicAdmin can update student_payments" ON public.student_payments
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner/AcademicAdmin can insert payment_allocations" ON public.payment_allocations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner/AcademicAdmin can insert payment_void_requests" ON public.payment_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner can update payment_void_requests" ON public.payment_void_requests
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'owner');


-- 11. SUPABASE STORAGE BUCKET SETUP (Private Bucket: payment-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Objects RLS Policies
CREATE POLICY "Authenticated users can view payment proof storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'payment-proofs');

CREATE POLICY "Owner/AcademicAdmin can upload payment proof storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner/AcademicAdmin can update payment proof storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
