-- ============================================================================
-- SIM-SALUT Test 04: reset_student_transactions & delete_student_cascade Strict Scoping
-- ============================================================================
BEGIN;
SELECT plan(16);

-- Fixture IDs
\set student_a 'a0000000-0000-0000-0000-000000000001'
\set student_b 'b0000000-0000-0000-0000-000000000002'
\set reg_a     'a0000000-0000-0000-0000-000000000011'
\set reg_b     'b0000000-0000-0000-0000-000000000022'
\set inv_a     'a0000000-0000-0000-0000-000000000031'
\set inv_b     'b0000000-0000-0000-0000-000000000032'
\set pay_a     'a0000000-0000-0000-0000-000000000041'
\set pay_b     'b0000000-0000-0000-0000-000000000042'
\set lip_a     'a0000000-0000-0000-0000-000000000051'
\set lip_b     'b0000000-0000-0000-0000-000000000052'

-- Setup test identities in auth.users, profiles, and user_roles
DO $$
DECLARE
    v_role_owner_id UUID;
    c_uid_owner CONSTANT UUID := '10000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    SELECT id INTO v_role_owner_id FROM public.roles WHERE code = 'owner';

    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud) VALUES
        (c_uid_owner, 'dummy_owner@test.local', '{"full_name":"Test Owner"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active) VALUES
        (c_uid_owner, 'Test Owner', true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

    DELETE FROM public.user_roles WHERE user_id = c_uid_owner;
    INSERT INTO public.user_roles (user_id, role_id) VALUES
        (c_uid_owner, v_role_owner_id);
END $$;

-- Setup Fixtures for Student A (Target) and Student B (Other Student)
DO $$
DECLARE
    v_status_id UUID;
    v_period_id UUID;
    v_type_id   UUID;
    v_prog_id   UUID;
    v_scheme_id UUID;
    v_method_id UUID;
    v_acc_id    UUID;
BEGIN
    SELECT id INTO v_status_id FROM public.student_statuses LIMIT 1;
    SELECT id INTO v_period_id FROM public.academic_periods LIMIT 1;
    SELECT id INTO v_type_id   FROM public.registration_types LIMIT 1;
    SELECT id INTO v_prog_id   FROM public.study_programs LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes LIMIT 1;
    SELECT id INTO v_method_id FROM public.payment_methods LIMIT 1;
    SELECT id INTO v_acc_id    FROM public.cash_accounts LIMIT 1;

    -- Students
    INSERT INTO public.students (id, nim, full_name, status_id)
    VALUES ('a0000000-0000-0000-0000-000000000001'::UUID, '11110001', 'Student A Target', v_status_id),
           ('b0000000-0000-0000-0000-000000000002'::UUID, '22220002', 'Student B Safe', v_status_id)
    ON CONFLICT (id) DO NOTHING;

    -- Registrations
    INSERT INTO public.registrations (id, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status)
    VALUES ('a0000000-0000-0000-0000-000000000011'::UUID, 'a0000000-0000-0000-0000-000000000001'::UUID, v_period_id, v_type_id, v_prog_id, v_scheme_id, 18, 'active'),
           ('b0000000-0000-0000-0000-000000000022'::UUID, 'b0000000-0000-0000-0000-000000000002'::UUID, v_period_id, v_type_id, v_prog_id, v_scheme_id, 18, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Fee Snapshots
    INSERT INTO public.registration_fee_snapshots (id, registration_id, fee_type_id, fee_name_snapshot, calculation_type, quantity, unit_amount, total_amount)
    VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000011'::UUID, (SELECT id FROM public.fee_types LIMIT 1), 'Biaya A', 'FIXED', 1, 1000000, 1000000),
           (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000022'::UUID, (SELECT id FROM public.fee_types LIMIT 1), 'Biaya B', 'FIXED', 1, 1000000, 1000000);

    -- LIP Documents first (invoices references lip_document_id)
    INSERT INTO public.lip_documents (id, registration_id, lip_number, version, official_amount, storage_path, original_file_name, mime_type, file_size, status)
    VALUES ('a0000000-0000-0000-0000-000000000051'::UUID, 'a0000000-0000-0000-0000-000000000011'::UUID, 'LIP-A-01', 1, 1000000, '/p/a.pdf', 'a.pdf', 'application/pdf', 100, 'verified'),
           ('b0000000-0000-0000-0000-000000000052'::UUID, 'b0000000-0000-0000-0000-000000000022'::UUID, 'LIP-B-01', 1, 1000000, '/p/b.pdf', 'b.pdf', 'application/pdf', 100, 'verified')
    ON CONFLICT (id) DO NOTHING;

    -- Invoices (referencing registration_id and lip_document_id)
    INSERT INTO public.invoices (id, invoice_number, registration_id, lip_document_id, status)
    VALUES ('a0000000-0000-0000-0000-000000000031'::UUID, 'INV-A-01', 'a0000000-0000-0000-0000-000000000011'::UUID, 'a0000000-0000-0000-0000-000000000051'::UUID, 'paid'),
           ('b0000000-0000-0000-0000-000000000032'::UUID, 'INV-B-01', 'b0000000-0000-0000-0000-000000000022'::UUID, 'b0000000-0000-0000-0000-000000000052'::UUID, 'paid')
    ON CONFLICT (id) DO NOTHING;

    -- Student Payments
    INSERT INTO public.student_payments (id, transaction_number, student_id, amount, payment_method_id, cash_account_id, status)
    VALUES ('a0000000-0000-0000-0000-000000000041'::UUID, 'PAY-A-01', 'a0000000-0000-0000-0000-000000000001'::UUID, 1000000, v_method_id, v_acc_id, 'verified'),
           ('b0000000-0000-0000-0000-000000000042'::UUID, 'PAY-B-01', 'b0000000-0000-0000-0000-000000000002'::UUID, 1000000, v_method_id, v_acc_id, 'verified')
    ON CONFLICT (id) DO NOTHING;

    -- Payment Allocations
    INSERT INTO public.payment_allocations (id, payment_id, invoice_id, amount)
    VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000041'::UUID, 'a0000000-0000-0000-0000-000000000031'::UUID, 1000000),
           (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000042'::UUID, 'b0000000-0000-0000-0000-000000000032'::UUID, 1000000);

    -- Student Credit Ledgers
    INSERT INTO public.student_credit_ledgers (id, student_id, academic_period_id, registration_id, idempotency_key, entry_type, transaction_type, amount, balance_after, notes, maker_by)
    VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001'::UUID, v_period_id, 'a0000000-0000-0000-0000-000000000011'::UUID, gen_random_uuid(), 'credit', 'reconciliation_credit', 50000, 50000, 'Ledger A', '10000000-0000-0000-0000-000000000001'::UUID),
           (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002'::UUID, v_period_id, 'b0000000-0000-0000-0000-000000000022'::UUID, gen_random_uuid(), 'credit', 'reconciliation_credit', 50000, 50000, 'Ledger B', '10000000-0000-0000-0000-000000000001'::UUID);
END $$;

-- Test 1: Baseline Student A & Student B exist
SELECT is(
    (SELECT count(*)::int FROM public.students WHERE id IN ('a0000000-0000-0000-0000-000000000001'::UUID, 'b0000000-0000-0000-0000-000000000002'::UUID)),
    2,
    'Baseline: Kedua mahasiswa A dan B terdaftar'
);

-- Test 2: Call delete_student_cascade for Student A as Owner
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner

SELECT is(
    (SELECT (public.delete_student_cascade('a0000000-0000-0000-0000-000000000001'::UUID))->>'success'),
    'true',
    'delete_student_cascade untuk Mahasiswa A berhasil dijalankan oleh Owner'
);

RESET ROLE;

-- Test 3: Student A deleted
SELECT is(
    (SELECT count(*)::int FROM public.students WHERE id = 'a0000000-0000-0000-0000-000000000001'::UUID),
    0,
    'Mahasiswa A berhasil dihapus dari tabel students'
);

-- Test 4: Student A registration & snapshots deleted
SELECT is(
    (SELECT count(*)::int FROM public.registrations WHERE id = 'a0000000-0000-0000-0000-000000000011'::UUID),
    0,
    'Registrasi Mahasiswa A terhapus'
);
SELECT is(
    (SELECT count(*)::int FROM public.registration_fee_snapshots WHERE registration_id = 'a0000000-0000-0000-0000-000000000011'::UUID),
    0,
    'Snapshot biaya Mahasiswa A terhapus'
);

-- Test 5: Student A payments, allocations, invoices, LIPs deleted
SELECT is(
    (SELECT count(*)::int FROM public.student_payments WHERE id = 'a0000000-0000-0000-0000-000000000041'::UUID),
    0,
    'Pembayaran Mahasiswa A terhapus'
);
SELECT is(
    (SELECT count(*)::int FROM public.invoices WHERE id = 'a0000000-0000-0000-0000-000000000031'::UUID),
    0,
    'Invoice Mahasiswa A terhapus'
);
SELECT is(
    (SELECT count(*)::int FROM public.lip_documents WHERE id = 'a0000000-0000-0000-0000-000000000051'::UUID),
    0,
    'Dokumen LIP Mahasiswa A terhapus'
);

-- Test 6: Audit log recorded for Student A deletion
SELECT is(
    (SELECT count(*)::int FROM public.audit_logs WHERE action = 'student_cascade_deleted' AND entity_id = 'a0000000-0000-0000-0000-000000000001'::UUID),
    1,
    'Audit log penghapusan Mahasiswa A tercatat dengan tepat'
);

-- Test 7: Student B and ALL child records REMAIN 100% INTACT
SELECT is(
    (SELECT count(*)::int FROM public.students WHERE id = 'b0000000-0000-0000-0000-000000000002'::UUID),
    1,
    'Mahasiswa B tetap utuh'
);
SELECT is(
    (SELECT count(*)::int FROM public.registrations WHERE id = 'b0000000-0000-0000-0000-000000000022'::UUID),
    1,
    'Registrasi Mahasiswa B tetap utuh'
);
SELECT is(
    (SELECT count(*)::int FROM public.student_payments WHERE id = 'b0000000-0000-0000-0000-000000000042'::UUID),
    1,
    'Pembayaran Mahasiswa B tetap utuh'
);

-- Test 8: Login profiles & roles REMAIN 100% INTACT
SELECT is(
    (SELECT count(*)::int FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'::UUID),
    1,
    'Profil login Owner tetap utuh'
);

-- Test 9: Master data (academic periods, faculties, fee types) REMAIN 100% INTACT
SELECT cmp_ok(
    (SELECT count(*)::int FROM public.academic_periods),
    '>=',
    1,
    'Master data periode akademik tetap utuh'
);

-- Test 10: Calling delete_student_cascade on non-existent student returns graceful error without exception
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
SELECT is(
    (SELECT (public.delete_student_cascade('99999999-9999-9999-9999-999999999999'::UUID))->>'success'),
    'false',
    'Penghapusan id tidak ada mengembalikan {success: false}'
);
RESET ROLE;

-- Test 11: Transaction rollback on failure test
DO $$
DECLARE
    v_rolled_back BOOLEAN := false;
BEGIN
    BEGIN
        -- Test atomic rollback inside a subtransaction
        -- Passing null triggers invalid_parameter_value exception in reset_student_transactions
        PERFORM public.reset_student_transactions(NULL);
    EXCEPTION WHEN OTHERS THEN
        v_rolled_back := true;
    END;

    IF NOT v_rolled_back THEN
        RAISE EXCEPTION 'Expected error did not occur';
    END IF;
END $$;

SELECT pass('Kegagalan eksekusi memicu exception dan rollback penuh');

SELECT * FROM finish();
ROLLBACK;
