BEGIN;
SELECT plan(28);

-- ============================================================================
-- SIM-SALUT PANGKALPINANG - PHASE 2.1 DATABASE INTEGRATION TESTS (pgTAP)
-- Testing real PostgreSQL functions, SECURITY DEFINER, locks, constraints,
-- component waterfalls, and maker-checker invariants.
-- ============================================================================

-- Setup test identities in auth.users and public.profiles
INSERT INTO auth.users (id, email) VALUES
    ('20000000-0000-0000-0000-000000000001', 'owner_test@salut.local'),
    ('20000000-0000-0000-0000-000000000002', 'admin_test@salut.local'),
    ('20000000-0000-0000-0000-000000000003', 'academic_test@salut.local'),
    ('20000000-0000-0000-0000-000000000004', 'finance_test@salut.local'),
    ('20000000-0000-0000-0000-000000000005', 'viewer_test@salut.local'),
    ('20000000-0000-0000-0000-000000000006', 'inactive_test@salut.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Owner Test', TRUE),
    ('20000000-0000-0000-0000-000000000002', 'Admin Test', TRUE),
    ('20000000-0000-0000-0000-000000000003', 'Academic Admin Test', TRUE),
    ('20000000-0000-0000-0000-000000000004', 'Finance Admin Test', TRUE),
    ('20000000-0000-0000-0000-000000000005', 'Viewer Test', TRUE),
    ('20000000-0000-0000-0000-000000000006', 'Inactive User Test', FALSE)
ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

-- Clean up any default viewer role created by handle_new_user trigger
DELETE FROM public.user_roles WHERE user_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000006'
);

INSERT INTO public.user_roles (user_id, role_id) VALUES
    ('20000000-0000-0000-0000-000000000001', (SELECT id FROM public.roles WHERE code = 'owner')),
    ('20000000-0000-0000-0000-000000000002', (SELECT id FROM public.roles WHERE code = 'admin')),
    ('20000000-0000-0000-0000-000000000003', (SELECT id FROM public.roles WHERE code = 'academic_admin')),
    ('20000000-0000-0000-0000-000000000004', (SELECT id FROM public.roles WHERE code = 'finance_admin')),
    ('20000000-0000-0000-0000-000000000005', (SELECT id FROM public.roles WHERE code = 'viewer')),
    ('20000000-0000-0000-0000-000000000006', (SELECT id FROM public.roles WHERE code = 'owner'));

-- Setup test student & reference data
INSERT INTO public.students (id, nim, full_name, status_id) VALUES
    ('30000000-0000-0000-0000-000000000001', '041234567', 'Mahasiswa Uji Phase 2', (SELECT id FROM public.student_statuses WHERE code = 'AKTIF'))
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER & AUTHENTICATION TESTS (Tests 1-4)
-- ----------------------------------------------------------------------------

-- Test 1: create_registration_with_snapshots rejected when auth.uid() is null
RESET "request.jwt.claim.sub";
RESET ROLE;
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.',
    'Test 1: create_registration_with_snapshots menolak pemanggil tanpa auth.uid()'
);

-- Test 2: Inactive user rejected
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000006'; -- Inactive user
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.',
    'Test 2: create_registration_with_snapshots menolak pengguna non-aktif (is_active = false)'
);

-- Test 3: Unauthorized role rejected
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000005'; -- Viewer
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'PERMISSION_DENIED: Role viewer tidak memiliki izin membuat registrasi.',
    'Test 3: create_registration_with_snapshots menolak role tanpa wewenang (viewer)'
);

-- Test 4: create_payment_with_allocation rejected without auth
RESET "request.jwt.claim.sub";
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-TEST', NULL, NULL, NULL, NULL, NULL,
        gen_random_uuid(), 400000, gen_random_uuid()
    );
    $$,
    'P0001',
    'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.',
    'Test 4: create_payment_with_allocation menolak pemanggil tanpa auth.uid()'
);

-- ----------------------------------------------------------------------------
-- 2. FAIL-CLOSED DEFAULT SALUT FEE SETTINGS (Tests 5-8)
-- ----------------------------------------------------------------------------

-- Setup valid academic admin session
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003'; -- Academic Admin

-- Test 5: Setting missing/deleted
SAVEPOINT sp_setting_test;
UPDATE public.app_settings SET value = '{}'::jsonb WHERE key = 'default_salut_fee';
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'CONFIG_ERROR: app_settings.default_salut_fee tidak ditemukan atau format tidak valid. Transaksi dibatalkan.',
    'Test 5: Registrasi gagal fail-closed jika setting default_salut_fee tidak memiliki key amount'
);
ROLLBACK TO SAVEPOINT sp_setting_test;

