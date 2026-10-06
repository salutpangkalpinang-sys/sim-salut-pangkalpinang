-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.6: Configure Production Business Default for SALUT Service Fee (Rp 400.000)
-- ============================================================================

BEGIN;

-- 1. Fail-closed format validation function check before applying setting
DO $$
DECLARE
    v_new_setting JSONB := '{"amount": 400000, "currency": "IDR"}'::jsonb;
    v_amount BIGINT;
BEGIN
    -- Ensure format is valid JSON object with positive integer amount
    IF NOT (v_new_setting ? 'amount') THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Setting must contain amount field.';
    END IF;

    v_amount := (v_new_setting->>'amount')::BIGINT;
    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Amount must be a positive integer.';
    END IF;

    -- Upsert configurable business default
    INSERT INTO public.app_settings (key, value, description)
    VALUES (
        'default_salut_fee',
        v_new_setting,
        'Nominal default biaya layanan SALUT per registrasi (Keputusan Bisnis Owner Rp 400.000)'
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = NOW();
END $$;

COMMIT;
