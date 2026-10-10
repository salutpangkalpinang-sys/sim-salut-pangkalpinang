-- =============================================================================
-- pgTAP Test Suite: Candidate NIM Submission & Assignment Workflow
-- File: supabase/tests/09_nim_submission_and_assignment_workflow.sql
--
-- Coverage:
--   1. Penolakan pengajuan jika komisi SALUT belum memenuhi kewajiban (Rp 0 atau < kewajiban)
--   2. Pembayaran tepat komisi SALUT (misal Rp 400.000) memenuhi syarat dan sukses dicatat
--   3. Cegah pengajuan aktif ganda pada calon mahasiswa yang sama (ALREADY_SUBMITTED)
--   4. Reversal pembayaran menurunkan saldo komisi netto di bawah kewajiban (reversal warning scenario)
--   5. Multi-invoice: Pembayaran pada invoice A tidak menghitung kelayakan invoice B
--   6. assign_official_nim memperbarui record mahasiswa in-place (UUID tetap), mengubah status CALON -> AKTIF, mencatat riwayat & audit
--   7. assign_official_nim menolak NIM duplikat dan mempertahankan leading zero
-- =============================================================================

BEGIN;
RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT plan(28);

DO $$
DECLARE
    c_uid_admin CONSTANT UUID := '90000001-0000-0000-0000-000000000001'::UUID;
    v_role_admin_id UUID;
    v_status_calon_id UUID;
    v_status_aktif_id UUID;

    -- Mahasiswa Fixture
    v_std1_id UUID := '91000001-0000-0000-0000-000000000001'::UUID;
    v_std2_id UUID := '91000001-0000-0000-0000-000000000002'::UUID;

    -- Master options
    v_period_id UUID;
    v_reg_type_id UUID;
    v_prodi_id UUID;
    v_scheme_id UUID;
    v_fee_type_ut UUID;
    v_fee_type_salut UUID;
    v_pay_method_id UUID;
    v_cash_acc_id UUID;

    -- Registration & Invoices
    v_reg1_id UUID := '92000001-0000-0000-0000-000000000001'::UUID;
    v_inv1_id UUID := '93000001-0000-0000-0000-000000000001'::UUID;
    v_item1_ut UUID := '94000001-0000-0000-0000-000000000001'::UUID;
    v_item1_salut UUID := '94000001-0000-0000-0000-000000000002'::UUID;

    -- Registration & Invoice 2 for multi-invoice test
    v_reg2_id UUID := '92000001-0000-0000-0000-000000000002'::UUID;
    v_inv2_id UUID := '93000001-0000-0000-0000-000000000002'::UUID;
    v_item2_salut UUID := '94000001-0000-0000-0000-000000000003'::UUID;

    v_pay1_id UUID := '95000001-0000-0000-0000-000000000001'::UUID;
    v_pca1_salut UUID := '96000001-0000-0000-0000-000000000001'::UUID;
    v_pca1_ut UUID := '96000001-0000-0000-0000-000000000002'::UUID;

    v_res JSONB;
