-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 6: Operational Cash Transactions, Master Categories & Void Workflow
-- ============================================================================

-- 1. OPERATIONAL CATEGORIES TABLE & DEFAULT MASTER SEED
CREATE TABLE IF NOT EXISTS public.operational_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NULL,
    name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_categories_type ON public.operational_categories (transaction_type);

-- Seed Default Master Categories safely
INSERT INTO public.operational_categories (code, name, transaction_type, is_active)
VALUES
    ('INC-GEN', 'Pemasukan Non-Mahasiswa / Hibah', 'income', true),
    ('INC-SRV', 'Pemasukan Jasa Layanan Lain', 'income', true),
    ('EXP-OFF', 'Beban Operasional Kantor / ATK', 'expense', true),
    ('EXP-UTL', 'Beban Listrik, Air & Internet', 'expense', true),
    ('EXP-RENT', 'Beban Sewa Tempat / Gedung', 'expense', true),
    ('EXP-SAL', 'Beban Gaji & Honor Petugas', 'expense', true)
ON CONFLICT DO NOTHING;

-- 2. OPERATIONAL TRANSACTION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.ops_transaction_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_ops_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.ops_transaction_number_seq');
    RETURN 'OPS-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. OPERATIONAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_ops_transaction_number(),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    category_id UUID NOT NULL REFERENCES public.operational_categories(id) ON DELETE RESTRICT,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    idempotency_key UUID UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_ops_txns_type ON public.operational_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_ops_txns_status ON public.operational_transactions (status);
CREATE INDEX IF NOT EXISTS idx_ops_txns_num ON public.operational_transactions (transaction_number);

-- 4. OPERATIONAL TRANSACTION VOID REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transaction_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operational_transaction_id UUID NOT NULL REFERENCES public.operational_transactions(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_void_parent ON public.operational_transaction_void_requests (operational_transaction_id);

-- 5. ATOMIC STORED PROCEDURE FOR CREATING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.create_operational_transaction(
    p_transaction_type VARCHAR,
    p_category_id UUID,
    p_cash_account_id UUID,
    p_transaction_date TIMESTAMPTZ,
    p_amount BIGINT,
    p_description TEXT,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_ops_id UUID;
    v_ops_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_cat_type VARCHAR(20);
    v_cat_active BOOLEAN;
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_operational_transaction';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record operational transactions';
    END IF;

    -- Non-Null Idempotency Key Requirement
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required for transaction creation';
    END IF;

    -- Idempotency check
    SELECT id INTO v_existing_id
    FROM public.operational_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Operational transaction amount must be greater than 0';
    END IF;

    IF p_transaction_type NOT IN ('income', 'expense') THEN
        RAISE EXCEPTION 'Invalid transaction_type: must be income or expense';
    END IF;

    -- Validate Category matching & active status
    SELECT transaction_type, is_active INTO v_cat_type, v_cat_active
    FROM public.operational_categories
    WHERE id = p_category_id;

    IF v_cat_type IS NULL THEN
        RAISE EXCEPTION 'Target operational category not found';
    END IF;

    IF NOT v_cat_active THEN
        RAISE EXCEPTION 'Cannot use an inactive operational category for new transactions';
    END IF;

    IF v_cat_type <> p_transaction_type THEN
        RAISE EXCEPTION 'Category transaction type mismatch: Category % cannot be used for % transaction',
            v_cat_type, p_transaction_type;
    END IF;

    v_ops_number := public.generate_ops_transaction_number();

    INSERT INTO public.operational_transactions (
        transaction_number,
        transaction_type,
        category_id,
        cash_account_id,
        transaction_date,
        amount,
        description,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_ops_number,
        p_transaction_type,
        p_category_id,
        p_cash_account_id,
        COALESCE(p_transaction_date, NOW()),
        p_amount,
        p_description,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_ops_id;

    RETURN v_ops_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. STORED PROCEDURE FOR VERIFYING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.verify_operational_transaction(
    p_transaction_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_operational_transaction';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify operational transactions';
    END IF;

    SELECT status INTO v_status
    FROM public.operational_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Operational transaction not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending operational transactions can be verified';
    END IF;

    UPDATE public.operational_transactions
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_transaction_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. STORED PROCEDURE FOR OWNER APPROVAL OF OPERATIONAL VOID REQUEST
CREATE OR REPLACE FUNCTION public.approve_operational_transaction_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_ops_id UUID;
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_operational_transaction_void_request';
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve operational void requests';
    END IF;

    SELECT operational_transaction_id, status INTO v_ops_id, v_req_status
    FROM public.operational_transaction_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.operational_transaction_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.operational_transactions
        SET status = 'voided',
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = p_review_notes,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_ops_id;
    ELSE
        UPDATE public.operational_transaction_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 8. PRIVATE STORAGE BUCKET (operational-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operational-proofs', 'operational-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Authenticated users can view operational proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'operational-proofs');
CREATE POLICY "Owner/FinanceAdmin can upload operational proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
CREATE POLICY "Owner/FinanceAdmin can update operational proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
