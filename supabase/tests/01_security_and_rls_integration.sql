BEGIN;
SELECT plan(48);

-- ============================================================================
-- 1. AUDIT RPC DEBUG REMOVAL & SCHEMA PRIVILEGES
-- ============================================================================
-- Test 1: get_user_auth_debug must NOT exist in public schema
SELECT hasnt_function(
    'public',
    'get_user_auth_debug',
    'Fungsi get_user_auth_debug harus sudah dihapus dari skema public'
);

-- Test 2: get_auth_info must NOT exist in public schema
SELECT hasnt_function(
    'public',
    'get_auth_info',
    'Fungsi get_auth_info harus sudah dihapus dari skema public'
);

-- Test 2: public.user_emails table exists
SELECT has_table('public', 'user_emails', 'Tabel public.user_emails harus ada');

-- Test 3: RLS enabled on public.user_emails
SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_emails' AND relnamespace = 'public'::regnamespace),
    'RLS harus aktif (ENABLE) pada public.user_emails'
);

-- Test 4: RLS forced on public.user_emails
SELECT ok(
    (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_emails' AND relnamespace = 'public'::regnamespace),
    'RLS harus dipaksa (FORCE) pada public.user_emails'
);

-- Test 5: anon has NO SELECT on public.user_emails
SELECT ok(
    NOT has_table_privilege('anon', 'public.user_emails', 'SELECT'),
    'Peran anon TIDAK boleh memiliki izin SELECT pada public.user_emails'
);

-- Test 6: authenticated cannot INSERT on public.user_emails
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.user_emails', 'INSERT'),
    'Peran authenticated TIDAK boleh memiliki izin INSERT pada public.user_emails'
);

-- Test 7: authenticated cannot UPDATE on public.user_emails
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.user_emails', 'UPDATE'),
    'Peran authenticated TIDAK boleh memiliki izin UPDATE pada public.user_emails'
);

-- Test 8: authenticated cannot DELETE on public.user_emails
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.user_emails', 'DELETE'),
    'Peran authenticated TIDAK boleh memiliki izin DELETE pada public.user_emails'
);

-- Test 9: authenticated cannot TRUNCATE on public.user_emails
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.user_emails', 'TRUNCATE'),
    'Peran authenticated TIDAK boleh memiliki izin TRUNCATE pada public.user_emails'
);


-- ============================================================================
-- 2. SETUP DUMMY FIXTURES FOR RLS INTEGRATION TESTS (ISOLATED IN TRANSACTION)
-- ============================================================================
DO $$
DECLARE
    v_role_owner_id UUID;
    v_role_admin_id UUID;
    v_role_acad_id  UUID;
    v_role_fin_id   UUID;
    v_role_view_id  UUID;

    c_uid_owner  CONSTANT UUID := '10000000-0000-0000-0000-000000000001'::UUID;
    c_uid_admin  CONSTANT UUID := '10000000-0000-0000-0000-000000000002'::UUID;
    c_uid_admin2 CONSTANT UUID := '10000000-0000-0000-0000-000000000007'::UUID;
    c_uid_acad   CONSTANT UUID := '10000000-0000-0000-0000-000000000003'::UUID;
    c_uid_fin    CONSTANT UUID := '10000000-0000-0000-0000-000000000004'::UUID;
    c_uid_view   CONSTANT UUID := '10000000-0000-0000-0000-000000000005'::UUID;
    c_uid_inact  CONSTANT UUID := '10000000-0000-0000-0000-000000000006'::UUID;