BEGIN
    SELECT id INTO v_role_admin_id FROM public.roles WHERE code = 'admin';
    SELECT id INTO v_status_calon_id FROM public.student_statuses WHERE code = 'CALON';
    SELECT id INTO v_status_aktif_id FROM public.student_statuses WHERE code = 'AKTIF';
    SELECT id INTO v_period_id FROM public.academic_periods WHERE is_active = true LIMIT 1;
    SELECT id INTO v_reg_type_id FROM public.registration_types WHERE is_active = true LIMIT 1;
    SELECT id INTO v_prodi_id FROM public.study_programs WHERE is_active = true LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes WHERE is_active = true LIMIT 1;
    SELECT id INTO v_fee_type_ut FROM public.fee_types WHERE category = 'UT_OFFICIAL' LIMIT 1;
    SELECT id INTO v_fee_type_salut FROM public.fee_types WHERE category = 'SALUT_INTERNAL' LIMIT 1;
    SELECT id INTO v_pay_method_id FROM public.payment_methods LIMIT 1;
    SELECT id INTO v_cash_acc_id FROM public.cash_accounts LIMIT 1;

    -- Setup Admin Actor
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (c_uid_admin, 'admin_nim_test@salut.local', '{"full_name":"Admin NIM Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_uid_admin, 'Admin NIM Test', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    DELETE FROM public.user_roles WHERE user_id = c_uid_admin;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_uid_admin, v_role_admin_id);

    -- Setup Unauthorized Actor (finance_admin - not owner/admin/academic_admin)
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES ('90000001-0000-0000-0000-000000000002'::UUID, 'unauth_nim_test@salut.local', '{"full_name":"Finance Unauth NIM Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES ('90000001-0000-0000-0000-000000000002'::UUID, 'Finance Unauth NIM Test', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    DELETE FROM public.user_roles WHERE user_id = '90000001-0000-0000-0000-000000000002'::UUID;
    INSERT INTO public.user_roles (user_id, role_id) VALUES ('90000001-0000-0000-0000-000000000002'::UUID, (SELECT id FROM public.roles WHERE code = 'finance_admin'));

    -- Setup Inactive Admin Actor (is_active = false)
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES ('90000001-0000-0000-0000-000000000003'::UUID, 'inactive_nim_test@salut.local', '{"full_name":"Inactive Admin NIM Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES ('90000001-0000-0000-0000-000000000003'::UUID, 'Inactive Admin NIM Test', false)
    ON CONFLICT (id) DO UPDATE SET is_active = false;

    DELETE FROM public.user_roles WHERE user_id = '90000001-0000-0000-0000-000000000003'::UUID;
    INSERT INTO public.user_roles (user_id, role_id) VALUES ('90000001-0000-0000-0000-000000000003'::UUID, v_role_admin_id);

    -- Setup User with NULL role (active user but no roles assigned)
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES ('90000001-0000-0000-0000-000000000004'::UUID, 'nullrole_nim_test@salut.local', '{"full_name":"Null Role NIM Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES ('90000001-0000-0000-0000-000000000004'::UUID, 'Null Role NIM Test', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    DELETE FROM public.user_roles WHERE user_id = '90000001-0000-0000-0000-000000000004'::UUID;

    -- Setup Calon Mahasiswa 1
    INSERT INTO public.students (id, nim, nik, full_name, study_program_id, service_scheme_id, status_id, created_by, updated_by)
    VALUES (v_std1_id, NULL, '3100000000000001', 'Calon Mahasiswa Uji NIM 1', v_prodi_id, v_scheme_id, v_status_calon_id, c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    -- Setup Calon Mahasiswa 2 (for duplicate check)
    INSERT INTO public.students (id, nim, nik, full_name, study_program_id, service_scheme_id, status_id, created_by, updated_by)
    VALUES (v_std2_id, NULL, '3100000000000002', 'Calon Mahasiswa Uji NIM 2', v_prodi_id, v_scheme_id, v_status_calon_id, c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    -- Registration 1
    INSERT INTO public.registrations (id, registration_number, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status, created_by, updated_by)
    VALUES (v_reg1_id, 'REG-TEST-NIM-01', v_std1_id, v_period_id, v_reg_type_id, v_prodi_id, v_scheme_id, 24, 'active', c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    -- Invoice 1: Total Rp 1.264.000 (UT: Rp 864.000, SALUT: Rp 400.000)
    INSERT INTO public.invoices (id, invoice_number, registration_id, estimated_ut_amount, status, created_by, updated_by)
    VALUES (v_inv1_id, 'INV-TEST-NIM-01', v_reg1_id, 864000, 'unpaid', c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_items (id, invoice_id, item_type, fee_type_id, description, quantity, unit_amount, amount)
    VALUES 
    (v_item1_ut, v_inv1_id, 'ut_liability', v_fee_type_ut, 'Biaya Mata Kuliah UT', 24, 36000, 864000),
    (v_item1_salut, v_inv1_id, 'service_fee', v_fee_type_salut, 'Biaya Layanan SALUT', 1, 400000, 400000)
    ON CONFLICT (id) DO NOTHING;

    -- Registration 2 & Invoice 2 (Different invoice on same student for multi-invoice testing)
    INSERT INTO public.registrations (id, registration_number, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status, created_by, updated_by)
    VALUES (v_reg2_id, 'REG-TEST-NIM-02', v_std1_id, v_period_id, v_reg_type_id, v_prodi_id, v_scheme_id, 20, 'active', c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoices (id, invoice_number, registration_id, estimated_ut_amount, status, created_by, updated_by)
    VALUES (v_inv2_id, 'INV-TEST-NIM-02', v_reg2_id, 720000, 'unpaid', c_uid_admin, c_uid_admin)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_items (id, invoice_id, item_type, fee_type_id, description, quantity, unit_amount, amount)
    VALUES (v_item2_salut, v_inv2_id, 'service_fee', v_fee_type_salut, 'Biaya Layanan SALUT Inv 2', 1, 400000, 400000)
    ON CONFLICT (id) DO NOTHING;

END $$;

-- Set session context to Admin
SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000001';

-- =============================================================================
-- TEST 1: Penolakan pengajuan jika komisi SALUT belum dibayar (Rp 0 < Rp 400.000)
-- =============================================================================
SAVEPOINT sp_test_1;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '92000001-0000-0000-0000-000000000001'::UUID,
        '93000001-0000-0000-0000-000000000001'::UUID,
        CURRENT_DATE,
        'REF-UT-001',
        'Catatan pengajuan belum bayar'
    );
    $$,
    'CRITERIA_FAILED',
    'Test 1: Pengajuan ditolak jika komisi SALUT belum terbayar'
);
ROLLBACK TO SAVEPOINT sp_test_1;

-- =============================================================================
-- SIMULASI PEMBAYARAN RP 1.000.000 PADA INVOICE 1
-- PCA: SALUT Rp 400.000 (Lunas), UT Rp 600.000
-- =============================================================================
RESET ROLE;
SET search_path = extensions, public, pg_temp;

DO $$
BEGIN
    INSERT INTO public.student_payments (
        id, transaction_number, student_id, payment_method_id, cash_account_id, amount, status, paid_at, created_by, updated_by
    ) VALUES (
        '95000001-0000-0000-0000-000000000001'::UUID, 'PAY-TEST-001', '91000001-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.payment_methods LIMIT 1), (SELECT id FROM public.cash_accounts LIMIT 1), 1000000, 'verified', NOW(), '90000001-0000-0000-0000-000000000001'::UUID, '90000001-0000-0000-0000-000000000001'::UUID
    );

    INSERT INTO public.payment_component_allocations (
        id, payment_id, invoice_id, component_type, entry_type, amount, status, created_by
    ) VALUES 
    ('96000001-0000-0000-0000-000000000001'::UUID, '95000001-0000-0000-0000-000000000001'::UUID, '93000001-0000-0000-0000-000000000001'::UUID, 'service_fee', 'allocation', 400000, 'posted', '90000001-0000-0000-0000-000000000001'::UUID),
    ('96000001-0000-0000-0000-000000000002'::UUID, '95000001-0000-0000-0000-000000000001'::UUID, '93000001-0000-0000-0000-000000000001'::UUID, 'ut_liability', 'allocation', 600000, 'posted', '90000001-0000-0000-0000-000000000001'::UUID);
END $$;

SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000001';

-- =============================================================================
-- TEST 2: Multi-Invoice Isolation: Invoice 2 masih belum bayar walau Invoice 1 sudah bayar
-- =============================================================================
SAVEPOINT sp_test_2;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '92000001-0000-0000-0000-000000000002'::UUID,
        '93000001-0000-0000-0000-000000000002'::UUID,
        CURRENT_DATE,
        'REF-UT-INV2',
        'Coba ajukan inv 2'
    );
    $$,
    'CRITERIA_FAILED',
    'Test 2: Pembayaran pada Invoice 1 tidak boleh meloloskan Invoice 2 yang belum bayar'
);
ROLLBACK TO SAVEPOINT sp_test_2;

-- =============================================================================
-- TEST 3: Sukses Catat Pengajuan pada Invoice 1 (SALUT Rp 400.000 terpenuhi)
-- =============================================================================
SET search_path = extensions, public, pg_temp;
SELECT lives_ok(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '92000001-0000-0000-0000-000000000001'::UUID,
        '93000001-0000-0000-0000-000000000001'::UUID,
        CURRENT_DATE,
        'ADM-UT-2026-0099',
        'Berkas admisi lengkap, diajukan ke UT'
    );
    $$,
    'Test 3: Sukses mencatat pengajuan ke UT saat syarat komisi SALUT terpenuhi'
);

-- =============================================================================
-- TEST 4: Verifikasi status submission tercatat sebagai 'submitted'
-- =============================================================================
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT status FROM public.nim_submissions WHERE student_id = '91000001-0000-0000-0000-000000000001'::UUID LIMIT 1),
    'submitted',
    'Test 4: Status pengajuan aktif adalah submitted'
);

-- =============================================================================
-- TEST 5: Cegah Pengajuan Ganda yang Masih Aktif (ALREADY_SUBMITTED)
-- =============================================================================
SAVEPOINT sp_test_5;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '92000001-0000-0000-0000-000000000001'::UUID,
        '93000001-0000-0000-0000-000000000001'::UUID,
        CURRENT_DATE,
        'ADM-DUPLICATE',
        'Pengajuan ganda'
    );
    $$,
    'ALREADY_SUBMITTED',
    'Test 5: Cegah pencatatan pengajuan aktif ganda pada calon mahasiswa yang sama'
);
ROLLBACK TO SAVEPOINT sp_test_5;

