-- =============================================================================
-- pgTAP Test Suite: correct_reconciled_lip RPC
-- File: supabase/tests/05_correct_reconciled_lip.sql
--
-- Skenario coverage lengkap:
--   T01  Koreksi Dixit berhasil, financial summary tepat (7 assertions)
--   T02  Audit log atomik tercatat dengan actor auth.uid(), reason, dan metadata (3 assertions)
--   T03  Retry idempoten (key + payload + LIP sama) mengembalikan idempotent=true (1 assertion)
--   T04  Konflik idempotency (key sama, total sama tapi komposisi rincian beda) ditolak (1 assertion)
--   T05  Expected reconciliation NULL ditolak INVALID_INPUT (1 assertion)
--   T06  Expected reconciliation berubah / mismatch ditolak CONCURRENCY_CONFLICT (1 assertion)
--   T07  Role academic_admin ditolak PERMISSION_DENIED (1 assertion)
--   T08  Role finance_admin ditolak PERMISSION_DENIED (1 assertion)
--   T09  NULL auth.uid() ditolak AUTH_REQUIRED (1 assertion)
--   T10  Role viewer ditolak PERMISSION_DENIED (1 assertion)
--   T11  Akun tidak aktif ditolak USER_INACTIVE (1 assertion)
--   T12  Argumen nominal / LIP NULL ditolak INVALID_INPUT (2 assertions)
--   T13  LIP status paid_to_ut ditolak INVALID_STATE (1 assertion)
--   T14  Koreksi menghasilkan variance <= 0 ditolak OUT_OF_SCOPE (1 assertion)
--   T15  Registrasi sudah memiliki draft setoran UT ditolak REMITTANCE_RESTRICTION (1 assertion)
--   T16  Registrasi / rekonsiliasi memiliki kredit ditolak CREDIT_RESTRICTION (1 assertion)
--   T17  Komposisi invoice_items pasca koreksi: jumlah item, reversal discount, shortage baru (3 assertions)
--   T18  Payment allocations tetap utuh pasca koreksi (1 assertion)
--   T19  Total kanonikal invoice get_invoice_canonical_totals dan status partial (2 assertions)
--   T20  Verifikasi rollback atomik pada transaksi gagal: tidak ada rekonsiliasi yatim (1 assertion)
-- =============================================================================

BEGIN;
SET search_path = extensions, public, pg_temp;
SELECT plan(38);

-- =============================================================================
-- 1. SETUP IDENTITAS RBAC NYATA
-- =============================================================================
DO $$
DECLARE
    v_role_owner_id UUID;
    v_role_academic_id UUID;
    v_role_finance_id UUID;
    v_role_viewer_id UUID;

    c_uid_owner    CONSTANT UUID := 'a0000001-0000-0000-0000-000000000001'::UUID;
    c_uid_academic CONSTANT UUID := 'a0000001-0000-0000-0000-000000000002'::UUID;
    c_uid_finance  CONSTANT UUID := 'a0000001-0000-0000-0000-000000000003'::UUID;
    c_uid_inactive CONSTANT UUID := 'a0000001-0000-0000-0000-000000000004'::UUID;
    c_uid_viewer   CONSTANT UUID := 'a0000001-0000-0000-0000-000000000005'::UUID;
