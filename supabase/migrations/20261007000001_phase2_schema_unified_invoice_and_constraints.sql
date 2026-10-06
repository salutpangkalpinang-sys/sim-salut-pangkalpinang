-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.1: Unified Invoice Schema, Nullable LIP & Billing Phase Tracking
-- ============================================================================

BEGIN;

-- 1. Make lip_document_id NULLABLE to allow initial Registration Invoice before LIP is issued
ALTER TABLE public.invoices 
ALTER COLUMN lip_document_id DROP NOT NULL;

-- 2. Add billing lifecycle & reconciliation columns on invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS billing_phase VARCHAR(30) DEFAULT 'snapshot_estimate' NOT NULL 
    CHECK (billing_phase IN ('snapshot_estimate', 'lip_reconciled')),
ADD COLUMN IF NOT EXISTS estimated_ut_amount BIGINT DEFAULT 0 NOT NULL CHECK (estimated_ut_amount >= 0),
ADD COLUMN IF NOT EXISTS official_lip_amount BIGINT NULL CHECK (official_lip_amount >= 0),
ADD COLUMN IF NOT EXISTS variance_amount BIGINT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Update Partial Unique Indexes for Invoices
-- Drop legacy unique index that enforced 1 invoice per lip
DROP INDEX IF EXISTS public.idx_invoice_unique_active_per_lip;

-- New Partial Index: Max 1 active invoice per LIP when LIP is linked
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_active_per_lip 
ON public.invoices (lip_document_id) 
WHERE status <> 'cancelled' AND lip_document_id IS NOT NULL;

-- New Partial Index: Max 1 active invoice per Registration (prevents duplicate billing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_active_per_reg
ON public.invoices (registration_id)
WHERE status <> 'cancelled';

-- 4. Register feature flag for Unified Invoice in app_settings (Default false in local phase)
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'feature_unified_invoice_enabled',
    '{"enabled": true}',
    'Feature flag penagihan terpadu sejak registrasi (Unified Registration Invoice)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