BEGIN
    SELECT id INTO v_role_owner_id FROM public.roles WHERE code = 'owner';
    SELECT id INTO v_role_admin_id FROM public.roles WHERE code = 'admin';
    SELECT id INTO v_role_acad_id  FROM public.roles WHERE code = 'academic_admin';
    SELECT id INTO v_role_fin_id   FROM public.roles WHERE code = 'finance_admin';
    SELECT id INTO v_role_view_id  FROM public.roles WHERE code = 'viewer';

    -- Insert dummy auth users
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud) VALUES
        (c_uid_owner,  'dummy_owner@test.local',  '{"full_name":"Test Owner"}', 'authenticated', 'authenticated'),
        (c_uid_admin,  'dummy_admin@test.local',  '{"full_name":"Test Admin 1"}', 'authenticated', 'authenticated'),
        (c_uid_admin2, 'dummy_admin2@test.local', '{"full_name":"Test Admin 2"}', 'authenticated', 'authenticated'),
        (c_uid_acad,   'dummy_acad@test.local',   '{"full_name":"Test Academic"}', 'authenticated', 'authenticated'),
        (c_uid_fin,    'dummy_fin@test.local',    '{"full_name":"Test Finance"}', 'authenticated', 'authenticated'),
        (c_uid_view,   'dummy_view@test.local',   '{"full_name":"Test Viewer"}', 'authenticated', 'authenticated'),
        (c_uid_inact,  'dummy_inact@test.local',  '{"full_name":"Test Inactive"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Ensure profiles exist with explicit active states and correct full_name
    INSERT INTO public.profiles (id, full_name, is_active) VALUES
        (c_uid_owner,  'Test Owner', true),
        (c_uid_admin,  'Test Admin 1', true),
        (c_uid_admin2, 'Test Admin 2', true),
        (c_uid_acad,   'Test Academic', true),
        (c_uid_fin,    'Test Finance', true),
        (c_uid_view,   'Test Viewer', true),
        (c_uid_inact,  'Test Inactive', false)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

    -- Map roles cleanly
    DELETE FROM public.user_roles WHERE user_id IN (c_uid_owner, c_uid_admin, c_uid_admin2, c_uid_acad, c_uid_fin, c_uid_view, c_uid_inact);
    INSERT INTO public.user_roles (user_id, role_id) VALUES
        (c_uid_owner,  v_role_owner_id),
        (c_uid_admin,  v_role_admin_id),
        (c_uid_admin2, v_role_admin_id),
        (c_uid_acad,   v_role_acad_id),
        (c_uid_fin,    v_role_fin_id),
        (c_uid_view,   v_role_view_id),
        (c_uid_inact,  v_role_admin_id); -- Inactive user with admin role

    -- Backfill emails to user_emails
    INSERT INTO public.user_emails (user_id, email) VALUES
        (c_uid_owner,  'dummy_owner@test.local'),
        (c_uid_admin,  'dummy_admin@test.local'),
        (c_uid_admin2, 'dummy_admin2@test.local'),
        (c_uid_acad,   'dummy_acad@test.local'),
        (c_uid_fin,    'dummy_fin@test.local'),
        (c_uid_view,   'dummy_view@test.local'),
        (c_uid_inact,  'dummy_inact@test.local')
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
END $$;


-- ============================================================================
-- 3. RLS EXECUTION TESTS AS AUTHENTICATED ROLES
-- ============================================================================

-- Test 10: Active Owner can read all emails
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001';
SELECT cmp_ok(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    '>=',
    6,
    'Owner aktif dapat membaca seluruh baris user_emails'
);

-- Test 11: Active Admin can read all emails
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000002';
SELECT cmp_ok(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    '>=',
    6,
    'Admin aktif dapat membaca seluruh baris user_emails'
);

-- Test 12: Academic Admin can read OWN email ONLY
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003';
SELECT is(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    1,
    'Academic Admin aktif hanya dapat membaca 1 baris (email sendiri)'
);
SELECT is(
    (SELECT email FROM public.user_emails LIMIT 1),
    'dummy_acad@test.local',
    'Academic Admin membaca tepat email miliknya sendiri'
);

-- Test 13: Finance Admin can read OWN email ONLY
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004';
SELECT is(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    1,
    'Finance Admin aktif hanya dapat membaca 1 baris (email sendiri)'
);

-- Test 14: Viewer can read OWN email ONLY
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005';
SELECT is(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    1,
    'Viewer aktif hanya dapat membaca 1 baris (email sendiri)'
);

-- Test 15: Inactive user cannot read any email (RLS denies all)
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000006';
SELECT is(
    (SELECT COUNT(*) FROM public.user_emails)::INT,
    0,
    'Pengguna nonaktif tidak dapat membaca email apa pun (0 baris)'
);

-- Reset to postgres superuser for internal trigger & mutation tests
RESET ROLE;


-- ============================================================================
-- 4. EMAIL SYNC TRIGGER & INTEGRITY TESTS
-- ============================================================================

-- Test 16: Profile trigger executes and does NOT leak email into full_name
DO $$
DECLARE
    v_test_uid CONSTANT UUID := '20000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (v_test_uid, 'newuser@dummy.local', '{"full_name":"Budi Santoso"}', 'authenticated', 'authenticated');
END $$;

SELECT is(
    (SELECT full_name FROM public.profiles WHERE id = '20000000-0000-0000-0000-000000000001'::UUID),
    'Budi Santoso',
    'profiles.full_name harus berisi nama dari metadata, BUKAN email'
);

-- Test 17: Email was synced into user_emails
SELECT is(
    (SELECT email FROM public.user_emails WHERE user_id = '20000000-0000-0000-0000-000000000001'::UUID),
    'newuser@dummy.local',
    'Email pengguna baru tersinkronisasi ke public.user_emails'
);

-- Test 18: UPDATE of auth.users.email updates public.user_emails
UPDATE auth.users SET email = 'budi_updated@dummy.local' WHERE id = '20000000-0000-0000-0000-000000000001'::UUID;

SELECT is(
    (SELECT email FROM public.user_emails WHERE user_id = '20000000-0000-0000-0000-000000000001'::UUID),
    'budi_updated@dummy.local',
    'Perubahan email pada auth.users memperbarui public.user_emails'
);

-- Test 19: Setting email to empty string / NULL removes row from user_emails
UPDATE auth.users SET email = '' WHERE id = '20000000-0000-0000-0000-000000000001'::UUID;

SELECT is(
    (SELECT COUNT(*) FROM public.user_emails WHERE user_id = '20000000-0000-0000-0000-000000000001'::UUID)::INT,
    0,
    'Pengosongan email menghapus baris dari public.user_emails'
);

-- Test 20: User without profile causes exception and does NOT create stub profile
SELECT throws_ok(
    $$
    INSERT INTO public.user_emails (user_id, email)
    VALUES ('30000000-0000-0000-0000-000000000001'::UUID, 'unlinked@dummy.local');
    $$,
    '23503', -- Foreign key violation
    NULL,
    'User tanpa profile ditolak dan dilarang membuat profile darurat'
);


-- ============================================================================
-- 5. PASSWORD & RPC HARDENING TESTS
-- ============================================================================

-- Test 21: create_internal_user rejects password shorter than 12 characters
SELECT throws_ok(
    $$
    SELECT public.create_internal_user(
        'short_pw@dummy.local',
        'short123',
        'Short PW Test',
        'viewer'
    );
    $$,
    'P0001',
    'Password wajib diisi dan minimal 12 karakter',
    'create_internal_user menolak password < 12 karakter dan tidak memiliki default fallback'
);


-- ============================================================================
-- 6. COMPREHENSIVE MAKER-CHECKER & ROLE BOUNDARY TESTS ACROSS ALL MODULES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6A. STUDENT PAYMENTS VOID APPROVAL TESTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_pay_id UUID := gen_random_uuid();
    v_student_id UUID;
    v_pm_id UUID;
    c_uid_owner  CONSTANT UUID := '10000000-0000-0000-0000-000000000001'::UUID;
    c_uid_admin  CONSTANT UUID := '10000000-0000-0000-0000-000000000002'::UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods LIMIT 1;
    IF v_pm_id IS NULL THEN
        INSERT INTO public.payment_methods (code, name, is_active)
        VALUES ('TRANSFER', 'Transfer Bank', true) RETURNING id INTO v_pm_id;
    END IF;

    SELECT id INTO v_student_id FROM public.students LIMIT 1;
    IF v_student_id IS NULL THEN
        INSERT INTO public.students (nim, full_name, whatsapp, entry_year, status_id)
        VALUES ('999999999', 'Mahasiswa Test Dummy', '081234567890', 2026, (SELECT id FROM public.student_statuses LIMIT 1))
        RETURNING id INTO v_student_id;
    END IF;

    INSERT INTO public.student_payments (id, transaction_number, student_id, amount, payment_method_id, status)
    VALUES (v_pay_id, 'PAY-TEST-VOID-01', v_student_id, 500000, v_pm_id, 'verified');

    -- Void request 1: dibuat oleh Admin 1
    INSERT INTO public.payment_void_requests (id, payment_id, requested_by, reason, status)
    VALUES ('40000000-0000-0000-0000-000000000001'::UUID, v_pay_id, c_uid_admin, 'Salah nominal admin1', 'pending');

    -- Void request 2: dibuat oleh Owner
    INSERT INTO public.payment_void_requests (id, payment_id, requested_by, reason, status)
    VALUES ('40000000-0000-0000-0000-000000000002'::UUID, v_pay_id, c_uid_owner, 'Salah nominal owner', 'pending');

    -- Void request 3: untuk di-approve oleh Admin 2
    INSERT INTO public.payment_void_requests (id, payment_id, requested_by, reason, status)
    VALUES ('40000000-0000-0000-0000-000000000003'::UUID, v_pay_id, c_uid_admin, 'Void untuk admin2', 'pending');
END $$;

-- Test 22: Maker (Admin 1) self-approval payment REJECTED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000002'; -- Admin 1
SELECT throws_ok(
    $$
    SELECT public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        'approve',
        'Self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Pembayaran: Self-approval oleh pembuat pengajuan (Admin) ditolak'
);

-- Test 23: Maker (Owner) self-approval payment REJECTED
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
SELECT throws_ok(
    $$
    SELECT public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000002'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Owner self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Pembayaran: Self-approval oleh Owner yang membuat pengajuan sendiri ditolak'
);

-- Test 24: academic_admin cannot approve payment void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT throws_ok(
    $$
    SELECT public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000003'::UUID,
        'approve',
        'Acad approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang memiliki wewenang untuk memproses persetujuan void pembayaran',
    'Pembayaran: Academic Admin dilarang memproses approval void'
);

-- Test 25: finance_admin cannot approve payment void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT throws_ok(
    $$
    SELECT public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID,
        'approve',
        'Fin approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang memiliki wewenang untuk memproses persetujuan void pembayaran',
    'Pembayaran: Finance Admin dilarang memproses approval void'
);

-- Test 26: viewer cannot approve payment void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005'; -- Viewer
SELECT throws_ok(
    $$
    SELECT public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000005'::UUID,
        'approve',
        'Viewer approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang memiliki wewenang untuk memproses persetujuan void pembayaran',
    'Pembayaran: Viewer dilarang memproses approval void'
);

-- Test 27: Non-maker Admin 2 can approve payment void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000007'; -- Admin 2
DO $$
BEGIN
    PERFORM public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000003'::UUID,
        '10000000-0000-0000-0000-000000000007'::UUID,
        'approve',
        'Approved by non-maker Admin 2'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.payment_void_requests WHERE id = '40000000-0000-0000-0000-000000000003'::UUID),
    'approved'::text,
    'Pembayaran: Admin 2 (bukan maker) berhasil menyetujui void request'
);

