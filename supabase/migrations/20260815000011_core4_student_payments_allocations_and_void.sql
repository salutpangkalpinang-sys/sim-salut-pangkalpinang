-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 4: Student Payments, Allocations, Idempotency & Void Requests
-- ============================================================================

-- 1. ENSURE IDEMPOTENCY KEY COLUMN ON STUDENT PAYMENTS
ALTER TABLE public.student_payments
ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_payments_idempotency
ON public.student_payments (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. ENSURE VOID AUDIT COLUMNS ON STUDENT PAYMENTS
ALTER TABLE public.student_payments
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

-- 3. INVOICE FINANCIAL LOCK TRIGGER (Prevents item mutations after verified payments)
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

-- 4. IDEMPOTENT & ATOMIC STORED PROCEDURE FOR CREATING STUDENT PAYMENT WITH ALLOCATION
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
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Idempotency check: if idempotency key exists, return existing payment ID
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.student_payments
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate target invoice status and student ownership
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
        idempotency_key,
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
        p_idempotency_key,
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

-- 5. STORED PROCEDURE FOR OWNER APPROVAL OF VOID REQUEST
CREATE OR REPLACE FUNCTION public.approve_payment_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_payment_id UUID;
    v_req_status VARCHAR(20);
    v_void_reason TEXT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_payment_void_request';
    END IF;

    SELECT payment_id, status, reason INTO v_payment_id, v_req_status, v_void_reason
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
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = v_void_reason,
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

-- 6. PRIVATE STORAGE BUCKET SETUP FOR PAYMENT PROOFS
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view payment proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs');
DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload payment proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
DROP POLICY IF EXISTS "Owner/FinanceAdmin can update payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update payment proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
