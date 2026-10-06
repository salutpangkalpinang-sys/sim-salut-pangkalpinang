-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.4: Payments, Reconciliation, Ledger Concurrency & UT Remittance RPCs
-- ============================================================================

BEGIN;

-- ALLOW RECONCILIATION ADJUSTMENT ITEMS WHILE PRESERVING GENERAL LOCK
CREATE OR REPLACE FUNCTION public.check_invoice_locked_before_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_verified_count INTEGER;
    v_inv_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    -- Allow audit-tracked LIP reconciliation adjustments
    IF TG_OP = 'INSERT' AND NEW.source_type = 'lip_reconciliation' THEN
        RETURN NEW;
    END IF;

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

-- 1. HARDENED PAYMENT CREATION WITH PENDING RESERVATION & EXACT ALLOCATION
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
    v_inv_status VARCHAR(20);
    v_inv_student_id UUID;
    v_total_billed BIGINT;
    v_verified_paid BIGINT;
    v_pending_reserved BIGINT;
    v_remaining_payable BIGINT;
BEGIN
    SET search_path = public, pg_temp;

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

    SELECT id INTO v_existing_id FROM public.student_payments WHERE idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    -- SINGLE-INVOICE DIRECT MATCH: p_amount WAJIB sama dengan p_allocated_amount
    IF p_amount <> p_allocated_amount THEN
        RAISE EXCEPTION 'ALLOCATION_MISMATCH: Nominal pembayaran (Rp %) harus sama persis dengan nominal alokasi tagihan (Rp %).',
            p_amount, p_allocated_amount;
    END IF;

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

    -- INSERT PAYMENT (pending_verification automatically acts as reservation)
    INSERT INTO public.student_payments (
        transaction_number, student_id, paid_at, amount, payment_method_id,
        cash_account_id, reference_number, proof_storage_path, original_file_name,
        mime_type, file_size, status, notes, idempotency_key, received_by, created_by, updated_by
    ) VALUES (
        public.generate_transaction_number(), p_student_id, COALESCE(p_paid_at, NOW()), p_amount,
        p_payment_method_id, p_cash_account_id, p_reference_number, p_proof_storage_path,
        p_original_file_name, p_mime_type, p_file_size, 'pending_verification', p_notes,
        p_idempotency_key, v_actor_id, v_actor_id, v_actor_id
    ) RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_allocations (payment_id, invoice_id, amount, created_by)
    VALUES (v_payment_id, p_invoice_id, p_allocated_amount, v_actor_id);

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. HARDENED PAYMENT VERIFICATION WITH DUAL-LOCKING & COMPONENT WATERFALL
CREATE OR REPLACE FUNCTION public.verify_student_payment(p_payment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_payment_status VARCHAR(30);
    v_payment_amount BIGINT;
    v_invoice_id UUID;
    v_allocated_amount BIGINT;
    v_funds_left BIGINT;
    v_item RECORD;
    v_item_already_paid BIGINT;
    v_item_unpaid BIGINT;
    v_allocation_slice BIGINT;
BEGIN
    SET search_path = public, pg_temp;

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
    SELECT status, amount INTO v_payment_status, v_payment_amount
    FROM public.student_payments WHERE id = p_payment_id FOR UPDATE;

    IF v_payment_status IS NULL THEN RAISE EXCEPTION 'Payment tidak ditemukan'; END IF;
    IF v_payment_status = 'verified' THEN RETURN TRUE; END IF; -- Idempotent
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

    -- 3. COMPONENT ALLOCATION WATERFALL (Iterate invoice_items in strict priority: service_fee -> ut_liability -> internal_fee)
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

        -- Check already allocated amount for this item (active allocations minus active reversals)
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

    -- Reject if overpayment occurred during initial payment verification
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

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 3. VOID PAYMENT WITH COMPONENT REVERSAL ENTRY (APPEND-ONLY)
CREATE OR REPLACE FUNCTION public.void_verified_payment_with_reversals(
    p_payment_id UUID,
    p_void_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_payment_status VARCHAR(30);
    v_invoice_id UUID;
    v_alloc RECORD;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Hanya Owner dan Admin yang memiliki hak void pembayaran terverifikasi.';
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    SELECT status INTO v_payment_status FROM public.student_payments WHERE id = p_payment_id FOR UPDATE;
    IF v_payment_status <> 'verified' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya pembayaran terverifikasi yang dapat di-void melalui prosedur ini.';
    END IF;

    SELECT pa.invoice_id INTO v_invoice_id
    FROM public.payment_allocations pa
    JOIN public.invoices i ON pa.invoice_id = i.id
    WHERE pa.payment_id = p_payment_id FOR UPDATE OF i;

    -- Append Reversal Records for each component allocation
    FOR v_alloc IN 
        SELECT id, invoice_item_id, component_type, amount
        FROM public.payment_component_allocations
        WHERE payment_id = p_payment_id AND entry_type = 'allocation' AND status = 'posted'
    LOOP
        INSERT INTO public.payment_component_allocations (
            payment_id, invoice_id, invoice_item_id, component_type,
            entry_type, reversal_of_allocation_id, amount, status, created_by
        ) VALUES (
            p_payment_id, v_invoice_id, v_alloc.invoice_item_id, v_alloc.component_type,
            'reversal', v_alloc.id, v_alloc.amount, 'posted', v_actor_id
        );
    END LOOP;

    -- Mark payment row voided
    UPDATE public.student_payments
    SET status = 'voided',
        voided_at = NOW(),
        voided_by = v_actor_id,
        void_reason = p_void_reason,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_payment_id;

    -- Recalculate invoice status
    PERFORM public.recalculate_invoice_status(v_invoice_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. ADVISORY LOCKED STUDENT CREDIT LEDGER MUTATION HELPER
CREATE OR REPLACE FUNCTION public.post_student_credit_entry(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_id UUID,
    p_reconciliation_id UUID,
    p_entry_type VARCHAR,
    p_transaction_type VARCHAR,
    p_amount BIGINT,
    p_notes TEXT,
    p_idempotency_key UUID,
    p_cash_account_id UUID DEFAULT NULL,
    p_related_ledger_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_ledger_id UUID;
    v_current_balance BIGINT := 0;
    v_balance_after BIGINT := 0;
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.';
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- ADVISORY LOCK per student
    PERFORM pg_advisory_xact_lock(hashtext('student_credit_' || p_student_id::text));

    -- CALCULATE RUNNING BALANCE FROM POSTED ENTRIES
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
    INTO v_current_balance
    FROM public.student_credit_ledgers
    WHERE student_id = p_student_id AND status = 'posted';

    IF p_entry_type = 'debit' THEN
        IF p_amount > v_current_balance THEN
            RAISE EXCEPTION 'INSUFFICIENT_CREDIT_BALANCE: Saldo kredit mahasiswa tidak mencukupi (Tersedia: Rp %, Diminta: Rp %).',
                v_current_balance, p_amount;
        END IF;
        v_balance_after := v_current_balance - p_amount;
    ELSE
        v_balance_after := v_current_balance + p_amount;
    END IF;

    INSERT INTO public.student_credit_ledgers (
        student_id, academic_period_id, registration_id, idempotency_key,
        source_reconciliation_id, entry_type, transaction_type, amount, balance_after,
        cash_account_id, related_ledger_id, notes, status, maker_by, checker_by, reviewed_at
    ) VALUES (
        p_student_id, p_academic_period_id, p_registration_id, p_idempotency_key,
        p_reconciliation_id, p_entry_type, p_transaction_type, p_amount, v_balance_after,
        p_cash_account_id, p_related_ledger_id, p_notes, 'posted', v_actor_id, v_actor_id, NOW()
    ) RETURNING id INTO v_ledger_id;

    RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 5. ATOMIC CARRY-FORWARD RPC (DUAL MUTATION IN SINGLE TX)
CREATE OR REPLACE FUNCTION public.execute_student_credit_carry_forward(
    p_student_id UUID,
    p_source_period_id UUID,
    p_target_period_id UUID,
    p_amount BIGINT,
    p_notes TEXT,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_out_id UUID;
    v_in_id UUID;
    v_key_out UUID;
    v_key_in UUID;
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin carry-forward saldo.', v_actor_role;
    END IF;

    v_key_out := gen_random_uuid();
    v_key_in := gen_random_uuid();

    -- Entry 1: Debit out from source period
    v_out_id := public.post_student_credit_entry(
        p_student_id, p_source_period_id, NULL, NULL,
        'debit', 'carry_forward_out', p_amount,
        COALESCE(p_notes, 'Carry-forward keluar ke periode berikutnya'), v_key_out
    );

    -- Entry 2: Credit in to target period
    v_in_id := public.post_student_credit_entry(
        p_student_id, p_target_period_id, NULL, NULL,
        'credit', 'carry_forward_in', p_amount,
        COALESCE(p_notes, 'Carry-forward masuk dari periode sebelumnya'), v_key_in, NULL, v_out_id
    );

    -- Link back
    UPDATE public.student_credit_ledgers SET related_ledger_id = v_in_id WHERE id = v_out_id;

    RETURN jsonb_build_object('success', true, 'debit_id', v_out_id, 'credit_id', v_in_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 6. MAKER-CHECKER REFUND REQUEST & APPROVAL RPCS
CREATE OR REPLACE FUNCTION public.request_student_credit_refund(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_amount BIGINT,
    p_cash_account_id UUID,
    p_notes TEXT,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_ledger_id UUID;
    v_current_balance BIGINT := 0;
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki hak mengajukan refund.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('student_credit_' || p_student_id::text));

    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
    INTO v_current_balance
    FROM public.student_credit_ledgers
    WHERE student_id = p_student_id AND status = 'posted';

    IF p_amount > v_current_balance THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDIT_BALANCE: Pengajuan refund (Rp %) melebihi saldo kredit posted (Rp %).',
            p_amount, v_current_balance;
    END IF;

    INSERT INTO public.student_credit_ledgers (
        student_id, academic_period_id, idempotency_key, entry_type,
        transaction_type, amount, balance_after, cash_account_id, notes,
        status, maker_by, checker_by, created_at
    ) VALUES (
        p_student_id, p_academic_period_id, p_idempotency_key, 'debit',
        'refund_payout', p_amount, v_current_balance - p_amount, p_cash_account_id,
        p_notes, 'pending_approval', v_actor_id, NULL, NOW()
    ) RETURNING id INTO v_ledger_id;

    RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


CREATE OR REPLACE FUNCTION public.approve_student_credit_refund(
    p_refund_ledger_id UUID,
    p_action VARCHAR -- 'approve' or 'reject'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_checker_id UUID;
    v_checker_role VARCHAR(50);
    v_maker_id UUID;
    v_amount BIGINT;
    v_student_id UUID;
    v_status VARCHAR(20);
    v_cash_account_id UUID;
    v_notes TEXT;
BEGIN
    SET search_path = public, pg_temp;
    v_checker_id := auth.uid();
    IF v_checker_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_checker_role := public.get_current_user_role();
    IF v_checker_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Hanya Owner dan Admin yang berwenang menjadi Checker approval refund.';
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    SELECT student_id, maker_by, amount, status, cash_account_id, notes
    INTO v_student_id, v_maker_id, v_amount, v_status, v_cash_account_id, v_notes
    FROM public.student_credit_ledgers
    WHERE id = p_refund_ledger_id FOR UPDATE;

    IF v_status <> 'pending_approval' THEN
        RAISE EXCEPTION 'INVALID_STATE: Permintaan refund telah diproses sebelumnya.';
    END IF;

    IF v_checker_id = v_maker_id THEN
        RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION: Checker wajib merupakan pengguna yang berbeda dari Maker.';
    END IF;

    IF p_action = 'approve' THEN
        -- Post ledger entry
        UPDATE public.student_credit_ledgers
        SET status = 'posted',
            checker_by = v_checker_id,
            reviewed_at = NOW()
        WHERE id = p_refund_ledger_id;

        -- Record operational expense payout under student deposit refund
        INSERT INTO public.operational_transactions (
            transaction_type, category_id, cash_account_id, transaction_date,
            amount, description, status, idempotency_key, submitted_at, verified_at, verified_by
        ) VALUES (
            'expense',
            (SELECT id FROM public.operational_categories WHERE transaction_type = 'expense' LIMIT 1),
            v_cash_account_id,
            NOW(),
            v_amount,
            'Pengembalian Saldo Deposit Mahasiswa (Refund Ref: ' || p_refund_ledger_id::text || ')',
            'verified',
            gen_random_uuid(),
            NOW(),
            NOW(),
            v_checker_id
        );
    ELSE
        UPDATE public.student_credit_ledgers
        SET status = 'rejected',
            checker_by = v_checker_id,
            reviewed_at = NOW()
        WHERE id = p_refund_ledger_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 7. RECONCILIATION RPC WITH IDEMPOTENCY & REAL CASH CREDIT ISOLATION
CREATE OR REPLACE FUNCTION public.reconcile_lip_with_invoice(
    p_lip_document_id UUID,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_reg_id UUID;
    v_lip_status VARCHAR(30);
    v_lip_official BIGINT;
    v_inv_id UUID;
    v_est_ut BIGINT;
    v_variance BIGINT;
    v_existing_rec_id UUID;
    v_rec_id UUID;
    v_salut_snapshot BIGINT := 0;
    v_ut_verified_paid BIGINT := 0;
    v_real_cash_credit BIGINT := 0;
    v_period_id UUID;
    v_student_id UUID;
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki hak merekonsiliasi LIP.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- LOCK LIP
    SELECT registration_id, status, official_amount INTO v_reg_id, v_lip_status, v_lip_official
    FROM public.lip_documents WHERE id = p_lip_document_id FOR UPDATE;

    IF v_lip_status IS NULL THEN RAISE EXCEPTION 'LIP tidak ditemukan'; END IF;
    IF v_lip_status = 'cancelled' THEN RAISE EXCEPTION 'LIP telah dibatalkan'; END IF;

    -- LOCK INVOICE
    SELECT id, estimated_ut_amount INTO v_inv_id, v_est_ut
    FROM public.invoices WHERE registration_id = v_reg_id AND status <> 'cancelled' FOR UPDATE;

    IF v_inv_id IS NULL THEN RAISE EXCEPTION 'Invoice aktif registrasi tidak ditemukan'; END IF;

    -- IDEMPOTENCY CHECK
    SELECT id INTO v_existing_rec_id
    FROM public.invoice_reconciliations
    WHERE invoice_id = v_inv_id AND lip_document_id = p_lip_document_id AND status = 'active';

    IF v_existing_rec_id IS NOT NULL THEN
        RETURN v_existing_rec_id;
    END IF;

    SELECT student_id, academic_period_id INTO v_student_id, v_period_id
    FROM public.registrations WHERE id = v_reg_id;

    SELECT amount INTO v_salut_snapshot
    FROM public.invoice_items WHERE invoice_id = v_inv_id AND item_type = 'service_fee';

    -- CALCULATE VERIFIED ACTIVE UT ALLOCATIONS
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END), 0)
    INTO v_ut_verified_paid
    FROM public.payment_component_allocations
    WHERE invoice_id = v_inv_id AND component_type = 'ut_liability' AND status = 'posted';

    v_variance := v_lip_official - v_est_ut;

    -- ONLY VERIFIED CASH EXCEEDING OFFICIAL LIP CREATES STUDENT CREDIT
    IF v_variance < 0 THEN
        v_real_cash_credit := GREATEST(0, v_ut_verified_paid - v_lip_official);
    END IF;

    INSERT INTO public.invoice_reconciliations (
        invoice_id, registration_id, lip_document_id, idempotency_key,
        estimated_ut_amount, official_lip_amount, variance_amount,
        service_fee_snapshot, verified_paid_at_reconcile, shortage_created,
        credit_created, reconciled_by, status
    ) VALUES (
        v_inv_id, v_reg_id, p_lip_document_id, p_idempotency_key,
        v_est_ut, v_lip_official, v_variance,
        v_salut_snapshot, v_ut_verified_paid, GREATEST(0, v_variance),
        v_real_cash_credit, v_actor_id, 'active'
    ) RETURNING id INTO v_rec_id;

    -- APPLY IMMUTABLE ADJUSTMENT ITEMS
    IF v_variance > 0 THEN
        INSERT INTO public.invoice_items (
            invoice_id, item_type, description, quantity, unit_amount, amount, source_type, source_id
        ) VALUES (
            v_inv_id, 'ut_liability', 'Penyesuaian Kekurangan Biaya LIP Resmi UT', 1, v_variance, v_variance, 'lip_reconciliation', v_rec_id
        );
    ELSIF v_variance < 0 THEN
        INSERT INTO public.invoice_items (
            invoice_id, item_type, description, quantity, unit_amount, amount, source_type, source_id, approval_status
        ) VALUES (
            v_inv_id, 'discount', 'Penyesuaian Koreksi Penurunan Tagihan LIP Resmi UT', 1, ABS(v_variance), ABS(v_variance), 'lip_reconciliation', v_rec_id, 'approved'
        );

        IF v_real_cash_credit > 0 THEN
            PERFORM public.post_student_credit_entry(
                v_student_id, v_period_id, v_reg_id, v_rec_id,
                'credit', 'reconciliation_credit', v_real_cash_credit,
                'Kelebihan pembayaran kas riil dari rekonsiliasi LIP resmi UT', gen_random_uuid()
            );
        END IF;
    END IF;

    -- UPDATE INVOICE & LIP HEADERS
    UPDATE public.invoices
    SET lip_document_id = p_lip_document_id,
        billing_phase = 'lip_reconciled',
        official_lip_amount = v_lip_official,
        variance_amount = v_variance,
        reconciled_at = NOW(),
        reconciled_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = v_inv_id;

    UPDATE public.lip_documents
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_lip_document_id;

    PERFORM public.recalculate_invoice_status(v_inv_id);

    RETURN v_rec_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. HARDENED UT REMITTANCE WITH MULTI-ROW LOCKING & STRICT 5 ELIGIBILITY CRITERIA
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
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'finance_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki hak membuat setoran UT.', v_actor_role;
    END IF;

    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

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

    RETURN v_rem_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 9. CLEAN UP OBSOLETE SIGNATURES WITH SPOOFABLE IDENTITY PARAMETERS
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, BIGINT);
DROP FUNCTION IF EXISTS public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, BIGINT, UUID);
DROP FUNCTION IF EXISTS public.verify_student_payment(UUID, UUID);
DROP FUNCTION IF EXISTS public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, JSONB);

-- ----------------------------------------------------------------------------
-- 10. STRICT EXECUTION PRIVILEGES (FAIL-CLOSED TO PUBLIC / ANON)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.verify_student_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_student_payment(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.void_verified_payment_with_reversals(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_verified_payment_with_reversals(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.post_student_credit_entry(UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_student_credit_entry(UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_student_credit_refund(UUID, UUID, BIGINT, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_student_credit_refund(UUID, UUID, BIGINT, UUID, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_student_credit_refund(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_student_credit_refund(UUID, VARCHAR) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reconcile_lip_with_invoice(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_lip_with_invoice(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, JSONB) TO authenticated, service_role;

COMMIT;