BEGIN
    SELECT id INTO v_role_owner_id FROM public.roles WHERE code = 'owner';
    SELECT id INTO v_role_academic_id FROM public.roles WHERE code = 'academic_admin';
    SELECT id INTO v_role_finance_id FROM public.roles WHERE code = 'finance_admin';
    SELECT id INTO v_role_viewer_id FROM public.roles WHERE code = 'viewer';

    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud) VALUES
        (c_uid_owner,    'test_owner@salut.local',    '{"full_name":"Test Owner"}',    'authenticated', 'authenticated'),
        (c_uid_academic, 'test_academic@salut.local', '{"full_name":"Test Academic"}', 'authenticated', 'authenticated'),
        (c_uid_finance,  'test_finance@salut.local',  '{"full_name":"Test Finance"}',  'authenticated', 'authenticated'),
        (c_uid_inactive, 'test_inactive@salut.local', '{"full_name":"Test Inactive"}', 'authenticated', 'authenticated'),
        (c_uid_viewer,   'test_viewer@salut.local',   '{"full_name":"Test Viewer"}',   'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active) VALUES
        (c_uid_owner,    'Test Owner',    TRUE),
        (c_uid_academic, 'Test Academic', TRUE),
        (c_uid_finance,  'Test Finance',  TRUE),
        (c_uid_inactive, 'Test Inactive', FALSE),
        (c_uid_viewer,   'Test Viewer',   TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

    DELETE FROM public.user_roles WHERE user_id IN (c_uid_owner, c_uid_academic, c_uid_finance, c_uid_inactive, c_uid_viewer);

    INSERT INTO public.user_roles (user_id, role_id) VALUES
        (c_uid_owner,    v_role_owner_id),
        (c_uid_academic, v_role_academic_id),
        (c_uid_finance,  v_role_finance_id),
        (c_uid_inactive, v_role_owner_id),
        (c_uid_viewer,   v_role_viewer_id);
END $$;

-- =============================================================================
-- 2. SETUP DATA MAHASISWA & TRANSAKSI BASELINE DIXIT
-- =============================================================================
DO $$
DECLARE
    v_status_id UUID;
    v_period_id UUID;
    v_type_id UUID;
    v_prog_id UUID;
    v_scheme_id UUID;
    v_method_id UUID;
    v_acc_id UUID;
BEGIN
    SELECT id INTO v_status_id FROM public.student_statuses LIMIT 1;
    SELECT id INTO v_period_id FROM public.academic_periods LIMIT 1;
    SELECT id INTO v_type_id   FROM public.registration_types LIMIT 1;
    SELECT id INTO v_prog_id   FROM public.study_programs LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes LIMIT 1;
    SELECT id INTO v_method_id FROM public.payment_methods LIMIT 1;
    SELECT id INTO v_acc_id    FROM public.cash_accounts LIMIT 1;

    INSERT INTO public.students (id, nim, full_name, status_id)
    VALUES ('feb65abb-49a8-44fe-b76b-196953af577d'::uuid, '053065737', 'Dixit Uji', v_status_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.registrations (id, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status)
    VALUES ('efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
            'feb65abb-49a8-44fe-b76b-196953af577d'::uuid,
            v_period_id, v_type_id, v_prog_id, v_scheme_id, 18, 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.lip_documents (id, registration_id, lip_number, version,
                                       tuition_amount, book_amount, shipping_amount, other_ut_amount,
                                       official_amount, storage_path, original_file_name, mime_type, file_size, status)
    VALUES ('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
            'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
            '20261053065737050022', 1,
            1700000, 0, 117600, 0,
            1817600, '/lip/dixit.pdf', 'dixit.pdf', 'application/pdf', 100, 'verified')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoices (id, registration_id, lip_document_id, invoice_number, status, billing_phase,
                                  official_lip_amount, variance_amount)
    VALUES ('92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid,
            'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
            'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
            'INV-TEST-DIXIT', 'partial', 'lip_reconciled',
            1817600, 517600)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_items (id, invoice_id, item_type, description, quantity, unit_amount, amount, source_type, approval_status)
    VALUES
        ('c0000001-0000-0000-0000-000000000001'::uuid,
         '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid,
         'ut_liability', 'SPP/UKT', 1, 1300000, 1300000, 'registration', 'approved'),
        ('c0000001-0000-0000-0000-000000000002'::uuid,
         '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid,
         'service_fee', 'Komisi SALUT', 1, 400000, 400000, 'registration', 'approved'),
        ('c0000001-0000-0000-0000-000000000003'::uuid,
         '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid,
         'ut_liability', 'Kekurangan LIP (Salah Input)', 1, 517600, 517600, 'lip_reconciliation', 'approved')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.invoice_reconciliations
        (id, invoice_id, registration_id, lip_document_id, idempotency_key,
         estimated_ut_amount, official_lip_amount, variance_amount,
         service_fee_snapshot, verified_paid_at_reconcile,
         shortage_created, credit_created, reconciled_by, status)
    VALUES
        ('14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid,
         '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid,
         'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
         'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
         'e0000001-0000-0000-0000-000000000001'::uuid,
         1300000, 1817600, 517600,
         400000, 1700000,
         517600, 0,
         'a0000001-0000-0000-0000-000000000001'::uuid, 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.student_payments (id, transaction_number, student_id, amount, payment_method_id, cash_account_id, status, verified_by, verified_at)
    VALUES
        ('d0000001-0000-0000-0000-000000000011'::uuid, 'PAY-TEST-011', 'feb65abb-49a8-44fe-b76b-196953af577d'::uuid, 300000, v_method_id, v_acc_id, 'verified', 'a0000001-0000-0000-0000-000000000001'::uuid, NOW()),
        ('d0000001-0000-0000-0000-000000000012'::uuid, 'PAY-TEST-012', 'feb65abb-49a8-44fe-b76b-196953af577d'::uuid, 200000, v_method_id, v_acc_id, 'verified', 'a0000001-0000-0000-0000-000000000001'::uuid, NOW()),
        ('d0000001-0000-0000-0000-000000000013'::uuid, 'PAY-TEST-013', 'feb65abb-49a8-44fe-b76b-196953af577d'::uuid, 1200000, v_method_id, v_acc_id, 'verified', 'a0000001-0000-0000-0000-000000000001'::uuid, NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.payment_allocations (id, payment_id, invoice_id, amount)
    VALUES
        (gen_random_uuid(), 'd0000001-0000-0000-0000-000000000011'::uuid, '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid, 300000),
        (gen_random_uuid(), 'd0000001-0000-0000-0000-000000000012'::uuid, '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid, 200000),
        (gen_random_uuid(), 'd0000001-0000-0000-0000-000000000013'::uuid, '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid, 1200000)
    ON CONFLICT DO NOTHING;
END $$;

-- T01: Koreksi Pertama Dixit Berhasil (Financial Summary Lengkap)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

DO $$
DECLARE v_result JSONB;
BEGIN
    v_result := public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Koreksi nominal LIP: SPP keliru Rp 1.700.000 -> Rp 1.300.000, total UT Rp 1.817.600 -> Rp 1.417.600',
        'f0000001-0000-0000-0000-000000000001'::uuid,
        '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid
    );
    PERFORM set_config('test.t01_result', v_result::text, true);
END;
$$;
RESET ROLE;
SET search_path = extensions, public, pg_temp;

SELECT ok((((current_setting('test.t01_result', true)::jsonb)->>'success') = 'true')::boolean, 'T01.1: success = true');
SELECT ok((((current_setting('test.t01_result', true)::jsonb)->>'idempotent') = 'false')::boolean, 'T01.2: idempotent = false (mutasi baru)');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'official_lip_amount')::bigint, 1417600::bigint, 'T01.3: official_amount = 1417600');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'variance_amount')::bigint, 117600::bigint, 'T01.4: variance = 117600');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'total_billed')::bigint, 1817600::bigint, 'T01.5: total_billed = 1817600');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'total_service_fee')::bigint, 400000::bigint, 'T01.6: total_service_fee = 400000 (Komisi SALUT murni)');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'total_ut_liability')::bigint, 1935200::bigint, 'T01.7: gross total_ut_liability = 1935200');
SELECT is((((current_setting('test.t01_result', true)::jsonb)->>'total_ut_liability')::bigint - 517600::bigint), 1417600::bigint, 'T01.8: net kewajiban UT bersih = 1417600');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'total_paid')::bigint, 1700000::bigint, 'T01.9: total_paid = 1700000');
SELECT is(((current_setting('test.t01_result', true)::jsonb)->>'balance_due')::bigint, 117600::bigint, 'T01.10: balance_due = 117600');

