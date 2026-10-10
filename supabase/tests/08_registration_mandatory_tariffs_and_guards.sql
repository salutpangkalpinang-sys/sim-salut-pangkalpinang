-- =============================================================================
-- pgTAP Test Suite: Registration Mandatory Tariffs & Non-SIPAS Credits Guards
-- File: supabase/tests/08_registration_mandatory_tariffs_and_guards.sql
--
-- Coverage:
--   1. Non-SIPAS dengan SKS 0 atau NULL ditolak (INVALID_CREDITS)
--   2. SKS positif tetapi tarif resmi UT dihilangkan/kosong ditolak (MANDATORY_UT_TARIFF_MISSING)
--   3. Tarif valid Non-SIPAS: UT dihitung otoritatif (SKS × tarif per SKS), total tagihan mencakup UT + SALUT
--   4. Paket SIPAS valid: Tagihan paket UKT semester tetap benar dan mencakup UT + SALUT
--   5. Skema Non-SIPAS tanpa komponen tarif per SKS ditolak (MANDATORY_UT_TARIFF_MISSING)
--   6. Tarif spesifik prodi lain yang tidak cocok ditolak (INVALID_TARIFF_PRODI)
-- =============================================================================

BEGIN;
RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT plan(6);

-- =============================================================================
-- SETUP IDENTITAS & MASTER DATA FIXTURE UJI
-- =============================================================================
DO $$
DECLARE
    c_uid_admin CONSTANT UUID := '90000001-0000-0000-0000-000000000001'::UUID;
    v_role_admin_id UUID;
    v_status_id UUID;
    v_student_id UUID := '90000002-0000-0000-0000-000000000001'::UUID;
BEGIN
    SELECT id INTO v_role_admin_id FROM public.roles WHERE code = 'admin';

    -- Setup Admin Actor
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (c_uid_admin, 'admin_guard_test@salut.local', '{"full_name":"Admin Guard Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_uid_admin, 'Admin Guard Test', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    -- Clean up any default viewer role created by handle_new_user trigger
    DELETE FROM public.user_roles WHERE user_id = c_uid_admin;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (c_uid_admin, v_role_admin_id);

    -- Setup Calon/Mahasiswa Test Fixture
    SELECT id INTO v_status_id FROM public.student_statuses WHERE code = 'CALON' LIMIT 1;
    IF v_status_id IS NULL THEN
        SELECT id INTO v_status_id FROM public.student_statuses WHERE code = 'AKTIF' LIMIT 1;
    END IF;

    INSERT INTO public.students (
        id,
        nim,
        nik,
        full_name,
        study_program_id,
        service_scheme_id,
        status_id,
        created_by,
        updated_by
    ) VALUES (
        v_student_id,
        NULL,
        '3201000099990001',
        'Calon Guard Test',
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        v_status_id,
        c_uid_admin,
        c_uid_admin
    ) ON CONFLICT (id) DO NOTHING;

    -- Enable unified invoice feature flag during test
    UPDATE public.app_settings SET value = '{"enabled": true}'::jsonb WHERE key = 'feature_unified_invoice_enabled';
END $$;

-- Switch to admin context
SET LOCAL "request.jwt.claim.sub" TO '90000001-0000-0000-0000-000000000001';

-- =============================================================================
-- TEST 1: Non-SIPAS dengan SKS 0 atau kosong ditolak (INVALID_CREDITS)
-- =============================================================================
SAVEPOINT sp_test_1;
SELECT throws_matching(
    $$
    SELECT public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        0,
        'Uji Non-SIPAS SKS 0',
        jsonb_build_array(
            jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE calculation_type = 'PER_SKS' LIMIT 1), 'quantity', 1)
        )
    );
    $$,
    'INVALID_CREDITS',
    'Test 1: Non-SIPAS dengan SKS 0 ditolak dengan exception INVALID_CREDITS'
);
ROLLBACK TO SAVEPOINT sp_test_1;