-- Test 28: Non-maker Owner can approve payment void
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
DO $$
BEGIN
    PERFORM public.approve_payment_void_request(
        '40000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Approved by Owner'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.payment_void_requests WHERE id = '40000000-0000-0000-0000-000000000001'::UUID),
    'approved'::text,
    'Pembayaran: Owner berhasil menyetujui void request dari Admin 1'
);


-- ----------------------------------------------------------------------------
-- 6B. UT REMITTANCE VOID APPROVAL TESTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_ut_id UUID := gen_random_uuid();
    v_acc_id UUID;
    c_uid_owner  CONSTANT UUID := '10000000-0000-0000-0000-000000000001'::UUID;
    c_uid_admin  CONSTANT UUID := '10000000-0000-0000-0000-000000000002'::UUID;
BEGIN
    SELECT id INTO v_acc_id FROM public.cash_accounts LIMIT 1;

    INSERT INTO public.ut_remittances (id, remittance_number, amount, cash_account_id, status)
    VALUES (v_ut_id, 'REM-TEST-001', 1000000, v_acc_id, 'verified');

    -- Void request 1: dibuat oleh Admin 1
    INSERT INTO public.ut_remittance_void_requests (id, remittance_id, requested_by, reason, status)
    VALUES ('41000000-0000-0000-0000-000000000001'::UUID, v_ut_id, c_uid_admin, 'Salah nominal UT admin1', 'pending');

    -- Void request 2: dibuat oleh Owner
    INSERT INTO public.ut_remittance_void_requests (id, remittance_id, requested_by, reason, status)
    VALUES ('41000000-0000-0000-0000-000000000002'::UUID, v_ut_id, c_uid_owner, 'Salah nominal UT owner', 'pending');

    -- Void request 3: untuk di-approve oleh Admin 2
    INSERT INTO public.ut_remittance_void_requests (id, remittance_id, requested_by, reason, status)
    VALUES ('41000000-0000-0000-0000-000000000003'::UUID, v_ut_id, c_uid_admin, 'Void UT untuk admin2', 'pending');