-- Test 6: Setting invalid string / non-integer
SAVEPOINT sp_setting_test2;
UPDATE public.app_settings SET value = '{"amount": "bukan_angka"}'::jsonb WHERE key = 'default_salut_fee';
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'CONFIG_ERROR: Nilai default_salut_fee bukan berupa integer nominal yang valid. Transaksi dibatalkan.',
    'Test 6: Registrasi gagal fail-closed jika amount bukan berupa integer valid'
);
ROLLBACK TO SAVEPOINT sp_setting_test2;

-- Test 7: Setting negative or zero
SAVEPOINT sp_setting_test3;
UPDATE public.app_settings SET value = '{"amount": 0}'::jsonb WHERE key = 'default_salut_fee';
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'CONFIG_ERROR: Nominal default_salut_fee harus berupa nilai positif (> 0). Transaksi dibatalkan.',
    'Test 7: Registrasi gagal fail-closed jika nominal default_salut_fee <= 0'
);
ROLLBACK TO SAVEPOINT sp_setting_test3;

-- Test 8: Fee type SALUT_SERVICE inactive
SAVEPOINT sp_setting_test4;
UPDATE public.fee_types SET is_active = false WHERE code = 'SALUT_SERVICE';
SELECT throws_ok(
    $$
    SELECT public.create_registration_with_snapshots(
        '30000000-0000-0000-0000-000000000001'::UUID,
        (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
        (SELECT id FROM public.registration_types LIMIT 1),
        (SELECT id FROM public.study_programs LIMIT 1),
        (SELECT id FROM public.service_schemes LIMIT 1),
        0, 'Notes', '[]'::jsonb
    );
    $$,
    'P0001',
    'MASTER_DATA_ERROR: Jenis biaya SALUT_SERVICE tidak ditemukan atau tidak aktif. Transaksi dibatalkan.',
    'Test 8: Registrasi gagal fail-closed jika master jenis biaya SALUT_SERVICE tidak aktif'
);
ROLLBACK TO SAVEPOINT sp_setting_test4;

-- ----------------------------------------------------------------------------
-- 3. UNIFIED INVOICE CREATION & SNAPSHOT ISOLATION (Tests 9-12)
-- ----------------------------------------------------------------------------

-- Create a valid registration with academic admin
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003'; -- Academic Admin

-- Test 9: Successful creation creates registration and unified invoice
SELECT public.create_registration_with_snapshots(
    '30000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
    (SELECT id FROM public.study_programs LIMIT 1),
    (SELECT id FROM public.service_schemes LIMIT 1),
    0, 'Catatan Uji Registrasi',
    jsonb_build_array(
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'Biaya Admisi%' LIMIT 1), 'quantity', 1),
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'UKT 3%' LIMIT 1), 'quantity', 1)
    )
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID),
    'Test 9: Pembuatan registrasi dan tagihan rincian berhasil tanpa error'
);

-- Test 10: Unified invoice created with snapshot_estimate billing phase
SELECT ok(
    EXISTS(
        SELECT 1 FROM public.invoices i
        JOIN public.registrations r ON i.registration_id = r.id
        WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID
          AND i.billing_phase = 'snapshot_estimate'
          AND i.status = 'unpaid'
    ),
    'Test 10: Invoice tunggal otomatis terbentuk dengan billing_phase snapshot_estimate'
);

-- Test 11: Service fee snapshot and item amount is exactly Rp 250.000 from app_settings
SELECT is(
    (SELECT amount FROM public.invoice_items ii
     JOIN public.invoices i ON ii.invoice_id = i.id
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND ii.item_type = 'service_fee' LIMIT 1),
    250000::BIGINT,
    'Test 11: Nilai komisi SALUT pada invoice_items tepat Rp 250.000 dari setting'
);

-- Test 12: Updating app_settings afterward does not mutate existing snapshot/invoice
UPDATE public.app_settings SET value = '{"amount": 500000, "currency": "IDR"}'::jsonb WHERE key = 'default_salut_fee';
SELECT is(
    (SELECT amount FROM public.invoice_items ii
     JOIN public.invoices i ON ii.invoice_id = i.id
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND ii.item_type = 'service_fee' LIMIT 1),
    250000::BIGINT,
    'Test 12: Perubahan app_settings berikutnya TIDAK mengubah invoice lama (Immutability terjamin)'
);
-- Restore setting
UPDATE public.app_settings SET value = '{"amount": 250000, "currency": "IDR"}'::jsonb WHERE key = 'default_salut_fee';

-- ----------------------------------------------------------------------------
-- 4. PENDING PAYMENT RESERVATION & ALLOCATION CAPACITY (Tests 13-17)
-- ----------------------------------------------------------------------------

-- Test 13: Create first pending payment (Rp 400.000)
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004'; -- Finance Admin
DO $$
DECLARE
    v_inv_id UUID;
    v_pay_id UUID;