-- =============================================================================
-- TEST 6: Reversal Komisi SALUT tetap mempertahankan catatan pengajuan (tidak hilang)
-- =============================================================================
RESET ROLE;
SET search_path = extensions, public, pg_temp;

-- Catat reversal Rp 400.000 pada service_fee
INSERT INTO public.payment_component_allocations (
    id, payment_id, invoice_id, component_type, entry_type, reversal_of_allocation_id, amount, status, created_by
) VALUES (
    '96000001-0000-0000-0000-000000000003'::UUID, '95000001-0000-0000-0000-000000000001'::UUID, '93000001-0000-0000-0000-000000000001'::UUID,
    'service_fee', 'reversal', '96000001-0000-0000-0000-000000000001'::UUID, 400000, 'posted', '90000001-0000-0000-0000-000000000001'::UUID
);

-- Cek catatan pengajuan tetap ada
SELECT is(
    (SELECT count(*)::INT FROM public.nim_submissions WHERE student_id = '91000001-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 6: Catatan pengajuan tidak hilang meskipun terjadi reversal komisi pembayaran'
);

-- =============================================================================
-- TEST 7: Input NIM Resmi menolak NIM kosong atau format salah
-- =============================================================================
SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000001';

-- =============================================================================
-- TEST 7: Validasi Batas NIM (Kosong, Karakter Ilegal, >30 Karakter)
-- =============================================================================
SAVEPOINT sp_test_7a;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '  ',
        NOW(),
        'Catatan'
    );
    $$,
    'INVALID_NIM',
    'Test 7a: assign_official_nim menolak input NIM kosong/hanya spasi'
);
ROLLBACK TO SAVEPOINT sp_test_7a;