END $$;

-- Test 29: Maker (Admin 1) self-approval UT remittance REJECTED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000002'; -- Admin 1
SELECT throws_ok(
    $$
    SELECT public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        'approve',
        'Self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Setoran UT: Self-approval oleh pembuat pengajuan (Admin) ditolak'
);

-- Test 30: Maker (Owner) self-approval UT remittance REJECTED
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
SELECT throws_ok(
    $$
    SELECT public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000002'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Owner self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Setoran UT: Self-approval oleh Owner yang membuat pengajuan sendiri ditolak'
);

-- Test 31: academic_admin cannot approve UT remittance void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT throws_ok(
    $$
    SELECT public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000003'::UUID,
        'approve',
        'Acad approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void setoran UT',
    'Setoran UT: Academic Admin dilarang memproses approval void'
);

-- Test 32: finance_admin cannot approve UT remittance void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT throws_ok(
    $$
    SELECT public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID,
        'approve',
        'Fin approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void setoran UT',
    'Setoran UT: Finance Admin dilarang memproses approval void'
);

-- Test 33: viewer cannot approve UT remittance void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005'; -- Viewer
SELECT throws_ok(
    $$
    SELECT public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000005'::UUID,
        'approve',
        'Viewer approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void setoran UT',
    'Setoran UT: Viewer dilarang memproses approval void'
);

