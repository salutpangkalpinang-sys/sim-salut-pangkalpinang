-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.3: Canonical Invoice Calculation & Fail-Closed Registration RPC
-- ============================================================================

BEGIN;

-- 1. CANONICAL INVOICE TOTAL CALCULATION FUNCTION
CREATE OR REPLACE FUNCTION public.get_invoice_canonical_totals(p_invoice_id UUID)
RETURNS TABLE (
    total_billed BIGINT,
    total_service_fee BIGINT,
    total_ut_liability BIGINT,
    total_internal_fee BIGINT,
    total_discount BIGINT
) AS $$
DECLARE
    v_positive BIGINT := 0;
    v_discount BIGINT := 0;
    v_service BIGINT := 0;
    v_ut BIGINT := 0;
    v_internal BIGINT := 0;
BEGIN
    SET search_path = public, pg_temp;

    -- Aggregate positive billed items
    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(CASE WHEN item_type = 'service_fee' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN item_type = 'ut_liability' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN item_type = 'internal_fee' THEN amount ELSE 0 END), 0)
    INTO v_positive, v_service, v_ut, v_internal
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
      AND item_type IN ('service_fee', 'ut_liability', 'internal_fee');

    -- Aggregate approved discount/adjustment reduction items
    SELECT COALESCE(SUM(amount), 0)
    INTO v_discount
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
      AND item_type = 'discount'
      AND (approval_status = 'approved' OR approval_status IS NULL);

    total_billed := GREATEST(0, v_positive - v_discount);
    total_service_fee := v_service;
    total_ut_liability := v_ut;
    total_internal_fee := v_internal;
    total_discount := v_discount;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. RECALCULATE INVOICE STATUS HELPER