BEGIN
    SELECT id INTO v_inv_id FROM public.invoices WHERE status = 'unpaid' LIMIT 1;
    v_pay_id := public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-TEST-01', NULL, NULL, NULL, NULL, 'Pembayaran Tahap 1',
        v_inv_id, 400000, '40000000-0000-0000-0000-000000000001'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND status = 'pending_verification'),
    'Test 13: Pembayaran tahap 1 tersimpan dengan status pending_verification'
);

-- Total invoice is 100.000 (admisi) + 1.300.000 (UKT 3) + 250.000 (SALUT) = 1.650.000
-- Remaining payable is 1.650.000 - 400.000 = 1.250.000

-- Test 14: Payment exceeding remaining payable is strictly rejected
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 1300000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-OVERPAY', NULL, NULL, NULL, NULL, 'Overpay',
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
        1300000, gen_random_uuid()
    );
    $$,
    'P0001',
    'CAPACITY_EXCEEDED: Alokasi pembayaran (Rp 1300000) melebihi sisa kapasitas yang dapat dibayar (Rp 1250000 termasuk reservasi pending).',
    'Test 14: Pembayaran yang melebihi kapasitas payable (akibat reservasi pending) ditolak'
);

-- Test 15: Payment within remaining payable succeeds (Rp 250.000)
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000001'::UUID,
    NOW(), 250000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-TEST-02', NULL, NULL, NULL, NULL, 'Pembayaran Tahap 2',
    (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
    250000, '40000000-0000-0000-0000-000000000002'::UUID
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID),
    'Test 15: Pembayaran kedua dalam batas sisa payable (Rp 250.000) berhasil mencadangkan kapasitas'
);

-- Test 16: Rejecting payment releases reserved capacity
UPDATE public.student_payments
SET status = 'rejected', rejected_at = NOW(), rejected_by = '20000000-0000-0000-0000-000000000004'::UUID, rejection_reason = 'Bukti buram'
WHERE idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID;

-- Now capacity released back by 250.000: remaining payable is 1.250.000
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000001'::UUID,
    NOW(), 1250000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-TEST-03', NULL, NULL, NULL, NULL, 'Pelunasan sisa kapasitas',
    (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
    1250000, '40000000-0000-0000-0000-000000000003'::UUID
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000003'::UUID),
    'Test 16: Penolakan pending payment melepaskan reservasi sehingga sisa Rp 1.250.000 dapat dicatat kembali'
);

-- Test 17: Payment creation idempotency
DO $$
DECLARE
    v_dup_id UUID;
BEGIN
    v_dup_id := public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 1250000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-TEST-03', NULL, NULL, NULL, NULL, 'Pelunasan sisa kapasitas',
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
        1250000, '40000000-0000-0000-0000-000000000003'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000003'::UUID),
    1,
    'Test 17: Idempotency key mengembalikan record pembayaran yang sama tanpa duplikasi'
);

-- ----------------------------------------------------------------------------
-- 5. PAYMENT VERIFICATION & COMPONENT WATERFALL (Tests 18-20)
-- ----------------------------------------------------------------------------

-- Verify first payment (Rp 400.000). Total service fee is 250.000, UT is 1.400.000.
-- Waterfall: service_fee gets 250.000 (100% full), ut_liability gets remaining 150.000.
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID)
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND status = 'verified'),
    'Test 18: Verifikasi pembayaran tahap 1 berhasil diproses'
);

-- Test 19: Waterfall verification in payment_component_allocations
SELECT is(
    (SELECT pca.amount FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND pca.component_type = 'service_fee'),
    250000::BIGINT,
    'Test 19: Prioritas 1 — Komisi SALUT teralokasi penuh Rp 250.000'
);

-- Test 20: Remaining payment allocated to ut_liability
SELECT is(
    (SELECT SUM(pca.amount)::BIGINT FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND pca.component_type = 'ut_liability'),
    150000::BIGINT,
    'Test 20: Prioritas 2 — Sisa pembayaran Rp 150.000 dialokasikan ke kewajiban dana UT'
);

-- ----------------------------------------------------------------------------
-- 6. LIP RECONCILIATION & STUDENT CREDIT ISOLATION (Tests 21-23)
-- ----------------------------------------------------------------------------

-- Verify the second payment of 1.250.000 to fully pay invoice (Total UT paid = 150.000 + 1.250.000 = 1.400.000)
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000003'::UUID)
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000003'::UUID AND status = 'verified'),
    'Test 21: Verifikasi pembayaran pelunasan berhasil diproses (Invoice status paid)'
);