-- T02: Verifikasi Audit Log Atomik Terpasang Nyata
SELECT is(
    (SELECT COUNT(*)::int FROM public.audit_logs 
     WHERE action = 'reconciliation_corrected' 
       AND entity_type = 'invoice_reconciliation'
       AND actor_user_id = 'a0000001-0000-0000-0000-000000000001'::uuid),
    1,
    'T02.1: Audit log tercatat tepat 1 baris dengan actor_user_id sah'
);

SELECT is(
    (SELECT reason FROM public.audit_logs WHERE action = 'reconciliation_corrected' LIMIT 1),
    'Koreksi nominal LIP: SPP keliru Rp 1.700.000 -> Rp 1.300.000, total UT Rp 1.817.600 -> Rp 1.417.600',
    'T02.2: Alasan audit tercatat utuh'
);

SELECT ok(
    (SELECT ((old_data->>'old_official_lip_amount')::bigint = 1817600 AND (new_data->>'new_official_lip_amount')::bigint = 1417600)::boolean 
     FROM public.audit_logs WHERE action = 'reconciliation_corrected' LIMIT 1),
    'T02.3: Data bukti sebelum (1.817.600) dan sesudah (1.417.600) tercatat di audit log'
);

-- T03: Retry Idempoten Identik Berhasil Tanpa Duplikasi
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