SAVEPOINT sp_test_7b;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '04-8765-4321', -- tanda strip ilegal
        NOW(),
        'Catatan'
    );
    $$,
    'INVALID_NIM_FORMAT',
    'Test 7b: assign_official_nim menolak karakter ilegal selain alfanumerik'
);
ROLLBACK TO SAVEPOINT sp_test_7b;

SAVEPOINT sp_test_7c;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '1234567890123456789012345678901', -- 31 karakter
        NOW(),
        'Catatan'
    );
    $$,
    'INVALID_NIM_LENGTH',
    'Test 7c: assign_official_nim menolak NIM > 30 karakter (31 karakter)'
);
ROLLBACK TO SAVEPOINT sp_test_7c;

-- Uji batas 1-2 karakter dan 30 karakter pada student 2
SAVEPOINT sp_test_7d;
SET search_path = extensions, public, pg_temp;
SELECT lives_ok(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000002'::UUID,
        'AB', -- 2 karakter
        NOW(),
        'NIM 2 karakter sah'
    );
    $$,
    'Test 7d: assign_official_nim menerima NIM pendek 1-2 karakter'
);
ROLLBACK TO SAVEPOINT sp_test_7d;

SAVEPOINT sp_test_7e;
SET search_path = extensions, public, pg_temp;
SELECT lives_ok(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000002'::UUID,
        '123456789012345678901234567890', -- tepat 30 karakter
        NOW(),
        'NIM batas maksimal 30 karakter sah'
    );
    $$,
    'Test 7e: assign_official_nim menerima NIM tepat 30 karakter'
);
ROLLBACK TO SAVEPOINT sp_test_7e;

