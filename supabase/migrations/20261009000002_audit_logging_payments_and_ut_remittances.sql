-- Migration: 20261009000002_audit_logging_payments_and_ut_remittances.sql
-- Description: Implement atomic audit logging for student payments and UT remittances lifecycles.
-- Covers:
--   1. student_payments: create, verify, reject
--   2. payment_void_requests: request, approve, reject
--   3. ut_remittances: create, verify, reject
--   4. ut_remittance_void_requests: request, approve, reject
-- All state mutations and corresponding audit logs run within the exact same database transaction.

-- ============================================================================
-- 1. RPC: create_payment_with_allocation (Hardened with Atomic Audit Logging)
-- ============================================================================
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
    p_invoice_id UUID,
    p_allocated_amount BIGINT,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_existing_id UUID;
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_inv_status VARCHAR(20);
    v_inv_student_id UUID;
    v_total_billed BIGINT;
    v_verified_paid BIGINT;
    v_pending_reserved BIGINT;
    v_remaining_payable BIGINT;
    v_method_name VARCHAR(100);
    v_account_name VARCHAR(100);
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak berwenang mencatat pembayaran mahasiswa.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- Strict Idempotency Requirement
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED: Parameter idempotency_key wajib disertakan.';
    END IF;

    -- Return existing record without producing duplicate audit log on idempotent retry
    SELECT id INTO v_existing_id FROM public.student_payments WHERE idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    -- SINGLE-INVOICE DIRECT MATCH: p_amount WAJIB sama dengan p_allocated_amount
    IF p_amount <> p_allocated_amount THEN
        RAISE EXCEPTION 'ALLOCATION_MISMATCH: Nominal pembayaran (Rp %) harus sama persis dengan nominal alokasi tagihan (Rp %).',
            p_amount, p_allocated_amount;
    END IF;

    -- Validate payment method and cash account pairing explicitly
    PERFORM public.validate_payment_method_cash_account_pairing(
        p_payment_method_id,
        p_cash_account_id
    );

    -- ROW LOCK TARGET INVOICE
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id FOR UPDATE;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: Tagihan invoice dengan ID % tidak ditemukan.', p_invoice_id;
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'INVOICE_CANCELLED: Tidak dapat mengalokasikan pembayaran ke invoice yang telah dibatalkan.';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'STUDENT_MISMATCH: Invoice yang dipilih bukan milik mahasiswa yang bersangkutan.';
    END IF;

    -- CANONICAL BILLED TOTAL
    SELECT total_billed INTO v_total_billed FROM public.get_invoice_canonical_totals(p_invoice_id);

    -- CALCULATE VERIFIED & PENDING RESERVATION
    SELECT 
        COALESCE(SUM(CASE WHEN sp.status = 'verified' THEN pa.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN sp.status = 'pending_verification' THEN pa.amount ELSE 0 END), 0)
    INTO v_verified_paid, v_pending_reserved
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = p_invoice_id;

    v_remaining_payable := GREATEST(0, v_total_billed - (v_verified_paid + v_pending_reserved));

    IF p_allocated_amount > v_remaining_payable THEN
        RAISE EXCEPTION 'CAPACITY_EXCEEDED: Alokasi pembayaran (Rp %) melebihi sisa kapasitas yang dapat dibayar (Rp % termasuk reservasi pending).',
            p_allocated_amount, v_remaining_payable;
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- INSERT PAYMENT (pending_verification automatically acts as reservation)
    INSERT INTO public.student_payments (
        transaction_number, student_id, paid_at, amount, payment_method_id,
        cash_account_id, reference_number, proof_storage_path, original_file_name,
        mime_type, file_size, status, notes, idempotency_key, received_by, created_by, updated_by
    ) VALUES (
        v_txn_number, p_student_id, COALESCE(p_paid_at, NOW()), p_amount,
        p_payment_method_id, p_cash_account_id, p_reference_number, p_proof_storage_path,
        p_original_file_name, p_mime_type, p_file_size, 'pending_verification', p_notes,
        p_idempotency_key, v_actor_id, v_actor_id, v_actor_id
    ) RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_allocations (payment_id, invoice_id, amount, created_by)
    VALUES (v_payment_id, p_invoice_id, p_allocated_amount, v_actor_id);

    -- Lookup descriptive names for audit log
    SELECT name INTO v_method_name FROM public.payment_methods WHERE id = p_payment_method_id;
    SELECT name INTO v_account_name FROM public.cash_accounts WHERE id = p_cash_account_id;

    -- ATOMIC AUDIT LOG INSERTION
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'payment_created',
        'student_payments',
        v_payment_id,
        NULL,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'transaction_number', v_txn_number,
            'student_id', p_student_id,
            'amount', p_amount,
            'status', 'pending_verification',
            'payment_method_id', p_payment_method_id,
            'cash_account_id', p_cash_account_id,
            'invoice_id', p_invoice_id,
            'allocated_amount', p_allocated_amount
        ),
        'Pencatatan pembayaran mahasiswa no. ' || v_txn_number || ' sebesar Rp ' || p_amount::text,
        jsonb_build_object(
            'transaction_number', v_txn_number,
            'payment_method_name', v_method_name,
            'cash_account_name', v_account_name,
            'reference_number', p_reference_number,
            'idempotency_key', p_idempotency_key
        ),
        NOW()
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) TO authenticated, service_role;