DO $$
DECLARE v_result JSONB;
BEGIN
    v_result := public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Koreksi nominal LIP: SPP keliru Rp 1.700.000 -> Rp 1.300.000, total UT Rp 1.817.600 -> Rp 1.417.600',
        'f0000001-0000-0000-0000-000000000001'::uuid,
        '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid
    );
    PERFORM set_config('test.t03_result', v_result::text, true);
END;
$$;
RESET ROLE;
SET search_path = extensions, public, pg_temp;

SELECT ok((((current_setting('test.t03_result', true)::jsonb)->>'idempotent') = 'true')::boolean, 'T03: retry identik mengembalikan idempotent = true');

-- T04: Konflik Idempotency Key - Total Sama (1.417.600), Komposisi Biaya Berbeda
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1200000, 100000, 117600, 0,
        'Koreksi nominal LIP: SPP keliru Rp 1.700.000 -> Rp 1.300.000, total UT Rp 1.817.600 -> Rp 1.417.600',
        'f0000001-0000-0000-0000-000000000001'::uuid,
        '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid
    )$$,
    '%IDEMPOTENCY_CONFLICT%',
    'T04: total sama tapi rincian biaya berbeda memicu IDEMPOTENCY_CONFLICT'
);

-- T05: Expected Reconciliation NULL Ditolak
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Alasan uji coba',
        'f0000001-0000-0000-0000-000000000002'::uuid,
        NULL
    )$$,
    '%INVALID_INPUT%',
    'T05: expected reconciliation NULL ditolak INVALID_INPUT'
);

-- T06: Concurrency Conflict - Expected Reconciliation ID Berubah / Tidak Cocok
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Koreksi baru dengan expected salah',
        'f0000001-0000-0000-0000-000000000099'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    )$$,
    '%CONCURRENCY_CONFLICT%',
    'T06: expected reconciliation mismatch memicu CONCURRENCY_CONFLICT tanpa mutasi'
);

-- T07: Penolakan Role academic_admin
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000002';
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000010'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%PERMISSION_DENIED%', 'T07: academic_admin -> PERMISSION_DENIED'
);

-- T08: Penolakan Role finance_admin
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000003';
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000011'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%PERMISSION_DENIED%', 'T08: finance_admin -> PERMISSION_DENIED'
);

-- T09: NULL auth.uid() Ditolak
RESET "request.jwt.claim.sub";
RESET ROLE;
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000012'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%AUTH_REQUIRED%', 'T09: auth.uid() NULL -> AUTH_REQUIRED'
);

-- T10: Role Viewer Ditolak
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000005';
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000013'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%PERMISSION_DENIED%', 'T10: viewer -> PERMISSION_DENIED'
);

-- T11: Akun Tidak Aktif Ditolak
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000004';
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000014'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%USER_INACTIVE%', 'T11: akun tidak aktif -> USER_INACTIVE'
);

-- Restore Auth ke Owner
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

-- T12: Argumen Nominal / LIP NULL Ditolak
SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(NULL, 1300000, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000015'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%INVALID_INPUT%', 'T12.1: p_lip_document_id NULL -> INVALID_INPUT'
);