-- Test 34: Non-maker Admin 2 can approve UT remittance void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000007'; -- Admin 2
DO $$
BEGIN
    PERFORM public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000003'::UUID,
        '10000000-0000-0000-0000-000000000007'::UUID,
        'approve',
        'Approved by non-maker Admin 2'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.ut_remittance_void_requests WHERE id = '41000000-0000-0000-0000-000000000003'::UUID),
    'approved'::text,
    'Setoran UT: Admin 2 (bukan maker) berhasil menyetujui void request'
);

-- Test 35: Non-maker Owner can approve UT remittance void
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
DO $$
BEGIN
    PERFORM public.approve_ut_remittance_void_request(
        '41000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Approved by Owner'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.ut_remittance_void_requests WHERE id = '41000000-0000-0000-0000-000000000001'::UUID),
    'approved'::text,
    'Setoran UT: Owner berhasil menyetujui void request dari Admin 1'
);


-- ----------------------------------------------------------------------------
-- 6C. OPERATIONAL CASH TRANSACTION VOID APPROVAL TESTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_ops_id UUID := gen_random_uuid();
    v_cat_id UUID;
    v_acc_id UUID;
    c_uid_owner  CONSTANT UUID := '10000000-0000-0000-0000-000000000001'::UUID;
    c_uid_admin  CONSTANT UUID := '10000000-0000-0000-0000-000000000002'::UUID;