-- =============================================================================
-- TEST 2: SKS positif tetapi tarif resmi UT dihilangkan (payload kosong) ditolak
-- =============================================================================
SAVEPOINT sp_test_2;
SELECT throws_matching(
    $$
    SELECT public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        10,
        'Uji Non-SIPAS payload kosong',
        '[]'::jsonb
    );
    $$,
    'MANDATORY_UT_TARIFF_MISSING',
    'Test 2: Non-SIPAS SKS positif tetapi tarif wajib UT dihilangkan ditolak dengan MANDATORY_UT_TARIFF_MISSING'
);
ROLLBACK TO SAVEPOINT sp_test_2;

-- =============================================================================
-- TEST 3: Tarif valid Non-SIPAS: UT = SKS × tarif, ditambah SALUT Rp 400.000
-- =============================================================================
SAVEPOINT sp_test_3;
DO $$
DECLARE
    v_rate_id UUID;
    v_rate_unit BIGINT;
    v_sks INT := 12;
    v_reg_id UUID;
    v_expected_ut BIGINT;
    v_expected_total BIGINT;
    v_inv_id UUID;
    v_actual_ut BIGINT;
    v_actual_total BIGINT;
    v_actual_salut BIGINT;
BEGIN
    SELECT id, unit_amount INTO v_rate_id, v_rate_unit
    FROM public.fee_rates
    WHERE calculation_type = 'PER_SKS' AND is_active = true
    LIMIT 1;

    v_expected_ut := v_sks * v_rate_unit;
    v_expected_total := v_expected_ut + 400000;

    v_reg_id := public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        v_sks,
        'Uji Non-SIPAS 12 SKS Valid',
        jsonb_build_array(
            jsonb_build_object('source_fee_rate_id', v_rate_id, 'quantity', v_sks)
        )
    );

    SELECT id, estimated_ut_amount INTO v_inv_id, v_actual_ut
    FROM public.invoices
    WHERE registration_id = v_reg_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_salut
    FROM public.invoice_items
    WHERE invoice_id = v_inv_id AND item_type = 'service_fee';

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_total
    FROM public.invoice_items
    WHERE invoice_id = v_inv_id;

    IF v_actual_ut <> v_expected_ut THEN
        RAISE EXCEPTION 'MISMATCH_UT: expected %, got %', v_expected_ut, v_actual_ut;
    END IF;

    IF v_actual_total <> v_expected_total THEN
        RAISE EXCEPTION 'MISMATCH_TOTAL: expected %, got %', v_expected_total, v_actual_total;
    END IF;

    IF v_actual_salut <> 400000 THEN
        RAISE EXCEPTION 'MISMATCH_SALUT: expected 400000, got %', v_actual_salut;
    END IF;
END $$;
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(
        SELECT 1 FROM public.registrations r
        JOIN public.invoices i ON i.registration_id = r.id
        WHERE r.notes = 'Uji Non-SIPAS 12 SKS Valid'
          AND i.estimated_ut_amount = 12 * (SELECT unit_amount FROM public.fee_rates WHERE calculation_type = 'PER_SKS' LIMIT 1)
    ),
    'Test 3: Tarif valid Non-SIPAS menghasilkan UT = 12 × tarif per SKS dan total invoice mencakup UT + SALUT'
);
ROLLBACK TO SAVEPOINT sp_test_3;

-- =============================================================================
-- TEST 4: Paket SIPAS tetap benar (nominal UKT paket semester + SALUT)
-- =============================================================================
SAVEPOINT sp_test_4;
DO $$
DECLARE
    v_rate_id UUID;
    v_rate_unit BIGINT;
    v_reg_id UUID;
    v_expected_ut BIGINT;
    v_expected_total BIGINT;
    v_inv_id UUID;
    v_actual_ut BIGINT;
    v_actual_total BIGINT;
    v_actual_salut BIGINT;