SELECT throws_like(
    $$SELECT public.correct_reconciled_lip('f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, NULL, 0, 117600, 0, 'Alasan uji', 'f0000001-0000-0000-0000-000000000015'::uuid, '14d8e49b-c9ec-4b9e-8b58-518a230b23ae'::uuid)$$,
    '%INVALID_INPUT%', 'T12.2: p_new_tuition_amount NULL -> INVALID_INPUT'
);

-- T13: LIP status paid_to_ut ditolak INVALID_STATE
SAVEPOINT sp_t13_paid_to_ut;

DO $$
DECLARE
    v_remittance_id UUID := gen_random_uuid();
    v_acc_id UUID;
BEGIN
    SELECT id INTO v_acc_id FROM public.cash_accounts LIMIT 1;

    -- 1. Buat setoran UT verified sebesar nominal resmi LIP (Rp 1.417.600) agar lolos check_lip_status_consistency
    INSERT INTO public.ut_remittances (
        id, paid_at, amount, cash_account_id, status, verified_at, verified_by, created_by
    ) VALUES (
        v_remittance_id, NOW(), 1417600, v_acc_id, 'verified', NOW(),
        'a0000001-0000-0000-0000-000000000001'::uuid,
        'a0000001-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.ut_remittance_items (
        id, remittance_id, registration_id, lip_document_id, amount, created_by
    ) VALUES (
        gen_random_uuid(), v_remittance_id,
        'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1417600,
        'a0000001-0000-0000-0000-000000000001'::uuid
    );

    -- 2. Transisi LIP ke status paid_to_ut secara sah
    UPDATE public.lip_documents
    SET status = 'paid_to_ut'
    WHERE id = 'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_err_msg TEXT := 'NO_EXCEPTION';
BEGIN
    BEGIN
        PERFORM public.correct_reconciled_lip(
            'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
            1300000, 0, 117600, 0,
            'Alasan uji status paid_to_ut',
            'f0000001-0000-0000-0000-000000000016'::uuid,
            ((current_setting('test.t01_result', true)::jsonb)->>'new_reconciliation_id')::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_msg := SQLERRM;
    END;
    PERFORM set_config('test.t13_err', v_err_msg, true);
END;
$$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;

-- 3. Ambil error message ke psql client variable via \gset
SELECT current_setting('test.t13_err', true) AS t13_error_msg \gset

-- 4. Rollback savepoint untuk membersihkan seluruh fixture setoran UT dan mengembalikan status LIP
ROLLBACK TO SAVEPOINT sp_t13_paid_to_ut;

-- 5. Eksekusi assertion pgTAP SETELAH rollback savepoint agar counter test tidak ikut di-rollback
SELECT ok(
    (:'t13_error_msg' LIKE '%INVALID_STATE%')::boolean,
    'T13: LIP status paid_to_ut ditolak INVALID_STATE'
);

-- T14: Koreksi menghasilkan variance <= 0 ditolak OUT_OF_SCOPE
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 0, 0,
        'Koreksi variance nol',
        'f0000001-0000-0000-0000-000000000017'::uuid,
        ((current_setting('test.t01_result', true)::jsonb)->>'new_reconciliation_id')::uuid
    )$$,
    '%OUT_OF_SCOPE%',
    'T14: variance <= 0 -> OUT_OF_SCOPE'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;

-- T15: Registrasi sudah memiliki draft setoran UT ditolak REMITTANCE_RESTRICTION
DO $$
DECLARE
    v_remittance_id UUID := gen_random_uuid();
    v_acc_id UUID;
BEGIN
    SELECT id INTO v_acc_id FROM public.cash_accounts LIMIT 1;
    INSERT INTO public.ut_remittances (id, paid_at, amount, cash_account_id, status, created_by)
    VALUES (v_remittance_id, NOW(), 1417600, v_acc_id, 'draft', 'a0000001-0000-0000-0000-000000000001'::uuid);

    INSERT INTO public.ut_remittance_items (id, remittance_id, registration_id, lip_document_id, amount, created_by)
    VALUES (gen_random_uuid(), v_remittance_id, 'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid, 'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid, 1417600, 'a0000001-0000-0000-0000-000000000001'::uuid);
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Alasan uji remittance restriction',
        'f0000001-0000-0000-0000-000000000018'::uuid,
        ((current_setting('test.t01_result', true)::jsonb)->>'new_reconciliation_id')::uuid
    )$$,
    '%REMITTANCE_RESTRICTION%',
    'T15: registrasi memiliki setoran UT -> REMITTANCE_RESTRICTION'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;

DO $$
BEGIN
    DELETE FROM public.ut_remittance_items WHERE registration_id = 'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid;
    DELETE FROM public.ut_remittances WHERE created_by = 'a0000001-0000-0000-0000-000000000001'::uuid;
END $$;

-- T16: Registrasi / rekonsiliasi memiliki kredit ditolak CREDIT_RESTRICTION
DO $$
DECLARE
    v_period_id UUID;
