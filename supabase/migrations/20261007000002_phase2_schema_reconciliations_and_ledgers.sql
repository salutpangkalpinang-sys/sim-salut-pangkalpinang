-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.2: Reconciliations, Student Credit Sub-Ledger & Persisted Allocations
-- ============================================================================

BEGIN;

-- 1. IMMUTABLE INVOICE RECONCILIATIONS TABLE
CREATE TABLE IF NOT EXISTS public.invoice_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    idempotency_key UUID UNIQUE NOT NULL,
    estimated_ut_amount BIGINT NOT NULL CHECK (estimated_ut_amount >= 0),
    official_lip_amount BIGINT NOT NULL CHECK (official_lip_amount >= 0),
    variance_amount BIGINT NOT NULL, -- official_lip_amount - estimated_ut_amount
    service_fee_snapshot BIGINT NOT NULL CHECK (service_fee_snapshot >= 0),
    verified_paid_at_reconcile BIGINT NOT NULL CHECK (verified_paid_at_reconcile >= 0),
    shortage_created BIGINT DEFAULT 0 NOT NULL CHECK (shortage_created >= 0),
    credit_created BIGINT DEFAULT 0 NOT NULL CHECK (credit_created >= 0),
    reconciled_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reconciled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'superseded', 'voided')),
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    void_reason TEXT NULL
);

-- Partial Unique Index: Exactly 1 active reconciliation per invoice & per LIP
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_rec_per_invoice 
ON public.invoice_reconciliations (invoice_id) 
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_rec_per_lip 
ON public.invoice_reconciliations (lip_document_id) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_reconcile_reg ON public.invoice_reconciliations (registration_id);


-- 2. STUDENT CREDIT APPEND-ONLY SUB-LEDGER
CREATE TABLE IF NOT EXISTS public.student_credit_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    academic_period_id UUID NOT NULL REFERENCES public.academic_periods(id) ON DELETE RESTRICT,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE RESTRICT,
    idempotency_key UUID UNIQUE NOT NULL,
    source_reconciliation_id UUID REFERENCES public.invoice_reconciliations(id) ON DELETE RESTRICT,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'reconciliation_credit',
        'carry_forward_out',
        'carry_forward_in',
        'refund_payout'
    )),
    amount BIGINT NOT NULL CHECK (amount > 0),
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    related_ledger_id UUID REFERENCES public.student_credit_ledgers(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NULL,
    notes TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'posted' NOT NULL CHECK (status IN ('pending_approval', 'posted', 'rejected', 'voided')),
    maker_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    checker_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CHECK (
        (status = 'posted' AND transaction_type = 'refund_payout' AND checker_by IS NOT NULL AND checker_by <> maker_by)
        OR (transaction_type <> 'refund_payout')
        OR (status IN ('pending_approval', 'rejected', 'voided'))
    )
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_student ON public.student_credit_ledgers (student_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_period ON public.student_credit_ledgers (academic_period_id);


-- 3. PERSISTED PAYMENT COMPONENT ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_component_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.student_payments(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    invoice_item_id UUID REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
    component_type VARCHAR(30) NOT NULL CHECK (component_type IN ('service_fee', 'ut_liability', 'internal_fee', 'student_credit')),
    entry_type VARCHAR(15) DEFAULT 'allocation' NOT NULL CHECK (entry_type IN ('allocation', 'reversal')),
    reversal_of_allocation_id UUID REFERENCES public.payment_component_allocations(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status VARCHAR(20) DEFAULT 'posted' NOT NULL CHECK (status IN ('posted', 'voided')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pca_payment ON public.payment_component_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_pca_invoice ON public.payment_component_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_pca_component ON public.payment_component_allocations (component_type);
CREATE INDEX IF NOT EXISTS idx_pca_item ON public.payment_component_allocations (invoice_item_id);

-- 4. SECURITY & PERMISSION HARDENING: REVOKE DIRECT DML FROM AUTHENTICATED
REVOKE INSERT, UPDATE, DELETE ON public.invoice_reconciliations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_credit_ledgers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_component_allocations FROM authenticated;

GRANT SELECT ON public.invoice_reconciliations TO authenticated;
GRANT SELECT ON public.student_credit_ledgers TO authenticated;
GRANT SELECT ON public.payment_component_allocations TO authenticated;

COMMIT;