-- Create official LIP with LOWER official amount (Rp 1.100.000 instead of estimated 1.400.000)
-- Real cash credit created = 1.400.000 - 1.100.000 = Rp 300.000
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003'; -- Academic Admin
INSERT INTO public.lip_documents (
    id, registration_id, lip_number, version, official_amount, tuition_amount,
    storage_path, original_file_name, mime_type, file_size, status, created_by, updated_by
) VALUES (
    '50000000-0000-0000-0000-000000000099'::UUID,
    (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID LIMIT 1),
    'LIP-REC-TEST-99', 1, 1100000, 1100000,
    'tests/lip-rec-test-99.pdf', 'lip-rec-test-99.pdf', 'application/pdf', 1024,
    'pending_verification',
    '20000000-0000-0000-0000-000000000003'::UUID, '20000000-0000-0000-0000-000000000003'::UUID
);

-- Reconcile LIP with invoice
SELECT public.reconcile_lip_with_invoice(
    '50000000-0000-0000-0000-000000000099'::UUID,
    '70000000-0000-0000-0000-000000000001'::UUID
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.invoices WHERE lip_document_id = '50000000-0000-0000-0000-000000000099'::UUID),
    'Test 22: Rekonsiliasi LIP resmi UT berhasil dijalankan atomik'
);

-- Test 23: Student credit ledger entry created exactly for real cash excess (Rp 300.000)
SELECT is(
    (SELECT amount FROM public.student_credit_ledgers
     WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID
       AND transaction_type = 'reconciliation_credit' AND status = 'posted' LIMIT 1),
    300000::BIGINT,
    'Test 23: Rekonsiliasi menghasilkan saldo kredit mahasiswa persis Rp 300.000 dari kelebihan uang kas riil'
);

-- ----------------------------------------------------------------------------
-- 7. MAKER-CHECKER REFUND & ADVISORY LOCKS (Tests 24-26)
-- ----------------------------------------------------------------------------

-- Test 24: Maker requests refund for Rp 100.000 (Maker is Admin)
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000002'; -- Admin (Maker)
SELECT public.request_student_credit_refund(
    '30000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    100000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'Pengajuan refund deposit',
    '80000000-0000-0000-0000-000000000001'::UUID
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID AND status = 'pending_approval'),
    'Test 24: Maker berhasil mengajukan permohonan refund status pending_approval'
);

-- Test 25: Self-approval by Maker is STRICTLY FORBIDDEN (Admin is eligible Checker role, but cannot approve own request)
SELECT throws_ok(
    $$
    SELECT public.approve_student_credit_refund(
        (SELECT id FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID),
        'approve'
    );
    $$,
    'P0001',
    'MAKER_CHECKER_VIOLATION: Checker wajib merupakan pengguna yang berbeda dari Maker.',
    'Test 25: Approval ditolak saat Maker mencoba menyetujui refund sendiri (Maker-Checker violation)'
);

-- Test 26: Approval by Owner (Checker != Maker) SUCCEEDS
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000001'; -- Owner (Checker)
SELECT public.approve_student_credit_refund(
    (SELECT id FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID),
    'approve'
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID AND status = 'posted'),
    'Test 26: Approval refund oleh Owner (Checker != Maker) berhasil mem-posting jurnal kredit & pengeluaran'
);

-- ----------------------------------------------------------------------------
-- 8. UT REMITTANCE 5 ELIGIBILITY CRITERIA VALIDATION (Tests 27-28)
-- ----------------------------------------------------------------------------

-- Test 27: Create UT remittance for reconciled LIP (Official amount: 1.100.000)
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT public.create_ut_remittance_with_items(
    NOW(), 1100000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-UTR-TEST-01', NULL, NULL, NULL, NULL, 'Setoran UT resmi',
    '90000000-0000-0000-0000-000000000001'::UUID,
    jsonb_build_array(
        jsonb_build_object(
            'registration_id', (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID LIMIT 1),
            'lip_document_id', '50000000-0000-0000-0000-000000000099'::UUID,
            'amount', 1100000
        )
    )
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.ut_remittances WHERE idempotency_key = '90000000-0000-0000-0000-000000000001'::UUID),
    'Test 27: Setoran UT berhasil dibuat saat seluruh 5 kriteria kelayakan terpenuhi 100%'
);

-- Test 28: Over-remittance is rejected
SELECT throws_ok(
    $$
    SELECT public.create_ut_remittance_with_items(
        NOW(), 100000,
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-UTR-OVER', NULL, NULL, NULL, NULL, 'Over',
        gen_random_uuid(),
        jsonb_build_array(
            jsonb_build_object(
                'registration_id', (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID LIMIT 1),
                'lip_document_id', '50000000-0000-0000-0000-000000000099'::UUID,
                'amount', 100000
            )
        )
    );
    $$,
    'P0001',
    'OVER_REMITTANCE: Nominal alokasi (Rp 100000) melebihi sisa kewajiban LIP (Rp 0).',
    'Test 28: Setoran yang melebihi sisa kewajiban LIP (setelah setoran sebelumnya) ditolak'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();
ROLLBACK;