BEGIN
    SELECT id INTO v_period_id FROM public.academic_periods LIMIT 1;
    INSERT INTO public.student_credit_ledgers (
        id, student_id, academic_period_id, registration_id, idempotency_key,
        entry_type, transaction_type, amount, balance_after, notes, status, maker_by
    ) VALUES (
        gen_random_uuid(),
        'feb65abb-49a8-44fe-b76b-196953af577d'::uuid,
        v_period_id,
        'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid,
        gen_random_uuid(),
        'credit',
        'reconciliation_credit',
        50000,
        50000,
        'Test ledger credit',
        'posted',
        'a0000001-0000-0000-0000-000000000001'::uuid
    );
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO 'a0000001-0000-0000-0000-000000000001';

SELECT throws_like(
    $$SELECT public.correct_reconciled_lip(
        'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2'::uuid,
        1300000, 0, 117600, 0,
        'Alasan uji credit restriction',
        'f0000001-0000-0000-0000-000000000019'::uuid,
        ((current_setting('test.t01_result', true)::jsonb)->>'new_reconciliation_id')::uuid
    )$$,
    '%CREDIT_RESTRICTION%',
    'T16: registrasi memiliki kredit -> CREDIT_RESTRICTION'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;

DO $$
BEGIN
    DELETE FROM public.student_credit_ledgers WHERE registration_id = 'efbb226d-91e7-4568-a4b1-91be3f73f732'::uuid;
END $$;

-- T17: Komposisi Item Invoice Pasca Koreksi
SELECT is(
    (SELECT COUNT(*)::int FROM public.invoice_items WHERE invoice_id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid),
    5,
    'T17.1: 5 items (SPP + Komisi + Shortage lama + Reversal + Shortage baru)'
);

SELECT is(
    (SELECT amount FROM public.invoice_items WHERE invoice_id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid AND item_type = 'discount' AND source_type = 'lip_reconciliation'),
    517600::bigint,
    'T17.2: reversal discount item = 517600'
);

SELECT is(
    (SELECT amount FROM public.invoice_items WHERE invoice_id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid AND item_type = 'ut_liability' AND description LIKE '%(Terkoreksi)%'),
    117600::bigint,
    'T17.3: shortage item baru terkoreksi = 117600'
);

-- T18: Payment Allocations Tetap Utuh
SELECT is(
    (SELECT SUM(amount)::bigint FROM public.payment_allocations WHERE invoice_id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid),
    1700000::bigint,
    'T18: total payment_allocations tetap Rp1.700.000 utuh'
);

-- T19: Total Kanonikal Invoice & Status Terverifikasi
SELECT is(
    (SELECT total_billed FROM public.get_invoice_canonical_totals('92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid)),
    1817600::bigint,
    'T19.1: canonical total_billed = 1817600'
);

SELECT is(
    (SELECT total_service_fee FROM public.get_invoice_canonical_totals('92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid)),
    400000::bigint,
    'T19.2: canonical total_service_fee = 400000 (Komisi SALUT murni)'
);

SELECT is(
    (SELECT total_ut_liability FROM public.get_invoice_canonical_totals('92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid)),
    1935200::bigint,
    'T19.3: canonical gross total_ut_liability = 1935200'
);

SELECT is(
    (SELECT total_ut_liability - total_discount FROM public.get_invoice_canonical_totals('92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid)),
    1417600::bigint,
    'T19.4: canonical net kewajiban UT bersih = 1417600'
);

SELECT is(
    (SELECT status FROM public.invoices WHERE id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid),
    'partial',
    'T19.5: invoice status tetap partial (Rp1.700.000 / Rp1.817.600, sisa Rp117.600)'
);

-- T20: Verifikasi Rollback Transaksi Gagal (Tidak Ada Rekonsiliasi Yatim / Parsial)
SELECT is(
    (SELECT COUNT(*)::int FROM public.invoice_reconciliations WHERE invoice_id = '92ff1c8e-7eac-4c57-9380-0806c41b1d00'::uuid AND status = 'active'),
    1,
    'T20: Tepat 1 rekonsiliasi aktif yang sah di invoice setelah semua tes penolakan'
);

SELECT * FROM finish();
ROLLBACK;
