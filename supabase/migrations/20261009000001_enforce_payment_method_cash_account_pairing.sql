-- Migration: 20261009000001_enforce_payment_method_cash_account_pairing.sql
-- Description: Enforce explicit pairing validation between payment_methods and cash_accounts in database.
-- Prevents invalid combinations (e.g. CASH with bank account, BANK_TRANSFER with cash account),
-- inactive payment methods / cash accounts, and unrecognized master codes at database layer.

-- 1. Validation function for payment method and cash account pairing
CREATE OR REPLACE FUNCTION public.validate_payment_method_cash_account_pairing(
    p_payment_method_id UUID,
    p_cash_account_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_method_code VARCHAR(50);
    v_method_active BOOLEAN;
    v_account_code VARCHAR(50);
    v_account_active BOOLEAN;
    v_method_category VARCHAR(20);
    v_account_type VARCHAR(20);
BEGIN
    -- Both IDs must be provided
    IF p_payment_method_id IS NULL THEN
        RAISE EXCEPTION 'Metode pembayaran wajib dipilih';
    END IF;

    IF p_cash_account_id IS NULL THEN
        RAISE EXCEPTION 'Rekening kas / bank penerima wajib dipilih';
    END IF;

    -- Lookup payment method
    SELECT code, is_active
    INTO v_method_code, v_method_active
    FROM public.payment_methods
    WHERE id = p_payment_method_id;

    IF v_method_code IS NULL THEN
        RAISE EXCEPTION 'Metode pembayaran dengan ID % tidak ditemukan', p_payment_method_id;
    END IF;

    IF NOT v_method_active THEN
        RAISE EXCEPTION 'Metode pembayaran % sedang nonaktif', v_method_code;
    END IF;

    -- Lookup cash account
    SELECT code, is_active
    INTO v_account_code, v_account_active
    FROM public.cash_accounts
    WHERE id = p_cash_account_id;

    IF v_account_code IS NULL THEN
        RAISE EXCEPTION 'Rekening kas / bank dengan ID % tidak ditemukan', p_cash_account_id;
    END IF;

    IF NOT v_account_active THEN
        RAISE EXCEPTION 'Rekening kas / bank % sedang nonaktif', v_account_code;
    END IF;

    -- Determine official method category (fail-closed)
    v_method_category := CASE UPPER(TRIM(v_method_code))
        WHEN 'CASH' THEN 'cash'
        WHEN 'BANK_TRANSFER' THEN 'bank'
        ELSE NULL
    END;

    IF v_method_category IS NULL THEN
        RAISE EXCEPTION 'Metode pembayaran dengan kode "%" tidak dikenal dalam master resmi', v_method_code;
    END IF;

    -- Determine official cash account type (fail-closed)
    v_account_type := CASE UPPER(TRIM(v_account_code))
        WHEN 'KAS_TUNAI' THEN 'cash'
        WHEN 'BANK_BCA' THEN 'bank'
        WHEN 'BANK_BRI' THEN 'bank'
        WHEN 'BANK_BTN' THEN 'bank'
        ELSE NULL
    END;

    IF v_account_type IS NULL THEN
        RAISE EXCEPTION 'Rekening kas / bank dengan kode "%" tidak dikenal dalam master resmi', v_account_code;
    END IF;

    -- Enforce matching category
    IF v_method_category = 'cash' AND v_account_type <> 'cash' THEN
        RAISE EXCEPTION 'Metode pembayaran Tunai (CASH) wajib disalurkan ke Rekening Kas Tunai, bukan rekening bank (%)', v_account_code;
    END IF;

    IF v_method_category = 'bank' AND v_account_type <> 'bank' THEN
        RAISE EXCEPTION 'Metode pembayaran Transfer Bank (BANK_TRANSFER) wajib disalurkan ke Rekening Bank, bukan kas tunai (%)', v_account_code;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Trigger function on public.student_payments to protect direct INSERT / UPDATE
CREATE OR REPLACE FUNCTION public.check_student_payment_account_pairing()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.validate_payment_method_cash_account_pairing(
        NEW.payment_method_id,
        NEW.cash_account_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Drop trigger if exists to prevent duplication
DROP TRIGGER IF EXISTS trg_check_student_payment_account_pairing ON public.student_payments;

CREATE TRIGGER trg_check_student_payment_account_pairing
BEFORE INSERT OR UPDATE OF payment_method_id, cash_account_id ON public.student_payments
FOR EACH ROW
EXECUTE FUNCTION public.check_student_payment_account_pairing();

-- 3. Update RPC create_payment_with_allocation preserving exact Phase 2 signature, RBAC, idempotency & capacity logic
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

-- Preserve execution grants
REVOKE ALL ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, BIGINT, UUID) TO authenticated, service_role;
