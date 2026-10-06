-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.5: Tooling Preview & Selective Manual Backfill (No Auto-Run)
-- ============================================================================

BEGIN;

-- 1. READ-ONLY AUDIT & CLASSIFICATION FUNCTION
CREATE OR REPLACE FUNCTION public.fn_preview_backfill_registrations()
RETURNS TABLE (
    registration_id UUID,
    registration_number VARCHAR,
    student_name VARCHAR,
    student_nim VARCHAR,
    registration_status VARCHAR,
    has_invoice BOOLEAN,
    invoice_number VARCHAR,
    invoice_status VARCHAR,
    has_payments BOOLEAN,
    has_lip BOOLEAN,
    has_salut_snapshot BOOLEAN,
    classification_group VARCHAR,
    recommended_action VARCHAR
) AS $$
BEGIN
    SET search_path = public, pg_temp;

    RETURN QUERY
    SELECT 
        r.id AS registration_id,
        r.registration_number,
        s.full_name AS student_name,
        s.nim AS student_nim,
        r.status AS registration_status,
        (i.id IS NOT NULL) AS has_invoice,
        i.invoice_number,
        i.status AS invoice_status,
        EXISTS(SELECT 1 FROM public.student_payments sp JOIN public.payment_allocations pa ON pa.payment_id = sp.id WHERE pa.invoice_id = i.id) AS has_payments,
        EXISTS(SELECT 1 FROM public.lip_documents ld WHERE ld.registration_id = r.id) AS has_lip,
        EXISTS(SELECT 1 FROM public.registration_fee_snapshots rfs JOIN public.fee_types ft ON rfs.fee_type_id = ft.id WHERE rfs.registration_id = r.id AND ft.code = 'SALUT_SERVICE') AS has_salut_snapshot,
        CASE
            -- Grup F: Uji coba / anomali eksplisit
            WHEN s.full_name ILIKE '%dixit%' OR s.full_name ILIKE '%test%' THEN 'GROUP_F_TEST_DUMMY'
            -- Grup C: Sudah memiliki invoice aktif
            WHEN i.id IS NOT NULL THEN 'GROUP_C_HAS_INVOICE'
            -- Grup B: Belum memiliki invoice tapi memiliki pembayaran/LIP
            WHEN i.id IS NULL AND (EXISTS(SELECT 1 FROM public.lip_documents ld WHERE ld.registration_id = r.id)) THEN 'GROUP_B_NO_INV_HAS_LIP'
            -- Grup A: Registrasi aktif murni tanpa invoice & tanpa pembayaran
            WHEN i.id IS NULL AND r.status = 'active' THEN 'GROUP_A_ELIGIBLE_TARGET'
            ELSE 'GROUP_E_OTHER'
        END AS classification_group,
        CASE
            WHEN s.full_name ILIKE '%dixit%' OR s.full_name ILIKE '%test%' THEN 'MANUAL_REVIEW_PRESERVE'
            WHEN i.id IS NOT NULL THEN 'PRESERVE_DO_NOT_TOUCH'
            WHEN i.id IS NULL AND r.status = 'active' THEN 'READY_FOR_SELECTIVE_BACKFILL'
            ELSE 'PRESERVE'
        END AS recommended_action
    FROM public.registrations r
    JOIN public.students s ON r.student_id = s.id
    LEFT JOIN public.invoices i ON r.id = i.registration_id AND i.status <> 'cancelled'
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. MANUAL SELECTIVE BACKFILL RPC (IDEMPOTENT & AUDITED)
CREATE OR REPLACE FUNCTION public.fn_execute_selective_backfill(
    p_target_registration_ids UUID[],
    p_audit_note TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_target_id UUID;
    v_count INT := 0;
    v_reg RECORD;
    v_salut_setting JSONB;
    v_salut_amount BIGINT;
    v_salut_type_id UUID;
    v_new_inv_id UUID;
    v_est_ut BIGINT;
BEGIN
    SET search_path = public, pg_temp;
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada.'; END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Hanya Owner dan Admin yang berwenang mengeksekusi backfill manual.';
    END IF;

    -- Validasi setting SALUT
    SELECT value INTO v_salut_setting FROM public.app_settings WHERE key = 'default_salut_fee';
    v_salut_amount := (v_salut_setting->>'amount')::BIGINT;
    SELECT id INTO v_salut_type_id FROM public.fee_types WHERE code = 'SALUT_SERVICE' AND is_active = true;

    FOREACH v_target_id IN ARRAY p_target_registration_ids
    LOOP
        -- Lock registration
        SELECT id, student_id, status INTO v_reg
        FROM public.registrations
        WHERE id = v_target_id AND status = 'active' FOR UPDATE;

        IF v_reg.id IS NOT NULL THEN
            -- Pastikan belum memiliki invoice aktif (Idempotency)
            IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE registration_id = v_reg.id AND status <> 'cancelled') THEN
                
                -- Hitung estimasi UT dari snapshot yang ada
                SELECT COALESCE(SUM(total_amount), 0) INTO v_est_ut
                FROM public.registration_fee_snapshots
                WHERE registration_id = v_reg.id AND (fee_type_id <> v_salut_type_id OR v_salut_type_id IS NULL);

                -- Buat Invoice
                INSERT INTO public.invoices (
                    registration_id, lip_document_id, billing_phase, estimated_ut_amount,
                    official_lip_amount, variance_amount, issued_at, status, notes,
                    created_by, updated_by
                ) VALUES (
                    v_reg.id, NULL, 'snapshot_estimate', v_est_ut,
                    NULL, 0, CURRENT_DATE, 'unpaid',
                    'Backfill Tagihan Registrasi: ' || COALESCE(p_audit_note, 'Persetujuan Owner'),
                    v_actor_id, v_actor_id
                ) RETURNING id INTO v_new_inv_id;

                -- Salin snapshot ke invoice_items
                INSERT INTO public.invoice_items (
                    invoice_id, item_type, fee_type_id, description, quantity, unit_amount, amount, source_type
                )
                SELECT 
                    v_new_inv_id,
                    CASE WHEN rfs.fee_type_id = v_salut_type_id THEN 'service_fee' ELSE 'ut_liability' END,
                    rfs.fee_type_id,
                    rfs.fee_name_snapshot,
                    rfs.quantity,
                    rfs.unit_amount,
                    rfs.total_amount,
                    'registration_snapshot'
                FROM public.registration_fee_snapshots rfs
                WHERE rfs.registration_id = v_reg.id;

                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Catat ke audit log
    INSERT INTO public.audit_logs (
        module, action, actor_id, details
    ) VALUES (
        'BILLING_BACKFILL',
        'SELECTIVE_BACKFILL_EXECUTED',
        v_actor_id,
        jsonb_build_object(
            'target_count', array_length(p_target_registration_ids, 1),
            'processed_count', v_count,
            'audit_note', p_audit_note
        )
    );

    RETURN jsonb_build_object('success', true, 'processed_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMIT;