-- =============================================================================
-- TEST 8: Input NIM Resmi mempertahankan leading zero dan update student in-place
-- =============================================================================
SET search_path = extensions, public, pg_temp;
SELECT lives_ok(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000001'::UUID,
        '0487654321', -- leading zero
        NOW(),
        'NIM resmi terbit dari UT Pusat'
    );
    $$,
    'Test 8: assign_official_nim berhasil menyimpan NIM resmi dengan leading zero'
);

-- =============================================================================
-- TEST 9: Verifikasi Status CALON -> AKTIF, student UUID tetap, dan riwayat status
-- =============================================================================
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT nim FROM public.students WHERE id = '91000001-0000-0000-0000-000000000001'::UUID),
    '0487654321',
    'Test 9a: NIM tersimpan utuh sebagai string dengan nol depan'
);

SELECT is(
    (SELECT s.code FROM public.students st JOIN public.student_statuses s ON s.id = st.status_id WHERE st.id = '91000001-0000-0000-0000-000000000001'::UUID),
    'AKTIF',
    'Test 9b: Status mahasiswa otomatis bermutasi menjadi AKTIF'
);

SELECT is(
    (SELECT count(*)::INT FROM public.student_status_history WHERE student_id = '91000001-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 9c: Riwayat perubahan status tercatat secara atomik'
);

-- =============================================================================
-- TEST 10: Validasi keunikan NIM: Calon 2 ditolak jika mencoba memakai NIM yang sama
-- =============================================================================
SAVEPOINT sp_test_10;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000002'::UUID,
        '0487654321',
        NOW(),
        'Mencoba NIM duplikat'
    );
    $$,
    'NIM_DUPLICATE',
    'Test 10: Menolak penetapan NIM duplikat pada calon mahasiswa lain'
);
ROLLBACK TO SAVEPOINT sp_test_10;

-- =============================================================================
-- TEST 11: Validasi Pembayaran Tepat Sebesar Komisi SALUT (Exact Fee Payment: Rp 400.000)
-- =============================================================================
-- Setup Student 3 & Registration 3 & Invoice 3
DO $$
DECLARE
    v_std3_id UUID := '91000001-0000-0000-0000-000000000003'::UUID;
    v_reg3_id UUID := '92000001-0000-0000-0000-000000000003'::UUID;
    v_inv3_id UUID := '93000001-0000-0000-0000-000000000003'::UUID;
    v_item3_salut UUID := '94000001-0000-0000-0000-000000000004'::UUID;
    v_pay3_id UUID := '95000001-0000-0000-0000-000000000003'::UUID;
    v_pca3_salut UUID := '96000001-0000-0000-0000-000000000004'::UUID;
    v_status_calon_id UUID;
    v_prodi_id UUID;
    v_scheme_id UUID;
    v_fee_type_salut UUID;