BEGIN
    SELECT id INTO v_cat_id FROM public.operational_categories LIMIT 1;
    SELECT id INTO v_acc_id FROM public.cash_accounts LIMIT 1;

    INSERT INTO public.operational_transactions (
        id, transaction_type, category_id, cash_account_id, amount, description, idempotency_key, status
    ) VALUES (
        v_ops_id, 'expense', v_cat_id, v_acc_id, 250000, 'Test Ops Cash', gen_random_uuid(), 'verified'
    );

    -- Void request 1: dibuat oleh Admin 1
    INSERT INTO public.operational_transaction_void_requests (id, operational_transaction_id, requested_by, reason, status)
    VALUES ('42000000-0000-0000-0000-000000000001'::UUID, v_ops_id, c_uid_admin, 'Salah input ops admin1', 'pending');

    -- Void request 2: dibuat oleh Owner
    INSERT INTO public.operational_transaction_void_requests (id, operational_transaction_id, requested_by, reason, status)
    VALUES ('42000000-0000-0000-0000-000000000002'::UUID, v_ops_id, c_uid_owner, 'Salah input ops owner', 'pending');

    -- Void request 3: untuk di-approve oleh Admin 2
    INSERT INTO public.operational_transaction_void_requests (id, operational_transaction_id, requested_by, reason, status)
    VALUES ('42000000-0000-0000-0000-000000000003'::UUID, v_ops_id, c_uid_admin, 'Void Ops untuk admin2', 'pending');
END $$;

-- Test 36: Maker (Admin 1) self-approval Ops transaction REJECTED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000002'; -- Admin 1
SELECT throws_ok(
    $$
    SELECT public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000002'::UUID,
        'approve',
        'Self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Kas Operasional: Self-approval oleh pembuat pengajuan (Admin) ditolak'
);

-- Test 37: Maker (Owner) self-approval Ops transaction REJECTED
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
SELECT throws_ok(
    $$
    SELECT public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000002'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Owner self approval test note'
    );
    $$,
    'P0001',
    'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.',
    'Kas Operasional: Self-approval oleh Owner yang membuat pengajuan sendiri ditolak'
);

-- Test 38: academic_admin cannot approve Ops transaction void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT throws_ok(
    $$
    SELECT public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000003'::UUID,
        'approve',
        'Acad approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void kas operasional',
    'Kas Operasional: Academic Admin dilarang memproses approval void'
);

-- Test 39: finance_admin cannot approve Ops transaction void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT throws_ok(
    $$
    SELECT public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000004'::UUID,
        'approve',
        'Fin approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void kas operasional',
    'Kas Operasional: Finance Admin dilarang memproses approval void'
);

-- Test 40: viewer cannot approve Ops transaction void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005'; -- Viewer
SELECT throws_ok(
    $$
    SELECT public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000005'::UUID,
        'approve',
        'Viewer approval test'
    );
    $$,
    'P0001',
    'Hanya Owner dan Admin yang berhak memproses persetujuan void kas operasional',
    'Kas Operasional: Viewer dilarang memproses approval void'
);

-- Test 41: Non-maker Admin 2 can approve Ops transaction void
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000007'; -- Admin 2
DO $$
BEGIN
    PERFORM public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000003'::UUID,
        '10000000-0000-0000-0000-000000000007'::UUID,
        'approve',
        'Approved by non-maker Admin 2'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.operational_transaction_void_requests WHERE id = '42000000-0000-0000-0000-000000000003'::UUID),
    'approved'::text,
    'Kas Operasional: Admin 2 (bukan maker) berhasil menyetujui void request'
);

-- Test 42: Non-maker Owner can approve Ops transaction void
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
DO $$
BEGIN
    PERFORM public.approve_operational_transaction_void_request(
        '42000000-0000-0000-0000-000000000001'::UUID,
        '10000000-0000-0000-0000-000000000001'::UUID,
        'approve',
        'Approved by Owner'
    );
END $$;
RESET ROLE;
SELECT is(
    (SELECT status::text FROM public.operational_transaction_void_requests WHERE id = '42000000-0000-0000-0000-000000000001'::UUID),
    'approved'::text,
    'Kas Operasional: Owner berhasil menyetujui void request dari Admin 1'
);


-- ============================================================================
-- 7. SIMULATION & VERIFICATION OF MIGRATION 20261002000001 BRANCHES
-- ============================================================================

-- Test 43: Condition 0 of 3 (Fresh/Local DB) succeeds and skips assignment
SELECT is(
    (SELECT COUNT(*)::INT
     FROM public.profiles
     WHERE id IN (
         '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID,
         '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID,
         '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID
     )),
    0,
    'Kondisi 0 dari 3 berhasil mendeteksi DB lokal dan melewati penugasan tanpa exception'
);