-- ============================================================================
-- 2. RPC: verify_student_payment (Hardened with Atomic Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_student_payment(p_payment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_payment_status VARCHAR(30);
    v_payment_amount BIGINT;
    v_txn_number VARCHAR(50);
    v_student_id UUID;
    v_invoice_id UUID;
    v_allocated_amount BIGINT;
    v_funds_left BIGINT;
    v_item RECORD;
    v_item_already_paid BIGINT;
    v_item_unpaid BIGINT;
    v_allocation_slice BIGINT;
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin memverifikasi pembayaran.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- 1. LOCK PAYMENT
    SELECT status, amount, transaction_number, student_id
    INTO v_payment_status, v_payment_amount, v_txn_number, v_student_id
    FROM public.student_payments WHERE id = p_payment_id FOR UPDATE;

    IF v_payment_status IS NULL THEN RAISE EXCEPTION 'Payment tidak ditemukan'; END IF;
    -- Idempotent exit: do not emit duplicate audit log
    IF v_payment_status = 'verified' THEN RETURN TRUE; END IF;
    IF v_payment_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya pembayaran berstatus pending yang dapat diverifikasi (Status saat ini: %).', v_payment_status;
    END IF;

    -- 2. DUAL-LOCK INVOICE
    SELECT pa.invoice_id, pa.amount INTO v_invoice_id, v_allocated_amount
    FROM public.payment_allocations pa
    JOIN public.invoices i ON pa.invoice_id = i.id
    WHERE pa.payment_id = p_payment_id
    FOR UPDATE OF i;

    v_funds_left := v_allocated_amount;

    -- 3. COMPONENT ALLOCATION WATERFALL (Strict priority: service_fee -> ut_liability -> internal_fee)
    FOR v_item IN 
        SELECT id, item_type, amount
        FROM public.invoice_items
        WHERE invoice_id = v_invoice_id AND item_type IN ('service_fee', 'ut_liability', 'internal_fee')
        ORDER BY 
            CASE 
                WHEN item_type = 'service_fee' THEN 1
                WHEN item_type = 'ut_liability' THEN 2
                ELSE 3
            END,
            created_at ASC
    LOOP
        EXIT WHEN v_funds_left <= 0;

        SELECT COALESCE(SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END), 0)
        INTO v_item_already_paid
        FROM public.payment_component_allocations
        WHERE invoice_item_id = v_item.id AND status = 'posted';

        v_item_unpaid := GREATEST(0, v_item.amount - v_item_already_paid);

        IF v_item_unpaid > 0 THEN
            v_allocation_slice := LEAST(v_funds_left, v_item_unpaid);

            INSERT INTO public.payment_component_allocations (
                payment_id, invoice_id, invoice_item_id, component_type,
                entry_type, amount, status, created_by
            ) VALUES (
                p_payment_id, v_invoice_id, v_item.id, v_item.item_type,
                'allocation', v_allocation_slice, 'posted', v_actor_id
            );

            v_funds_left := v_funds_left - v_allocation_slice;
        END IF;
    END LOOP;

    IF v_funds_left > 0 THEN
        RAISE EXCEPTION 'OVERPAYMENT_NOT_PERMITTED: Pembayaran melebihi total kewajiban item tagihan (Sisa dana tidak teralokasi: Rp %).', v_funds_left;
    END IF;

    -- 4. MARK PAYMENT VERIFIED
    UPDATE public.student_payments
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_payment_id;

    -- 5. RECALCULATE INVOICE STATUS
    PERFORM public.recalculate_invoice_status(v_invoice_id);

    -- 6. ATOMIC AUDIT LOG INSERTION
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'payment_verified',
        'student_payments',
        p_payment_id,
        jsonb_build_object(
            'status', v_payment_status,
            'verified_at', NULL,
            'verified_by', NULL
        ),
        jsonb_build_object(
            'status', 'verified',
            'verified_at', NOW(),
            'verified_by', v_actor_id
        ),
        'Verifikasi pembayaran mahasiswa no. ' || v_txn_number || ' sebesar Rp ' || v_payment_amount::text,
        jsonb_build_object(
            'transaction_number', v_txn_number,
            'amount', v_payment_amount,
            'student_id', v_student_id,
            'invoice_id', v_invoice_id
        ),
        NOW()
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.verify_student_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_student_payment(UUID) TO authenticated, service_role;


-- ============================================================================
-- 3. RPC: reject_student_payment (Atomic Status & Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_student_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_payment_status VARCHAR(30);
    v_payment_amount BIGINT;
    v_txn_number VARCHAR(50);
    v_student_id UUID;
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin menolak pembayaran.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Alasan penolakan pembayaran wajib diisi.';
    END IF;

    SELECT status, amount, transaction_number, student_id
    INTO v_payment_status, v_payment_amount, v_txn_number, v_student_id
    FROM public.student_payments WHERE id = p_payment_id FOR UPDATE;

    IF v_payment_status IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND: Pembayaran tidak ditemukan.';
    END IF;

    IF v_payment_status = 'rejected' THEN
        RETURN TRUE; -- Idempotent retry
    END IF;

    IF v_payment_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya pembayaran berstatus pending yang dapat ditolak (Status saat ini: %).', v_payment_status;
    END IF;

    UPDATE public.student_payments
    SET status = 'rejected',
        rejected_at = NOW(),
        rejected_by = v_actor_id,
        rejection_reason = p_reason,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_payment_id;

    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'payment_rejected',
        'student_payments',
        p_payment_id,
        jsonb_build_object('status', v_payment_status),
        jsonb_build_object('status', 'rejected', 'rejection_reason', p_reason),
        'Penolakan pembayaran no. ' || v_txn_number || ': ' || p_reason,
        jsonb_build_object(
            'transaction_number', v_txn_number,
            'amount', v_payment_amount,
            'student_id', v_student_id
        ),
        NOW()
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reject_student_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_student_payment(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- 4. RPC: request_payment_void (Atomic Void Request & Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_payment_void(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_payment_status VARCHAR(30);
    v_payment_amount BIGINT;
    v_txn_number VARCHAR(50);
    v_existing_req_id UUID;
    v_void_request_id UUID;
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin mengajukan void pembayaran.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Alasan pengajuan void wajib diisi.';
    END IF;

    SELECT status, amount, transaction_number
    INTO v_payment_status, v_payment_amount, v_txn_number
    FROM public.student_payments WHERE id = p_payment_id FOR UPDATE;

    IF v_payment_status IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND: Pembayaran tidak ditemukan.';
    END IF;

    IF v_payment_status <> 'verified' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya pembayaran berstatus verified yang dapat diajukan void (Status saat ini: %).', v_payment_status;
    END IF;

    -- Check active pending request
    SELECT id INTO v_existing_req_id
    FROM public.payment_void_requests
    WHERE payment_id = p_payment_id AND status = 'pending';

    IF v_existing_req_id IS NOT NULL THEN
        RETURN v_existing_req_id; -- Idempotent return
    END IF;

    INSERT INTO public.payment_void_requests (
        payment_id, requested_by, requested_at, reason, status
    ) VALUES (
        p_payment_id, v_actor_id, NOW(), p_reason, 'pending'
    ) RETURNING id INTO v_void_request_id;

    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'payment_void_requested',
        'student_payments',
        p_payment_id,
        jsonb_build_object('void_request_status', NULL),
        jsonb_build_object(
            'void_request_id', v_void_request_id,
            'void_request_status', 'pending',
            'reason', p_reason
        ),
        'Pengajuan void pembayaran no. ' || v_txn_number || ': ' || p_reason,
        jsonb_build_object(
            'transaction_number', v_txn_number,
            'amount', v_payment_amount,
            'void_request_id', v_void_request_id
        ),
        NOW()
    );

    RETURN v_void_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.request_payment_void(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payment_void(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- 5. RPC: approve_payment_void_request (Hardened with Atomic Audit Logging)
-- ============================================================================
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
    v_requested_by UUID;
    v_req_status VARCHAR(20);
    v_void_reason TEXT;
    v_user_role VARCHAR;
    v_payment_amount BIGINT;
    v_txn_number VARCHAR(50);
BEGIN
    

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_payment_void_request';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang memiliki wewenang untuk memproses persetujuan void pembayaran';
    END IF;

    SELECT pvr.payment_id, pvr.requested_by, pvr.status, pvr.reason, sp.amount, sp.transaction_number
    INTO v_payment_id, v_requested_by, v_req_status, v_void_reason, v_payment_amount, v_txn_number
    FROM public.payment_void_requests pvr
    JOIN public.student_payments sp ON pvr.payment_id = sp.id
    WHERE pvr.id = p_void_request_id
    FOR UPDATE OF pvr;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Permintaan void tidak ditemukan atau telah diproses sebelumnya';
    END IF;

    -- Maker-Checker Security Rule: Requester cannot approve their own void request
    IF p_action = 'approve' AND v_actor_id = v_requested_by THEN
        RAISE EXCEPTION 'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.';
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

        -- Record atomic audit log for void approval
        INSERT INTO public.audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            new_data,
            reason,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'payment_void_approved',
            'student_payments',
            v_payment_id,
            jsonb_build_object('status', 'verified', 'void_request_status', 'pending'),
            jsonb_build_object('status', 'voided', 'void_request_status', 'approved', 'review_notes', p_review_notes),
            'Persetujuan void pembayaran no. ' || v_txn_number || ': ' || COALESCE(p_review_notes, v_void_reason),
            jsonb_build_object(
                'transaction_number', v_txn_number,
                'amount', v_payment_amount,
                'void_request_id', p_void_request_id,
                'requested_by', v_requested_by
            ),
            NOW()
        );
    ELSE
        UPDATE public.payment_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        -- Record atomic audit log for void rejection
        INSERT INTO public.audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            new_data,
            reason,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'payment_void_rejected',
            'student_payments',
            v_payment_id,
            jsonb_build_object('void_request_status', 'pending'),
            jsonb_build_object('void_request_status', 'rejected', 'review_notes', p_review_notes),
            'Penolakan void pembayaran no. ' || v_txn_number || ': ' || COALESCE(p_review_notes, 'Ditolak pimpinan'),
            jsonb_build_object(
                'transaction_number', v_txn_number,
                'amount', v_payment_amount,
                'void_request_id', p_void_request_id,
                'requested_by', v_requested_by
            ),
            NOW()
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_payment_void_request(UUID, UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_void_request(UUID, UUID, VARCHAR, TEXT) TO authenticated, service_role;


-- ============================================================================
-- 6. RPC: create_ut_remittance_with_items (Hardened with Atomic Audit Logging)
-- ============================================================================
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
    p_idempotency_key UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_existing_id UUID;
    v_rem_id UUID;
    v_rem_number VARCHAR(50);
    v_item JSONB;
    v_lip_id UUID;
    v_reg_id UUID;
    v_item_amt BIGINT;
    v_sum_items BIGINT := 0;
    v_lip_doc RECORD;
    v_inv RECORD;
    v_salut_total BIGINT := 0;
    v_salut_paid BIGINT := 0;
    v_available_ut_fund BIGINT := 0;
    v_already_remitted BIGINT := 0;
    v_outstanding_remittance BIGINT := 0;
    v_account_name VARCHAR(100);
BEGIN
    
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki hak membuat setoran UT.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- Return existing record without producing duplicate audit log on idempotent retry
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM public.ut_remittances WHERE idempotency_key = p_idempotency_key;
        IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_lip_id := (v_item->>'lip_document_id')::UUID;
        v_reg_id := (v_item->>'registration_id')::UUID;
        v_item_amt := (v_item->>'amount')::BIGINT;

        IF v_lip_id IS NULL THEN
            RAISE EXCEPTION 'VALIDATION_FAILED: lip_document_id wajib diisi dan tidak boleh NULL.';
        END IF;

        -- MULTI-ROW LOCK LIP
        SELECT id, status, official_amount INTO v_lip_doc
        FROM public.lip_documents
        WHERE id = v_lip_id AND registration_id = v_reg_id FOR UPDATE;

        IF v_lip_doc.id IS NULL THEN RAISE EXCEPTION 'LIP % tidak ditemukan untuk registrasi.', v_lip_id; END IF;
        IF v_lip_doc.status <> 'verified' THEN
            RAISE EXCEPTION 'CRITERIA_FAILED: Dokumen LIP harus berstatus verified (Status saat ini: %).', v_lip_doc.status;
        END IF;

        -- LOCK INVOICE
        SELECT id, status INTO v_inv
        FROM public.invoices
        WHERE registration_id = v_reg_id AND status <> 'cancelled' FOR UPDATE;

        -- 1. CRITERIA: Komisi SALUT 100% Lunas
        SELECT amount INTO v_salut_total FROM public.invoice_items WHERE invoice_id = v_inv.id AND item_type = 'service_fee';
        SELECT COALESCE(SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END), 0)
        INTO v_salut_paid
        FROM public.payment_component_allocations
        WHERE invoice_id = v_inv.id AND component_type = 'service_fee' AND status = 'posted';

        IF v_salut_paid < v_salut_total THEN
            RAISE EXCEPTION 'CRITERIA_FAILED: Komisi SALUT belum lunas 100%% (Terbayar: Rp %, Wajib: Rp %).',
                v_salut_paid, v_salut_total;
        END IF;

        -- 2. CRITERIA: Dana UT Verified Mahasiswa >= Official LIP
        SELECT COALESCE(SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END), 0)
        INTO v_available_ut_fund
        FROM public.payment_component_allocations
        WHERE invoice_id = v_inv.id AND component_type = 'ut_liability' AND status = 'posted';

        IF v_available_ut_fund < v_lip_doc.official_amount THEN
            RAISE EXCEPTION 'CRITERIA_FAILED: Dana UT mahasiswa tidak mencukupi LIP resmi (Tersedia: Rp %, Wajib: Rp %).',
                v_available_ut_fund, v_lip_doc.official_amount;
        END IF;

        -- 3. CRITERIA: Tidak ada shortage yang belum dibayar
        IF v_inv.status <> 'paid' THEN
            RAISE EXCEPTION 'CRITERIA_FAILED: Masih terdapat kekurangan tagihan pada invoice registrasi mahasiswa.';
        END IF;

        -- 4. CRITERIA: Sisa Tagihan Remittance (Termasuk remittance pending_verification dan verified)
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_remitted
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_lip_id AND r.status IN ('pending_verification', 'verified');

        v_outstanding_remittance := v_lip_doc.official_amount - v_already_remitted;

        IF v_item_amt > v_outstanding_remittance THEN
            RAISE EXCEPTION 'OVER_REMITTANCE: Nominal alokasi (Rp %) melebihi sisa kewajiban LIP (Rp %).',
                v_item_amt, v_outstanding_remittance;
        END IF;

        v_sum_items := v_sum_items + v_item_amt;
    END LOOP;

    IF v_sum_items <> p_amount THEN
        RAISE EXCEPTION 'AMOUNT_MISMATCH: Total setoran (Rp %) harus tepat sama dengan jumlah item (Rp %).',
            p_amount, v_sum_items;
    END IF;

    v_rem_number := 'UTR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    INSERT INTO public.ut_remittances (
        remittance_number, paid_at, amount, cash_account_id, reference_number,
        proof_storage_path, original_file_name, mime_type, file_size, status,
        notes, idempotency_key, created_by, updated_by
    ) VALUES (
        v_rem_number, COALESCE(p_paid_at, NOW()), p_amount, p_cash_account_id, p_reference_number,
        p_proof_storage_path, p_original_file_name, p_mime_type, p_file_size, 'pending_verification',
        p_notes, p_idempotency_key, v_actor_id, v_actor_id
    ) RETURNING id INTO v_rem_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.ut_remittance_items (
            remittance_id, registration_id, lip_document_id, amount, created_by
        ) VALUES (
            v_rem_id, (v_item->>'registration_id')::UUID, (v_item->>'lip_document_id')::UUID,
            (v_item->>'amount')::BIGINT, v_actor_id
        );
    END LOOP;

    SELECT name INTO v_account_name FROM public.cash_accounts WHERE id = p_cash_account_id;

    -- ATOMIC AUDIT LOG INSERTION
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'ut_remittance_created',
        'ut_remittances',
        v_rem_id,
        NULL,
        jsonb_build_object(
            'remittance_id', v_rem_id,
            'remittance_number', v_rem_number,
            'amount', p_amount,
            'status', 'pending_verification',
            'cash_account_id', p_cash_account_id,
            'items_count', jsonb_array_length(p_items)
        ),
        'Pencatatan setoran UT no. ' || v_rem_number || ' sebesar Rp ' || p_amount::text,
        jsonb_build_object(
            'remittance_number', v_rem_number,
            'cash_account_name', v_account_name,
            'reference_number', p_reference_number,
            'idempotency_key', p_idempotency_key
        ),
        NOW()
    );

    RETURN v_rem_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, JSONB) TO authenticated, service_role;


-- ============================================================================
-- 7. RPC: verify_ut_remittance (Hardened with Atomic Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_ut_remittance(
    p_remittance_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_rem_number VARCHAR(50);
    v_amount BIGINT;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_new_verified_total BIGINT;
BEGIN
    

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_ut_remittance';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify UT remittances';
    END IF;

    -- Lock remittance header
    SELECT status, remittance_number, amount
    INTO v_status, v_rem_number, v_amount
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'UT Remittance not found';
    END IF;

    -- Idempotent exit: do not produce duplicate audit log
    IF v_status = 'verified' THEN
        RETURN TRUE;
    END IF;

    IF v_status <> 'pending_verification' AND v_status <> 'unverified' THEN
        RAISE EXCEPTION 'Only pending or unverified remittances can be verified';
    END IF;

    -- 1. Update Remittance Header to 'verified' FIRST
    UPDATE public.ut_remittances
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    -- 2. Lock LIP records & update LIP status to paid_to_ut if fully paid to UT
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

        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_item.lip_document_id
          AND r.status = 'verified';

        v_new_verified_total := v_already_verified;

        IF v_new_verified_total > v_lip_official THEN
            RAISE EXCEPTION 'Over-remittance protection: Total setoran (Rp %) exceeds LIP official amount (Rp %)',
                v_new_verified_total, v_lip_official;
        END IF;

        IF v_new_verified_total >= v_lip_official THEN
            UPDATE public.lip_documents
            SET status = 'paid_to_ut',
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_item.lip_document_id;
        END IF;
    END LOOP;

    -- ATOMIC AUDIT LOG INSERTION
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'ut_remittance_verified',
        'ut_remittances',
        p_remittance_id,
        jsonb_build_object('status', v_status),
        jsonb_build_object('status', 'verified', 'verified_at', NOW(), 'verified_by', v_actor_id),
        'Verifikasi setoran UT no. ' || v_rem_number || ' sebesar Rp ' || v_amount::text,
        jsonb_build_object(
            'remittance_number', v_rem_number,
            'amount', v_amount
        ),
        NOW()
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.verify_ut_remittance(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_ut_remittance(UUID, UUID) TO authenticated, service_role;


-- ============================================================================
-- 8. RPC: reject_ut_remittance (Atomic Status & Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_ut_remittance(
    p_remittance_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_rem_number VARCHAR(50);
    v_amount BIGINT;
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can reject UT remittances';
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Alasan penolakan setoran UT wajib diisi.';
    END IF;

    SELECT status, remittance_number, amount
    INTO v_status, v_rem_number, v_amount
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND: Setoran UT tidak ditemukan.';
    END IF;

    IF v_status = 'rejected' THEN
        RETURN TRUE; -- Idempotent retry
    END IF;

    IF v_status <> 'pending_verification' AND v_status <> 'unverified' THEN
        RAISE EXCEPTION 'Only pending or unverified remittances can be rejected (Status saat ini: %).', v_status;
    END IF;

    UPDATE public.ut_remittances
    SET status = 'rejected',
        rejected_at = NOW(),
        rejected_by = v_actor_id,
        rejection_reason = p_reason,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'ut_remittance_rejected',
        'ut_remittances',
        p_remittance_id,
        jsonb_build_object('status', v_status),
        jsonb_build_object('status', 'rejected', 'rejection_reason', p_reason),
        'Penolakan setoran UT no. ' || v_rem_number || ': ' || p_reason,
        jsonb_build_object(
            'remittance_number', v_rem_number,
            'amount', v_amount
        ),
        NOW()
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reject_ut_remittance(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_ut_remittance(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- 9. RPC: request_ut_remittance_void (Atomic Void Request & Audit Logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_ut_remittance_void(
    p_remittance_id UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_status VARCHAR(30);
    v_rem_number VARCHAR(50);
    v_amount BIGINT;
    v_existing_req_id UUID;
    v_void_request_id UUID;
BEGIN
    

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin mengajukan void setoran UT.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Alasan pengajuan void wajib diisi.';
    END IF;

    SELECT status, remittance_number, amount
    INTO v_status, v_rem_number, v_amount
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'NOT_FOUND: Setoran UT tidak ditemukan.';
    END IF;

    IF v_status <> 'verified' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya setoran UT berstatus verified yang dapat diajukan void (Status saat ini: %).', v_status;
    END IF;

    -- Check active pending request
    SELECT id INTO v_existing_req_id
    FROM public.ut_remittance_void_requests
    WHERE remittance_id = p_remittance_id AND status = 'pending';

    IF v_existing_req_id IS NOT NULL THEN
        RETURN v_existing_req_id; -- Idempotent return
    END IF;

    INSERT INTO public.ut_remittance_void_requests (
        remittance_id, requested_by, requested_at, reason, status
    ) VALUES (
        p_remittance_id, v_actor_id, NOW(), p_reason, 'pending'
    ) RETURNING id INTO v_void_request_id;

    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'ut_remittance_void_requested',
        'ut_remittances',
        p_remittance_id,
        jsonb_build_object('void_request_status', NULL),
        jsonb_build_object(
            'void_request_id', v_void_request_id,
            'void_request_status', 'pending',
            'reason', p_reason
        ),
        'Pengajuan void setoran UT no. ' || v_rem_number || ': ' || p_reason,
        jsonb_build_object(
            'remittance_number', v_rem_number,
            'amount', v_amount,
            'void_request_id', v_void_request_id
        ),
        NOW()
    );

    RETURN v_void_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.request_ut_remittance_void(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ut_remittance_void(UUID, TEXT) TO authenticated, service_role;


-- ============================================================================
-- 10. RPC: approve_ut_remittance_void_request (Hardened with Atomic Audit Logging)
-- ============================================================================
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
    v_requested_by UUID;
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_rem_number VARCHAR(50);
    v_amount BIGINT;
BEGIN
    

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_ut_remittance_void_request';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang berhak memproses persetujuan void setoran UT';
    END IF;

    SELECT uvr.remittance_id, uvr.requested_by, uvr.status, ur.remittance_number, ur.amount
    INTO v_remittance_id, v_requested_by, v_req_status, v_rem_number, v_amount
    FROM public.ut_remittance_void_requests uvr
    JOIN public.ut_remittances ur ON uvr.remittance_id = ur.id
    WHERE uvr.id = p_void_request_id
    FOR UPDATE OF uvr;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Permintaan void tidak ditemukan atau telah diproses sebelumnya';
    END IF;

    -- Maker-Checker Security Rule: Requester cannot approve their own void request
    IF p_action = 'approve' AND v_actor_id = v_requested_by THEN
        RAISE EXCEPTION 'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.';
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

            IF v_already_verified >= v_lip_official THEN
                UPDATE public.lip_documents
                SET status = 'paid_to_ut',
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_item.lip_document_id;
            ELSE
                UPDATE public.lip_documents
                SET status = 'verified',
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_item.lip_document_id AND status = 'paid_to_ut';
            END IF;
        END LOOP;

        -- Record atomic audit log for void approval
        INSERT INTO public.audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            new_data,
            reason,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'ut_remittance_void_approved',
            'ut_remittances',
            v_remittance_id,
            jsonb_build_object('status', 'verified', 'void_request_status', 'pending'),
            jsonb_build_object('status', 'voided', 'void_request_status', 'approved', 'review_notes', p_review_notes),
            'Persetujuan void setoran UT no. ' || v_rem_number || ': ' || COALESCE(p_review_notes, 'Disetujui pimpinan'),
            jsonb_build_object(
                'remittance_number', v_rem_number,
                'amount', v_amount,
                'void_request_id', p_void_request_id,
                'requested_by', v_requested_by
            ),
            NOW()
        );
    ELSE
        UPDATE public.ut_remittance_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        -- Record atomic audit log for void rejection
        INSERT INTO public.audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            old_data,
            new_data,
            reason,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'ut_remittance_void_rejected',
            'ut_remittances',
            v_remittance_id,
            jsonb_build_object('void_request_status', 'pending'),
            jsonb_build_object('void_request_status', 'rejected', 'review_notes', p_review_notes),
            'Penolakan void setoran UT no. ' || v_rem_number || ': ' || COALESCE(p_review_notes, 'Ditolak pimpinan'),
            jsonb_build_object(
                'remittance_number', v_rem_number,
                'amount', v_amount,
                'void_request_id', p_void_request_id,
                'requested_by', v_requested_by
            ),
            NOW()
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_ut_remittance_void_request(UUID, UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_ut_remittance_void_request(UUID, UUID, VARCHAR, TEXT) TO authenticated, service_role;