BEGIN
    SELECT id INTO v_status_calon_id FROM public.student_statuses WHERE code = 'CALON';
    SELECT id INTO v_prodi_id FROM public.study_programs WHERE is_active = true LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes WHERE is_active = true LIMIT 1;
    SELECT id INTO v_fee_type_salut FROM public.fee_types WHERE category = 'SALUT_INTERNAL' LIMIT 1;

    INSERT INTO public.students (id, nim, nik, full_name, study_program_id, service_scheme_id, status_id)
    VALUES (v_std3_id, NULL, '3100000000000003', 'Calon Mahasiswa Uji Tepat 400k', v_prodi_id, v_scheme_id, v_status_calon_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.registrations (id, registration_number, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status)
    VALUES (v_reg3_id, 'REG-TEST-NIM-03', v_std3_id, (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1), (SELECT id FROM public.registration_types LIMIT 1), v_prodi_id, v_scheme_id, 20, 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoices (id, invoice_number, registration_id, estimated_ut_amount, status)
    VALUES (v_inv3_id, 'INV-TEST-NIM-03', v_reg3_id, 720000, 'unpaid')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_items (id, invoice_id, item_type, fee_type_id, description, quantity, unit_amount, amount)
    VALUES (v_item3_salut, v_inv3_id, 'service_fee', v_fee_type_salut, 'Biaya Layanan SALUT Inv 3', 1, 400000, 400000)
    ON CONFLICT (id) DO NOTHING;

    -- Tepat bayar Rp 400.000
    INSERT INTO public.student_payments (
        id, transaction_number, student_id, payment_method_id, cash_account_id, amount, status, paid_at, created_by, updated_by
    ) VALUES (
        v_pay3_id, 'PAY-TEST-003', v_std3_id,
        (SELECT id FROM public.payment_methods LIMIT 1), (SELECT id FROM public.cash_accounts LIMIT 1), 400000, 'verified', NOW(),
        '90000001-0000-0000-0000-000000000001'::UUID, '90000001-0000-0000-0000-000000000001'::UUID
    );

    INSERT INTO public.payment_component_allocations (
        id, payment_id, invoice_id, component_type, entry_type, amount, status, created_by
    ) VALUES 
    (v_pca3_salut, v_pay3_id, v_inv3_id, 'service_fee', 'allocation', 400000, 'posted', '90000001-0000-0000-0000-000000000001'::UUID);
END $$;

SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000001';
SET search_path = extensions, public, pg_temp;

SELECT lives_ok(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '92000001-0000-0000-0000-000000000003'::UUID,
        '93000001-0000-0000-0000-000000000003'::UUID,
        CURRENT_DATE,
        'EXACT-FEE-001',
        'Pembayaran tepat Rp 400.000 memenuhi syarat'
    );
    $$,
    'Test 11: Pembayaran tepat sebesar komisi SALUT (Rp 400.000) memenuhi syarat dan sukses dicatat'
);

-- =============================================================================
-- TEST 12: PCA Voided Diabaikan (Alokasi berstatus voided tidak menghitung kelayakan)
-- =============================================================================
-- Setup Student 4 & Invoice 4 dengan alokasi Rp 400.000 tetapi berstatus 'voided'
DO $$
DECLARE
    v_std4_id UUID := '91000001-0000-0000-0000-000000000004'::UUID;
    v_reg4_id UUID := '92000001-0000-0000-0000-000000000004'::UUID;
    v_inv4_id UUID := '93000001-0000-0000-0000-000000000004'::UUID;
    v_item4_salut UUID := '94000001-0000-0000-0000-000000000005'::UUID;
    v_pay4_id UUID := '95000001-0000-0000-0000-000000000004'::UUID;
    v_pca4_salut UUID := '96000001-0000-0000-0000-000000000005'::UUID;
    v_status_calon_id UUID;
    v_prodi_id UUID;
    v_scheme_id UUID;
    v_fee_type_salut UUID;
BEGIN
    SELECT id INTO v_status_calon_id FROM public.student_statuses WHERE code = 'CALON';
    SELECT id INTO v_prodi_id FROM public.study_programs WHERE is_active = true LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes WHERE is_active = true LIMIT 1;
    SELECT id INTO v_fee_type_salut FROM public.fee_types WHERE category = 'SALUT_INTERNAL' LIMIT 1;

    INSERT INTO public.students (id, nim, nik, full_name, study_program_id, service_scheme_id, status_id)
    VALUES (v_std4_id, NULL, '3100000000000004', 'Calon Mahasiswa Voided PCA', v_prodi_id, v_scheme_id, v_status_calon_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.registrations (id, registration_number, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status)
    VALUES (v_reg4_id, 'REG-TEST-NIM-04', v_std4_id, (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1), (SELECT id FROM public.registration_types LIMIT 1), v_prodi_id, v_scheme_id, 20, 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoices (id, invoice_number, registration_id, estimated_ut_amount, status)
    VALUES (v_inv4_id, 'INV-TEST-NIM-04', v_reg4_id, 720000, 'unpaid')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_items (id, invoice_id, item_type, fee_type_id, description, quantity, unit_amount, amount)
    VALUES (v_item4_salut, v_inv4_id, 'service_fee', v_fee_type_salut, 'Biaya Layanan SALUT Inv 4', 1, 400000, 400000)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.student_payments (
        id, transaction_number, student_id, payment_method_id, cash_account_id, amount, status, paid_at, created_by, updated_by
    ) VALUES (
        v_pay4_id, 'PAY-TEST-004', v_std4_id,
        (SELECT id FROM public.payment_methods LIMIT 1), (SELECT id FROM public.cash_accounts LIMIT 1), 400000, 'voided', NOW(),
        '90000001-0000-0000-0000-000000000001'::UUID, '90000001-0000-0000-0000-000000000001'::UUID
    );

    -- Alokasi berstatus 'voided'
    INSERT INTO public.payment_component_allocations (
        id, payment_id, invoice_id, component_type, entry_type, amount, status, created_by
    ) VALUES 
    (v_pca4_salut, v_pay4_id, v_inv4_id, 'service_fee', 'allocation', 400000, 'voided', '90000001-0000-0000-0000-000000000001'::UUID);
END $$;

SAVEPOINT sp_test_12;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000004'::UUID,
        '92000001-0000-0000-0000-000000000004'::UUID,
        '93000001-0000-0000-0000-000000000004'::UUID,
        CURRENT_DATE,
        'VOID-PCA-001',
        'Uji alokasi voided harus ditolak'
    );
    $$,
    'CRITERIA_FAILED',
    'Test 12: Alokasi berstatus voided diabaikan sehingga pengajuan tetap ditolak'
);
ROLLBACK TO SAVEPOINT sp_test_12;

-- =============================================================================
-- TEST 13: Role Tidak Berwenang Ditolak (Finance Admin Ditolak Menjalankan RPC)
-- =============================================================================
SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000002';

SAVEPOINT sp_test_13;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '92000001-0000-0000-0000-000000000003'::UUID,
        '93000001-0000-0000-0000-000000000003'::UUID,
        CURRENT_DATE,
        'UNAUTH-001',
        'Finance admin mencoba mengajukan'
    );
    $$,
    'PERMISSION_DENIED',
    'Test 13a: Role tidak berwenang (finance_admin) ditolak saat memanggil record_nim_submission'
);
ROLLBACK TO SAVEPOINT sp_test_13;