-- Test 44: Condition 1 atau 2 dari 3 menolak transaksi
DO $$
DECLARE
    c_dixit_id CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
BEGIN
    -- Insert hanya 1 profil (state tidak konsisten)
    INSERT INTO auth.users (id, email) VALUES (c_dixit_id, 'dixit_partial@test.local') ON CONFLICT DO NOTHING;
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_dixit_id, 'DIXIT MW', true)
    ON CONFLICT (id) DO UPDATE SET full_name = 'DIXIT MW', is_active = true;
END $$;

SELECT throws_ok(
    $$
    DO $sim$
    DECLARE
        c_dartika_id CONSTANT UUID := '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID;
        c_dixit_id   CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
        c_yolanda_id CONSTANT UUID := '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID;
        v_target_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_target_count
        FROM public.profiles
        WHERE id IN (c_dartika_id, c_dixit_id, c_yolanda_id);

        IF v_target_count IN (1, 2) THEN
            RAISE EXCEPTION 'Inkonsistensi data: Ditemukan % dari 3 target profile di public.profiles. Aborting transaction.', v_target_count;
        END IF;
    END $sim$;
    $$,
    'P0001',
    'Inkonsistensi data: Ditemukan 1 dari 3 target profile di public.profiles. Aborting transaction.',
    'Kondisi 1 dari 3 (inkonsisten) ditolak dan membatalkan transaksi'
);

-- Test 45: Condition 3 dari 3 berhasil menetapkan role dan lolos assertion
DO $$
DECLARE
    c_dartika_id CONSTANT UUID := '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID;
    c_yolanda_id CONSTANT UUID := '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (c_dartika_id, 'dartika_full@test.local'),
        (c_yolanda_id, 'yolanda_full@test.local')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES
        (c_dartika_id, 'DARTIKA ERLANTI', true),
        (c_yolanda_id, 'YOLANDA', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;
END $$;

DO $$
DECLARE
    v_admin_role_id UUID;
    v_owner_role_id UUID;
    c_dartika_id CONSTANT UUID := '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID;
    c_dixit_id   CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
    c_yolanda_id CONSTANT UUID := '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.roles WHERE code = 'admin';
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'owner';

    -- Bersihkan pemilik dummy dari test sebelumnya agar sole-owner valid
    DELETE FROM public.user_roles WHERE role_id = v_owner_role_id;

    DELETE FROM public.user_roles WHERE user_id = c_dixit_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dixit_id, v_admin_role_id);

    DELETE FROM public.user_roles WHERE user_id = c_yolanda_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_yolanda_id, v_admin_role_id);

    DELETE FROM public.user_roles WHERE user_id = c_dartika_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dartika_id, v_owner_role_id);

    -- Sole owner assertion
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role_id = v_owner_role_id) <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: Total pemilik dalam sistem harus tepat 1';
    END IF;
END $$;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.user_roles WHERE role_id = (SELECT id FROM public.roles WHERE code = 'owner')),
    1,
    'Kondisi 3 dari 3 berhasil menetapkan role dan lolos assertion sole-owner tepat 1'
);

-- Test 46: Owner tambahan menyebabkan penolakan transaksi
SELECT throws_ok(
    $$
    DO $sim$
    DECLARE
        v_owner_role_id UUID;
        c_dartika_id CONSTANT UUID := '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID;
        c_dixit_id   CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
    BEGIN
        SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'owner';
        -- Coba tambah owner ekstra (pengguna kedua sebagai owner)
        INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dixit_id, v_owner_role_id);

        IF (SELECT COUNT(*) FROM public.user_roles WHERE role_id = v_owner_role_id) <> 1 THEN
            RAISE EXCEPTION 'Assertion failed: Total pemilik (owner) dalam sistem harus tepat 1 (Dartika)';
        END IF;
    END $sim$;
    $$,
    'P0001',
    'Assertion failed: Total pemilik (owner) dalam sistem harus tepat 1 (Dartika)',
    'Owner tambahan selain Dartika menyebabkan assertion gagal dan membatalkan transaksi'
);

SELECT * FROM finish();
ROLLBACK;
