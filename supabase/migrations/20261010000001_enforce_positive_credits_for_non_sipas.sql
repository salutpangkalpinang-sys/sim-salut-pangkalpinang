-- Migration: Enforce positive credits and mandatory UT tariff integrity on registrations
-- Maintains existing signature, RBAC, grants, and calculation mechanisms.

CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id uuid,
    p_academic_period_id uuid,
    p_registration_type_id uuid,
    p_study_program_id uuid,
    p_service_scheme_id uuid,
    p_credits integer,
    p_notes text,
    p_fee_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_scheme_code VARCHAR(50);
    v_scheme_name VARCHAR(100);
    v_is_non_sipas BOOLEAN := false;
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
    v_ut_mandatory_count INT := 0;
    v_has_per_sks_rate BOOLEAN := false;
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

    -- FAIL-CLOSED: Validasi status user aktif
    IF NOT public.is_current_user_active() THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- FAIL-CLOSED: Validasi master skema layanan aktual
    SELECT code, name INTO v_scheme_code, v_scheme_name
    FROM public.service_schemes
    WHERE id = p_service_scheme_id AND is_active = true;

    IF v_scheme_code IS NULL THEN
        RAISE EXCEPTION 'MASTER_DATA_ERROR: Skema layanan dengan ID % tidak aktif atau tidak ditemukan.', p_service_scheme_id;
    END IF;

    IF UPPER(v_scheme_code) LIKE '%NON_SIPAS%' OR UPPER(v_scheme_name) LIKE '%NON-SIPAS%' OR UPPER(v_scheme_name) LIKE '%NON_SIPAS%' THEN
        v_is_non_sipas := true;
    END IF;

    -- FAIL-CLOSED: Jika skema adalah Non-SIPAS, wajibkan SKS bilangan bulat positif (> 0)
    IF v_is_non_sipas THEN
        IF p_credits IS NULL OR p_credits <= 0 THEN
            RAISE EXCEPTION 'INVALID_CREDITS: Skema layanan Non-SIPAS (per SKS) mewajibkan jumlah SKS berupa angka bulat positif (> 0). Nilai SKS saat ini: %.',
                COALESCE(p_credits::text, 'NULL');
        END IF;
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

    -- SERVER-SIDE TARIFF VALIDATION FOR UT COMPONENTS
    -- Validasi seluruh tarif sebelum membuat baris registrations (fail-fast)
    IF p_fee_items IS NOT NULL AND jsonb_typeof(p_fee_items) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_fee_items)
        LOOP
            v_rate_id := (v_item->>'source_fee_rate_id')::UUID;
            IF v_rate_id IS NOT NULL THEN
                SELECT fr.id, fr.name, fr.calculation_type, fr.unit_amount, fr.fee_type_id,
                       fr.study_program_id, fr.service_scheme_id,
                       ft.code AS fee_type_code, ft.category AS fee_category
                INTO v_db_rate
                FROM public.fee_rates fr
                JOIN public.fee_types ft ON fr.fee_type_id = ft.id
                WHERE fr.id = v_rate_id AND fr.is_active = true;

                IF v_db_rate.id IS NULL THEN
                    RAISE EXCEPTION 'INVALID_TARIFF: Master tarif dengan ID % tidak aktif atau tidak ditemukan.', v_rate_id;
                END IF;

                -- Ignore client injection of SALUT_SERVICE
                IF v_db_rate.fee_type_code = 'SALUT_SERVICE' THEN
                    CONTINUE;
                END IF;

                -- Validasi keterikatan tarif terhadap Program Studi
                IF v_db_rate.study_program_id IS NOT NULL AND v_db_rate.study_program_id <> p_study_program_id THEN
                    RAISE EXCEPTION 'INVALID_TARIFF_PRODI: Komponen tarif "%" tidak berlaku untuk program studi yang dipilih.', v_db_rate.name;
                END IF;

                -- Validasi keterikatan tarif terhadap Skema Layanan
                IF v_db_rate.service_scheme_id IS NOT NULL AND v_db_rate.service_scheme_id <> p_service_scheme_id THEN
                    RAISE EXCEPTION 'INVALID_TARIFF_SCHEME: Komponen tarif "%" tidak berlaku untuk skema layanan yang dipilih.', v_db_rate.name;
                END IF;

                -- Cek konsistensi PER_SKS
                IF v_db_rate.calculation_type = 'PER_SKS' THEN
                    IF p_credits IS NULL OR p_credits <= 0 THEN
                        RAISE EXCEPTION 'INVALID_CREDITS: Komponen tarif "%" memerlukan jumlah SKS bilangan bulat positif (> 0). Nilai SKS saat ini: %.',
                            v_db_rate.name, COALESCE(p_credits::text, 'NULL');
                    END IF;
                    v_has_per_sks_rate := true;
                END IF;

                -- Hitung komponen UT resmi
                IF v_db_rate.fee_category = 'UT_OFFICIAL' THEN
                    v_ut_mandatory_count := v_ut_mandatory_count + 1;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- FAIL-CLOSED: Registrasi wajib memiliki komponen kewajiban resmi UT
    IF v_ut_mandatory_count = 0 THEN
        RAISE EXCEPTION 'MANDATORY_UT_TARIFF_MISSING: Registrasi wajib memuat komponen tarif resmi UT sesuai program studi dan skema layanan.';
    END IF;

    -- Khusus skema Non-SIPAS, wajib memuat tarif berjenis PER_SKS
    IF v_is_non_sipas AND NOT v_has_per_sks_rate THEN
        RAISE EXCEPTION 'MANDATORY_UT_TARIFF_MISSING: Skema Non-SIPAS wajib memuat komponen tarif resmi UT berbasis per SKS.';
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

    -- INSERT SNAPSHOTS FOR VALIDATED UT COMPONENTS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fee_items)
    LOOP
        v_rate_id := (v_item->>'source_fee_rate_id')::UUID;
        
        IF v_rate_id IS NOT NULL THEN
            SELECT fr.id, fr.name, fr.calculation_type, fr.unit_amount, fr.fee_type_id, ft.code AS fee_type_code, ft.category AS fee_category
            INTO v_db_rate
            FROM public.fee_rates fr
            JOIN public.fee_types ft ON fr.fee_type_id = ft.id
            WHERE fr.id = v_rate_id AND fr.is_active = true;

            IF v_db_rate.fee_type_code = 'SALUT_SERVICE' THEN
                CONTINUE;
            END IF;

            IF v_db_rate.calculation_type = 'PER_SKS' THEN
                v_item_qty := p_credits;
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
        WHERE registration_id = v_registration_id
          AND fee_type_id <> v_salut_fee_type_id;

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
$function$;

REVOKE ALL ON FUNCTION public.create_registration_with_snapshots(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_registration_with_snapshots(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated, service_role;