BEGIN
    SELECT id, unit_amount INTO v_rate_id, v_rate_unit
    FROM public.fee_rates
    WHERE name LIKE 'UKT 3%' AND is_active = true
    LIMIT 1;

    v_expected_ut := v_rate_unit;
    v_expected_total := v_expected_ut + 400000;

    v_reg_id := public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'SIPAS_NON_TTM' LIMIT 1),
        0,
        'Uji SIPAS Non-TTM Paket Valid',
        jsonb_build_array(
            jsonb_build_object('source_fee_rate_id', v_rate_id, 'quantity', 1)
        )
    );

    SELECT id, estimated_ut_amount INTO v_inv_id, v_actual_ut
    FROM public.invoices
    WHERE registration_id = v_reg_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_salut
    FROM public.invoice_items
    WHERE invoice_id = v_inv_id AND item_type = 'service_fee';

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_total
    FROM public.invoice_items
    WHERE invoice_id = v_inv_id;

    IF v_actual_ut <> v_expected_ut THEN
        RAISE EXCEPTION 'MISMATCH_UT: expected %, got %', v_expected_ut, v_actual_ut;
    END IF;

    IF v_actual_total <> v_expected_total THEN
        RAISE EXCEPTION 'MISMATCH_TOTAL: expected %, got %', v_expected_total, v_actual_total;
    END IF;

    IF v_actual_salut <> 400000 THEN
        RAISE EXCEPTION 'MISMATCH_SALUT: expected 400000, got %', v_actual_salut;
    END IF;
END $$;
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(
        SELECT 1 FROM public.registrations r
        JOIN public.invoices i ON i.registration_id = r.id
        WHERE r.notes = 'Uji SIPAS Non-TTM Paket Valid'
          AND i.estimated_ut_amount = (SELECT unit_amount FROM public.fee_rates WHERE name LIKE 'UKT 3%' LIMIT 1)
    ),
    'Test 4: Paket SIPAS tetap benar menghasilkan tagihan paket UKT semester + SALUT Rp 400.000'
);
ROLLBACK TO SAVEPOINT sp_test_4;

-- =============================================================================
-- TEST 5: Skema Non-SIPAS tetapi hanya diberi tarif paket FIXED tanpa PER_SKS ditolak
-- =============================================================================
SAVEPOINT sp_test_5;
SELECT throws_matching(
    $$
    SELECT public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        10,
        'Uji Non-SIPAS tanpa tarif per SKS',
        jsonb_build_array(
            jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'Biaya Admisi%' LIMIT 1), 'quantity', 1)
        )
    );
    $$,
    'MANDATORY_UT_TARIFF_MISSING',
    'Test 5: Skema Non-SIPAS tanpa komponen tarif per SKS ditolak dengan MANDATORY_UT_TARIFF_MISSING'
);
ROLLBACK TO SAVEPOINT sp_test_5;

-- =============================================================================
-- =============================================================================
-- TEST 6: Tarif spesifik prodi lain yang tidak cocok ditolak (INVALID_TARIFF_PRODI)
-- =============================================================================
SAVEPOINT sp_test_6;
DO $$
DECLARE
    v_prodi2_id UUID;
    v_custom_rate_id UUID;
BEGIN
    SELECT id INTO v_prodi2_id FROM public.study_programs ORDER BY name DESC LIMIT 1;

    INSERT INTO public.fee_rates (
        fee_type_id,
        study_program_id,
        name,
        calculation_type,
        unit_amount,
        is_active,
        verification_status
    ) VALUES (
        (SELECT id FROM public.fee_types WHERE code = 'NON_SIPAS_PER_SKS' LIMIT 1),
        v_prodi2_id,
        'Tarif Khusus Prodi Lain Test',
        'PER_SKS',
        50000,
        true,
        'VERIFIED'
    ) RETURNING id INTO v_custom_rate_id;
END $$;
SET search_path = extensions, public, pg_temp;

SELECT throws_matching(
    $$
    SELECT public.create_registration_with_snapshots(
        '90000002-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
        (SELECT id FROM public.study_programs ORDER BY name LIMIT 1),
        (SELECT id FROM public.service_schemes WHERE code = 'NON_SIPAS' LIMIT 1),
        10,
        'Uji Mismatch Prodi Test',
        jsonb_build_array(
            jsonb_build_object(
                'source_fee_rate_id',
                (SELECT id FROM public.fee_rates WHERE name = 'Tarif Khusus Prodi Lain Test' LIMIT 1),
                'quantity', 10
            )
        )
    );
    $$,
    'INVALID_TARIFF_PRODI',
    'Test 6: Tarif yang terikat ke program studi lain ditolak dengan INVALID_TARIFF_PRODI'
);
ROLLBACK TO SAVEPOINT sp_test_6;

-- Rollback seluruh suite pengujian agar database bersih
ROLLBACK;