CREATE OR REPLACE FUNCTION public.recalculate_invoice_status(p_invoice_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_total_billed BIGINT;
    v_verified_paid BIGINT;
    v_current_status VARCHAR(20);
    v_new_status VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    SELECT total_billed INTO v_total_billed
    FROM public.get_invoice_canonical_totals(p_invoice_id);

    SELECT COALESCE(SUM(pa.amount), 0) INTO v_verified_paid
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = p_invoice_id AND sp.status = 'verified';

    SELECT status INTO v_current_status FROM public.invoices WHERE id = p_invoice_id;

    IF v_current_status = 'cancelled' THEN
        RETURN 'cancelled';
    END IF;

    IF v_verified_paid = 0 THEN
        v_new_status := 'unpaid';
    ELSIF v_verified_paid < v_total_billed THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'paid';
    END IF;

    UPDATE public.invoices
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    RETURN v_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 3. FAIL-CLOSED REGISTRATION RPC WITH UNIFIED INVOICE CREATION
CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_study_program_id UUID,
    p_service_scheme_id UUID,
    p_credits INTEGER,
    p_notes TEXT,
    p_fee_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_salut_setting JSONB;
    v_salut_amount BIGINT;
    v_salut_fee_type_id UUID;
    v_invoice_id UUID;
    v_estimated_ut BIGINT := 0;
    v_item JSONB;
    v_rate_id UUID;
    v_db_rate RECORD;
    v_item_qty INT;
    v_item_unit_amt BIGINT;
    v_item_total_amt BIGINT;
    v_flag_setting JSONB;
    v_unified_enabled BOOLEAN := false;
BEGIN
    SET search_path = public, pg_temp;

    -- Strict Server-Side Authentication
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    -- Strict RBAC verification
    v_actor_role := public.get_current_user_role();
    IF v_actor_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin membuat registrasi.', v_actor_role;
    END IF;

    -- FAIL-CLOSED: Validasi format & nominal app_settings.default_salut_fee
    SELECT value INTO v_salut_setting FROM public.app_settings WHERE key = 'default_salut_fee';
    IF v_salut_setting IS NULL OR NOT (v_salut_setting ? 'amount') THEN
        RAISE EXCEPTION 'CONFIG_ERROR: app_settings.default_salut_fee tidak ditemukan atau format tidak valid. Transaksi dibatalkan.';
    END IF;

    BEGIN
        v_salut_amount := (v_salut_setting->>'amount')::BIGINT;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'CONFIG_ERROR: Nilai default_salut_fee bukan berupa integer nominal yang valid. Transaksi dibatalkan.';
    END;

    IF v_salut_amount IS NULL OR v_salut_amount <= 0 THEN
        RAISE EXCEPTION 'CONFIG_ERROR: Nominal default_salut_fee harus berupa nilai positif (> 0). Transaksi dibatalkan.';
    END IF;

    -- FAIL-CLOSED: Validasi aktif fee_type SALUT_SERVICE
    SELECT id INTO v_salut_fee_type_id FROM public.fee_types WHERE code = 'SALUT_SERVICE' AND is_active = true;
    IF v_salut_fee_type_id IS NULL THEN
        RAISE EXCEPTION 'MASTER_DATA_ERROR: Jenis biaya SALUT_SERVICE tidak ditemukan atau tidak aktif. Transaksi dibatalkan.';
    END IF;

    -- Check feature flag
    SELECT value INTO v_flag_setting FROM public.app_settings WHERE key = 'feature_unified_invoice_enabled';
    IF v_flag_setting IS NOT NULL AND (v_flag_setting->>'enabled')::BOOLEAN = true THEN
        v_unified_enabled := true;
    END IF;

    -- Generate Registration Header
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
        COALESCE(p_credits, 0),
        'active',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_registration_id;

    -- SERVER-SIDE TARIFF VALIDATION FOR UT COMPONENTS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fee_items)
    LOOP
        v_rate_id := (v_item->>'source_fee_rate_id')::UUID;
        
        -- Ignore client injection if client attempts to send SALUT_SERVICE rate
        IF v_rate_id IS NOT NULL THEN
            SELECT fr.id, fr.name, fr.calculation_type, fr.unit_amount, fr.fee_type_id, ft.code AS fee_type_code, ft.category AS fee_category
            INTO v_db_rate
            FROM public.fee_rates fr
            JOIN public.fee_types ft ON fr.fee_type_id = ft.id
            WHERE fr.id = v_rate_id AND fr.is_active = true;

            IF v_db_rate.id IS NULL THEN
                RAISE EXCEPTION 'INVALID_TARIFF: Master tarif dengan ID % tidak aktif atau tidak ditemukan.', v_rate_id;
            END IF;

            -- Reject client injection of SALUT_SERVICE
            IF v_db_rate.fee_type_code = 'SALUT_SERVICE' THEN
                CONTINUE;
            END IF;

            -- Calculate server-side
            IF v_db_rate.calculation_type = 'PER_SKS' THEN
                v_item_qty := GREATEST(1, COALESCE(p_credits, 1));
            ELSE
                v_item_qty := GREATEST(1, (v_item->>'quantity')::INTEGER);
            END IF;

            v_item_unit_amt := v_db_rate.unit_amount;
            v_item_total_amt := v_item_qty * v_item_unit_amt;

            v_estimated_ut := v_estimated_ut + v_item_total_amt;

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
                v_db_rate.id,
                v_db_rate.fee_type_id,
                v_db_rate.name,
                v_db_rate.calculation_type,
                v_item_qty,
                v_item_unit_amt,
                v_item_total_amt,
                'Master Rate Snapshot',
                v_item->>'notes'
            );
        END IF;
    END LOOP;

    -- INJECT SALUT_SERVICE SNAPSHOT (Immutable historical copy)
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
        NULL,
        v_salut_fee_type_id,
        'Biaya Layanan & Pendampingan SALUT',
        'FIXED',
        1,
        v_salut_amount,
        v_salut_amount,
        'System Setting Snapshot',
        'Otomatis dari Sistem'
    );

    -- UNIFIED INVOICE CREATION (If feature flag enabled)
    IF v_unified_enabled THEN
        INSERT INTO public.invoices (
            registration_id,
            lip_document_id,
            billing_phase,
            estimated_ut_amount,
            official_lip_amount,
            variance_amount,
            issued_at,
            status,
            notes,
            created_by,
            updated_by
        ) VALUES (
            v_registration_id,
            NULL,
            'snapshot_estimate',
            v_estimated_ut,
            NULL,
            0,
            CURRENT_DATE,
            'unpaid',
            'Tagihan Rincian Biaya Registrasi Semester',
            v_actor_id,
            v_actor_id
        ) RETURNING id INTO v_invoice_id;

        -- Copy UT items to invoice_items
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            fee_type_id,
            description,
            quantity,
            unit_amount,
            amount,
            source_type
        )
        SELECT 
            v_invoice_id,
            'ut_liability',
            fee_type_id,
            fee_name_snapshot,
            quantity,
            unit_amount,
            total_amount,
            'registration_snapshot'
        FROM public.registration_fee_snapshots
        WHERE registration_id = v_registration_id AND fee_type_id <> v_salut_fee_type_id;

        -- Copy SALUT service fee to invoice_items
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            fee_type_id,
            description,
            quantity,
            unit_amount,
            amount,
            source_type
        ) VALUES (
            v_invoice_id,
            'service_fee',
            v_salut_fee_type_id,
            'Biaya Layanan & Pendampingan SALUT',
            1,
            v_salut_amount,
            v_salut_amount,
            'registration_snapshot'
        );
    END IF;

    RETURN v_registration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMIT;