SAVEPOINT sp_test_13b;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '0488888888',
        NOW(),
        'Finance admin mencoba input NIM'
    );
    $$,
    'PERMISSION_DENIED',
    'Test 13b: Role tidak berwenang (finance_admin) ditolak saat memanggil assign_official_nim'
);
ROLLBACK TO SAVEPOINT sp_test_13b;

-- =============================================================================
-- TEST 14: Pengguna Nonaktif Ditolak (is_active = false)
-- =============================================================================
SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000003';

SAVEPOINT sp_test_14;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '92000001-0000-0000-0000-000000000003'::UUID,
        '93000001-0000-0000-0000-000000000003'::UUID,
        CURRENT_DATE,
        'INACTIVE-001',
        'Pengguna nonaktif mencoba mengajukan'
    );
    $$,
    'USER_INACTIVE',
    'Test 14a: Pengguna nonaktif ditolak saat memanggil record_nim_submission'
);
ROLLBACK TO SAVEPOINT sp_test_14;

SAVEPOINT sp_test_14b;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '0488888888',
        NOW(),
        'Pengguna nonaktif mencoba input NIM'
    );
    $$,
    'USER_INACTIVE',
    'Test 14b: Pengguna nonaktif ditolak saat memanggil assign_official_nim'
);
ROLLBACK TO SAVEPOINT sp_test_14b;

-- Pengujian Role NULL (Pengguna aktif tanpa role)
SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000004';

SAVEPOINT sp_test_14c;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.record_nim_submission(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '92000001-0000-0000-0000-000000000003'::UUID,
        '93000001-0000-0000-0000-000000000003'::UUID,
        CURRENT_DATE,
        'NULLROLE-001',
        'Pengguna tanpa role mencoba mengajukan'
    );
    $$,
    'PERMISSION_DENIED',
    'Test 14c: Pengguna dengan role NULL ditolak saat memanggil record_nim_submission'
);
ROLLBACK TO SAVEPOINT sp_test_14c;

SAVEPOINT sp_test_14d;
SET search_path = extensions, public, pg_temp;
SELECT throws_matching(
    $$
    SELECT public.assign_official_nim(
        '91000001-0000-0000-0000-000000000003'::UUID,
        '0488888888',
        NOW(),
        'Pengguna tanpa role mencoba input NIM'
    );
    $$,
    'PERMISSION_DENIED',
    'Test 14d: Pengguna dengan role NULL ditolak saat memanggil assign_official_nim'
);
ROLLBACK TO SAVEPOINT sp_test_14d;

-- =============================================================================
-- TEST 15: Kegagalan INSERT Audit Me-Rollback Seluruh Mutasi NIM Secara Atomik
-- (NIM, status, status history, dan submission status kembali utuh seperti semula)
-- =============================================================================
-- Buat trigger kegagalan audit khusus untuk mahasiswa 3
CREATE OR REPLACE FUNCTION pg_temp.fail_audit_for_std3()
RETURNS TRIGGER AS $trg$
BEGIN
    IF NEW.action = 'official_nim_assigned' AND NEW.entity_id = '91000001-0000-0000-0000-000000000003'::UUID THEN
        RAISE EXCEPTION 'SIMULATED_AUDIT_FAILURE: Simulasi kegagalan penyimpanan log audit.';
    END IF;
    RETURN NEW;
END;
$trg$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_fail_audit_std3 ON public.audit_logs;
CREATE TRIGGER trg_test_fail_audit_std3
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.fail_audit_for_std3();

SET LOCAL "request.jwt.claim.sub" = '90000001-0000-0000-0000-000000000001';

DO $$
BEGIN
    BEGIN
        PERFORM public.assign_official_nim(
            '91000001-0000-0000-0000-000000000003'::UUID,
            '0499112233',
            NOW(),
            'Uji kegagalan atomisitas audit'
        );
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Exception tertangkap sesuai skenario
    END;
END $$;

DROP TRIGGER IF EXISTS trg_test_fail_audit_std3 ON public.audit_logs;

SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT nim FROM public.students WHERE id = '91000001-0000-0000-0000-000000000003'::UUID),
    NULL,
    'Test 15a: NIM tetap NULL (mutasi NIM ter-rollback)'
);

SELECT is(
    (SELECT s.code FROM public.students st JOIN public.student_statuses s ON s.id = st.status_id WHERE st.id = '91000001-0000-0000-0000-000000000003'::UUID),
    'CALON',
    'Test 15b: Status mahasiswa tetap CALON (mutasi status ter-rollback)'
);

SELECT is(
    (SELECT count(*)::INT FROM public.student_status_history WHERE student_id = '91000001-0000-0000-0000-000000000003'::UUID),
    0,
    'Test 15c: Riwayat status tidak tersisa (riwayat status ter-rollback)'
);

SELECT is(
    (SELECT status FROM public.nim_submissions WHERE student_id = '91000001-0000-0000-0000-000000000003'::UUID LIMIT 1),
    'submitted',
    'Test 15d: Status pengajuan tetap submitted (tidak berubah completed)'
);

ROLLBACK;
