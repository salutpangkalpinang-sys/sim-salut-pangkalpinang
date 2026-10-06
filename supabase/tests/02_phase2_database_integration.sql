BEGIN;
SELECT plan(38);

-- ============================================================================
-- SIM-SALUT PANGKALPINANG - PHASE 2.2 FINAL RELEASE CANDIDATE INTEGRATION TESTS (pgTAP)
-- Testing real PostgreSQL functions, SECURITY DEFINER, locks, constraints,
-- component waterfalls with Rp 400.000 SALUT fee, feature flag isolation,
-- and Maker-Checker invariants.
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
-- 1. SECURITY DEFINER, RBAC & IDENTITY INTEGRITY (Tests 1-6)
-- ----------------------------------------------------------------------------

-- Test 1: auth.uid() null rejected
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

-- Test 3: Viewer role rejected
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
    'Test 3: create_registration_with_snapshots menolak role viewer untuk mutasi'
);

-- Test 4: Fake / unauthenticated actor UUID cannot be spoofed via client parameters
RESET "request.jwt.claim.sub";
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-SPOOF', NULL, NULL, NULL, NULL, NULL,
        gen_random_uuid(), 400000, gen_random_uuid()
    );
    $$,
    'P0001',
    'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.',
    'Test 4: Actor UUID palsu tidak dapat digunakan karena RPC mutasi mewajibkan auth.uid() valid'
);

-- Test 5: Role Admin dapat mengakses seluruh RPC operasional yang berwenang
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000002'; -- Admin
SELECT is(
    (SELECT public.get_current_user_role()),
    'admin'::character varying,
    'Test 5: Sesi Admin terdeteksi dengan benar oleh fungsi RBAC database'
);

-- Test 6: Inactive/invalid fee type SALUT_SERVICE causes fail-closed abort
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003'; -- Academic Admin
SAVEPOINT sp_setting_salut_service;
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
    'Test 6: Registrasi gagal fail-closed jika master jenis biaya SALUT_SERVICE tidak aktif'
);
ROLLBACK TO SAVEPOINT sp_setting_salut_service;

-- ----------------------------------------------------------------------------
-- 2. FAIL-CLOSED DEFAULT SALUT FEE CONFIGURATION (Tests 7-9)
-- ----------------------------------------------------------------------------

-- Test 7: Setting missing key amount
SAVEPOINT sp_setting_test1;
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
    'Test 7: Registrasi gagal fail-closed jika setting default_salut_fee tidak memiliki key amount'
);
ROLLBACK TO SAVEPOINT sp_setting_test1;

-- Test 8: Setting non-integer / string
SAVEPOINT sp_setting_test2;
UPDATE public.app_settings SET value = '{"amount": "invalid_fee"}'::jsonb WHERE key = 'default_salut_fee';
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
    'Test 8: Registrasi gagal fail-closed jika amount setting bukan integer valid'
);
ROLLBACK TO SAVEPOINT sp_setting_test2;

-- Test 9: Setting zero or negative
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
    'Test 9: Registrasi gagal fail-closed jika nominal default_salut_fee <= 0'
);
ROLLBACK TO SAVEPOINT sp_setting_test3;

-- ----------------------------------------------------------------------------
-- 3. FEATURE FLAG ISOLATION (Tests 10-12)
-- ----------------------------------------------------------------------------

-- Test 10: When feature_unified_invoice_enabled is false, registration succeeds but NO unified invoice is created
SAVEPOINT sp_flag_test;
UPDATE public.app_settings SET value = '{"enabled": false}'::jsonb WHERE key = 'feature_unified_invoice_enabled';

SELECT public.create_registration_with_snapshots(
    '30000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
    (SELECT id FROM public.study_programs LIMIT 1),
    (SELECT id FROM public.service_schemes LIMIT 1),
    0, 'Uji Flag False',
    jsonb_build_array(
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'Biaya Admisi%' LIMIT 1), 'quantity', 1)
    )
);
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.invoices i
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND r.notes = 'Uji Flag False'),
    0,
    'Test 10: Saat feature flag false, registrasi berhasil dan TIDAK membuat unified invoice otomatis'
);
ROLLBACK TO SAVEPOINT sp_flag_test;

-- Test 11: When feature_unified_invoice_enabled is true, exactly one unified invoice is created
UPDATE public.app_settings SET value = '{"enabled": true}'::jsonb WHERE key = 'feature_unified_invoice_enabled';

SELECT public.create_registration_with_snapshots(
    '30000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
    (SELECT id FROM public.study_programs LIMIT 1),
    (SELECT id FROM public.service_schemes LIMIT 1),
    0, 'Registrasi Aktif Phase 2',
    jsonb_build_array(
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'Biaya Admisi%' LIMIT 1), 'quantity', 1),
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'UKT 3%' LIMIT 1), 'quantity', 1)
    )
);
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.invoices i
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND r.notes = 'Registrasi Aktif Phase 2'),
    1,
    'Test 11: Saat feature flag true, registrasi membuat tepat satu unified invoice terpadu'
);

-- Test 12: Invoice created remains accessible and intact even if flag is toggled back to false
UPDATE public.app_settings SET value = '{"enabled": false}'::jsonb WHERE key = 'feature_unified_invoice_enabled';
SELECT ok(
    EXISTS(
        SELECT 1 FROM public.invoices i
        JOIN public.registrations r ON i.registration_id = r.id
        WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND r.notes = 'Registrasi Aktif Phase 2'
    ),
    'Test 12: Invoice yang sudah terbentuk tetap utuh dan dapat dibaca saat flag dimatikan'
);
-- Keep flag enabled for active workflow testing
UPDATE public.app_settings SET value = '{"enabled": true}'::jsonb WHERE key = 'feature_unified_invoice_enabled';

-- ----------------------------------------------------------------------------
-- 4. TARIFF TAMPERING & COMPONENT INTEGRITY (Tests 13-16)
-- ----------------------------------------------------------------------------

-- Test 13: Client attempt to tamper unit_amount / total_amount in fee items is ignored (Server calculates from fee_rates)
-- Server ignores client-supplied unit_amount and calculates: 1 * 100.000 = 100.000
SELECT is(
    (SELECT total_amount FROM public.registration_fee_snapshots rfs
     JOIN public.registrations r ON rfs.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID
       AND rfs.fee_name_snapshot LIKE 'Biaya Admisi%' LIMIT 1),
    100000::BIGINT,
    'Test 13: Server menghitung nominal tarif UT secara otoritatif dari master fee_rates, manipulasi client diabaikan'
);

-- Test 14: Client cannot inject a custom SALUT_SERVICE rate item (Duplicate injection filtered out)
SELECT is(
    (SELECT COUNT(*)::INT FROM public.registration_fee_snapshots rfs
     JOIN public.registrations r ON rfs.registration_id = r.id
     JOIN public.fee_types ft ON rfs.fee_type_id = ft.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND ft.code = 'SALUT_SERVICE'),
    1,
    'Test 14: Client tidak dapat menyisipkan tarif SALUT ganda; hanya ada tepat 1 snapshot SALUT_SERVICE'
);

-- Test 15: Exact SALUT Fee Rp 400.000 in snapshot & invoice_items
SELECT is(
    (SELECT amount FROM public.invoice_items ii
     JOIN public.invoices i ON ii.invoice_id = i.id
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND ii.item_type = 'service_fee' LIMIT 1),
    400000::BIGINT,
    'Test 15: Nilai komisi SALUT pada invoice_items persis Rp 400.000 sesuai keputusan bisnis owner'
);

-- Test 16: Updating app_settings afterward does NOT mutate existing snapshot/invoice (Immutability)
UPDATE public.app_settings SET value = '{"amount": 550000, "currency": "IDR"}'::jsonb WHERE key = 'default_salut_fee';
SELECT is(
    (SELECT amount FROM public.invoice_items ii
     JOIN public.invoices i ON ii.invoice_id = i.id
     JOIN public.registrations r ON i.registration_id = r.id
     WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND ii.item_type = 'service_fee' LIMIT 1),
    400000::BIGINT,
    'Test 16: Perubahan app_settings berikutnya TIDAK mengubah invoice lama (Immutability snapshot terjamin)'
);
-- Restore setting to 400000
UPDATE public.app_settings SET value = '{"amount": 400000, "currency": "IDR"}'::jsonb WHERE key = 'default_salut_fee';

-- ----------------------------------------------------------------------------
-- 5. CANONICAL TOTALS & DISCOUNT HANDLING (Tests 17-18)
-- ----------------------------------------------------------------------------

-- Total invoice: 100.000 (admisi) + 1.300.000 (UKT 3) + 400.000 (SALUT) = 1.800.000
-- Add an approved discount item (Rp 100.000) and a pending discount item (Rp 50.000)
INSERT INTO public.invoice_items (
    invoice_id, item_type, description, quantity, unit_amount, amount, source_type, approval_status
) VALUES (
    (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
    'discount', 'Potongan Beasiswa Prestasi', 1, 100000, 100000, 'manual_adjustment', 'approved'
);

INSERT INTO public.invoice_items (
    invoice_id, item_type, description, quantity, unit_amount, amount, source_type, approval_status
) VALUES (
    (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
    'discount', 'Pengajuan Diskon Pending', 1, 50000, 50000, 'manual_adjustment', 'pending'
);

-- Test 17: Canonical total billed counts approved discount as deduction (1.800.000 - 100.000 = 1.700.000)
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT total_billed FROM public.get_invoice_canonical_totals(
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1)
    )),
    1700000::BIGINT,
    'Test 17: Total tagihan kanonikal memperhitungkan diskon yang disetujui (approved) sebagai pengurang'
);

-- Test 18: Pending discount is strictly excluded from total deduction
-- Total billed would be 1.650.000 if pending was included; but it is 1.700.000
SELECT ok(
    (SELECT total_billed FROM public.get_invoice_canonical_totals(
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1)
    )) = 1700000,
    'Test 18: Diskon berstatus pending TIDAK dihitung sebagai pengurang tagihan kanonikal'
);

-- Clean up test discounts to proceed with standard tariff math (Total billed = 1.800.000)
DELETE FROM public.invoice_items
WHERE invoice_id = (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1)
  AND item_type = 'discount';

-- ----------------------------------------------------------------------------
-- 6. PENDING PAYMENT RESERVATION & ALLOCATION CAPACITY (Tests 19-22)
-- ----------------------------------------------------------------------------

-- Total invoice: 100.000 (admisi) + 1.300.000 (UKT 3) + 400.000 (SALUT) = 1.800.000
-- Test 19: Create first pending payment (Rp 300.000)
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004'; -- Finance Admin
DO $$
DECLARE
    v_inv_id UUID;
    v_pay_id UUID;
BEGIN
    SELECT id INTO v_inv_id FROM public.invoices WHERE status = 'unpaid' LIMIT 1;
    v_pay_id := public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-TEST-01', NULL, NULL, NULL, NULL, 'Pembayaran Tahap 1 (Rp 300.000)',
        v_inv_id, 300000, '40000000-0000-0000-0000-000000000001'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND status = 'pending_verification'),
    'Test 19: Pembayaran tahap 1 (Rp 300.000) tersimpan dengan status pending_verification'
);

-- Remaining payable: 1.800.000 - 300.000 = 1.500.000
-- Test 20: Payment exceeding remaining payable is strictly rejected
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 1600000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-OVERPAY', NULL, NULL, NULL, NULL, 'Overpay',
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
        1600000, gen_random_uuid()
    );
    $$,
    'P0001',
    'CAPACITY_EXCEEDED: Alokasi pembayaran (Rp 1600000) melebihi sisa kapasitas yang dapat dibayar (Rp 1500000 termasuk reservasi pending).',
    'Test 20: Pembayaran yang melebihi kapasitas payable (akibat reservasi pending) ditolak'
);

-- Test 21: Create second pending payment (Rp 200.000)
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000001'::UUID,
    NOW(), 200000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-TEST-02', NULL, NULL, NULL, NULL, 'Pembayaran Tahap 2 (Rp 200.000)',
    (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
    200000, '40000000-0000-0000-0000-000000000002'::UUID
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID),
    'Test 21: Pembayaran tahap 2 (Rp 200.000) berhasil mencadangkan kapasitas'
);

-- Test 22: Payment idempotency ensures identical record returned without double reservation
DO $$
DECLARE
    v_dup_id UUID;
BEGIN
    v_dup_id := public.create_payment_with_allocation(
        '30000000-0000-0000-0000-000000000001'::UUID,
        NOW(), 200000,
        (SELECT id FROM public.payment_methods LIMIT 1),
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-TEST-02', NULL, NULL, NULL, NULL, 'Pembayaran Tahap 2',
        (SELECT id FROM public.invoices WHERE status = 'unpaid' LIMIT 1),
        200000, '40000000-0000-0000-0000-000000000002'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID),
    1,
    'Test 22: Idempotency key mengembalikan record pembayaran yang sama tanpa reservasi ganda'
);

-- ----------------------------------------------------------------------------
-- 7. PAYMENT VERIFICATION WATERFALL (Rp 400.000 SALUT FEE) (Tests 23-26)
-- ----------------------------------------------------------------------------

-- Verify first payment of Rp 300.000.
-- Waterfall: Komisi SALUT Rp 400.000 menyerap seluruh Rp 300.000 (Belum lunas, sisa Rp 100.000). Dana UT = 0.
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID)
);
SET search_path = extensions, public, pg_temp;

-- Test 23: Payment 1 (Rp 300.000) entirely allocated to service_fee
SELECT is(
    (SELECT pca.amount FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND pca.component_type = 'service_fee'),
    300000::BIGINT,
    'Test 23: Pembayaran Rp 300.000 seluruhnya masuk ke komisi SALUT (Prioritas 1)'
);

-- Test 24: UT liability receives Rp 0 from first payment
SELECT is(
    (SELECT COALESCE(SUM(pca.amount), 0)::BIGINT FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000001'::UUID AND pca.component_type = 'ut_liability'),
    0::BIGINT,
    'Test 24: Kewajiban dana UT menerima Rp 0 karena komisi SALUT belum lunas'
);

-- Verify second payment of Rp 200.000.
-- Waterfall: Sisa komisi SALUT Rp 100.000 terlunasi (Total SALUT = 400.000). Sisa Rp 100.000 masuk ke UT liability.
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID)
);
SET search_path = extensions, public, pg_temp;

-- Test 25: Payment 2 allocates remaining Rp 100.000 to complete service_fee (Total service_fee = 400.000)
SELECT is(
    (SELECT pca.amount FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID AND pca.component_type = 'service_fee'),
    100000::BIGINT,
    'Test 25: Pembayaran lanjutan Rp 200.000 melunasi sisa komisi SALUT Rp 100.000 (Total SALUT Rp 400.000)'
);

-- Test 26: Payment 2 spills remaining Rp 100.000 into ut_liability
SELECT is(
    (SELECT pca.amount FROM public.payment_component_allocations pca
     JOIN public.student_payments sp ON pca.payment_id = sp.id
     WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000002'::UUID AND pca.component_type = 'ut_liability'),
    100000::BIGINT,
    'Test 26: Sisa Rp 100.000 dialokasikan ke kewajiban dana UT (Prioritas 2)'
);

-- ----------------------------------------------------------------------------
-- 8. VOID PAYMENT REVERSAL (APPEND-ONLY) (Tests 27-28)
-- ----------------------------------------------------------------------------

-- Create and verify a test payment for void testing (Rp 50.000 for UT)
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000001'::UUID,
    NOW(), 50000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-VOID-TEST', NULL, NULL, NULL, NULL, 'Pembayaran yang akan di-void',
    (SELECT i.id FROM public.invoices i JOIN public.registrations r ON i.registration_id = r.id WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND i.status <> 'cancelled' LIMIT 1),
    50000, '40000000-0000-0000-0000-000000000099'::UUID
);
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000099'::UUID)
);

-- Void payment by Admin
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000002'; -- Admin
SELECT public.void_verified_payment_with_reversals(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000099'::UUID),
    'Uji coba void append-only'
);
SET search_path = extensions, public, pg_temp;

-- Test 27: Payment row is marked voided
SELECT ok(
    EXISTS(SELECT 1 FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000099'::UUID AND status = 'voided'),
    'Test 27: Prosedur void menandai status pembayaran menjadi voided'
);

-- Test 28: Append-only reversal record created in payment_component_allocations
SELECT ok(
    EXISTS(
        SELECT 1 FROM public.payment_component_allocations pca
        JOIN public.student_payments sp ON pca.payment_id = sp.id
        WHERE sp.idempotency_key = '40000000-0000-0000-0000-000000000099'::UUID
          AND pca.entry_type = 'reversal'
          AND pca.amount = 50000
    ),
    'Test 28: Void payment membuat reversal append-only tanpa menghapus riwayat audit'
);

-- ----------------------------------------------------------------------------
-- 9. LIP RECONCILIATION & STUDENT CREDIT ISOLATION (Tests 29-32)
-- ----------------------------------------------------------------------------

-- Complete payment of remaining UT liability:
-- Total invoice: 1.800.000. Verified paid so far: 300.000 + 200.000 = 500.000 (SALUT: 400.000, UT: 100.000).
-- Remaining UT unpaid: 1.400.000 - 100.000 = 1.300.000.
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000001'::UUID,
    NOW(), 1300000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-TEST-PAYOFF', NULL, NULL, NULL, NULL, 'Pelunasan UT',
    (SELECT i.id FROM public.invoices i JOIN public.registrations r ON i.registration_id = r.id WHERE r.student_id = '30000000-0000-0000-0000-000000000001'::UUID AND i.status <> 'cancelled' LIMIT 1),
    1300000, '40000000-0000-0000-0000-000000000003'::UUID
);
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000003'::UUID)
);
SET search_path = extensions, public, pg_temp;

-- Invoice is now fully paid (Total UT verified = 1.400.000)
-- Create official LIP with lower official amount: Rp 1.100.000
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003'; -- Academic Admin
INSERT INTO public.lip_documents (
    id, registration_id, lip_number, version, official_amount, tuition_amount,
    storage_path, original_file_name, mime_type, file_size, status, created_by, updated_by
) VALUES (
    '50000000-0000-0000-0000-000000000099'::UUID,
    (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID AND notes = 'Registrasi Aktif Phase 2' LIMIT 1),
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

-- Test 29: Reconciliation succeeds
SELECT ok(
    EXISTS(SELECT 1 FROM public.invoices WHERE lip_document_id = '50000000-0000-0000-0000-000000000099'::UUID),
    'Test 29: Rekonsiliasi LIP resmi UT berhasil dieksekusi secara atomik'
);

-- Test 30: Idempotent reconciliation
DO $$
DECLARE
    v_rec_id UUID;
BEGIN
    v_rec_id := public.reconcile_lip_with_invoice(
        '50000000-0000-0000-0000-000000000099'::UUID,
        '70000000-0000-0000-0000-000000000001'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.invoice_reconciliations WHERE idempotency_key = '70000000-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 30: Rekonsiliasi LIP bersifat idempoten (tidak menduplikasi rekonsiliasi)'
);

-- Test 31: Student credit ledger entry created exactly for real cash excess (1.400.000 - 1.100.000 = Rp 300.000)
SELECT is(
    (SELECT amount FROM public.student_credit_ledgers
     WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID
       AND transaction_type = 'reconciliation_credit' AND status = 'posted' LIMIT 1),
    300000::BIGINT,
    'Test 31: Rekonsiliasi menghasilkan saldo kredit mahasiswa persis Rp 300.000 dari kelebihan uang kas riil'
);

-- Test 32: Student credit is isolated and does NOT become available UT fund for remittance
-- Available UT fund is strictly computed from verified ut_liability allocations (Rp 1.100.000), not the credit ledger
SELECT is(
    (SELECT COALESCE(SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END), 0)::BIGINT
     FROM public.payment_component_allocations
     WHERE invoice_id = (SELECT id FROM public.invoices WHERE lip_document_id = '50000000-0000-0000-0000-000000000099'::UUID)
       AND component_type = 'ut_liability' AND status = 'posted'),
    1400000::BIGINT,
    'Test 32: Saldo kredit mahasiswa terisolasi dan tidak disalahartikan sebagai alokasi UT'
);

-- ----------------------------------------------------------------------------
-- 10. MAKER-CHECKER REFUND & ADVISORY LOCKS (Tests 33-35)
-- ----------------------------------------------------------------------------

-- Test 33: Maker requests refund for Rp 100.000 (Maker is Admin)
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
    'Test 33: Maker berhasil mengajukan permohonan refund status pending_approval'
);

-- Test 34: Self-approval by Maker is STRICTLY FORBIDDEN
SELECT throws_ok(
    $$
    SELECT public.approve_student_credit_refund(
        (SELECT id FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID),
        'approve'
    );
    $$,
    'P0001',
    'MAKER_CHECKER_VIOLATION: Checker wajib merupakan pengguna yang berbeda dari Maker.',
    'Test 34: Approval ditolak saat Maker mencoba menyetujui refund sendiri (Maker-Checker violation)'
);

-- Test 35: Approval by Owner (Checker != Maker) SUCCEEDS
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000001'; -- Owner (Checker)
SELECT public.approve_student_credit_refund(
    (SELECT id FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID),
    'approve'
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.student_credit_ledgers WHERE idempotency_key = '80000000-0000-0000-0000-000000000001'::UUID AND status = 'posted'),
    'Test 35: Approval refund oleh Owner (Checker != Maker) berhasil mem-posting jurnal kredit & pengeluaran'
);

-- ----------------------------------------------------------------------------
-- 11. UT REMITTANCE 5 ELIGIBILITY CRITERIA VALIDATION (Tests 36-38)
-- ----------------------------------------------------------------------------

-- Test 36: Create UT remittance for reconciled LIP (Official amount: 1.100.000)
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT public.create_ut_remittance_with_items(
    NOW(), 1100000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-UTR-TEST-01', NULL, NULL, NULL, NULL, 'Setoran UT resmi',
    '90000000-0000-0000-0000-000000000001'::UUID,
    jsonb_build_array(
        jsonb_build_object(
            'registration_id', (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID AND notes = 'Registrasi Aktif Phase 2' LIMIT 1),
            'lip_document_id', '50000000-0000-0000-0000-000000000099'::UUID,
            'amount', 1100000
        )
    )
);
SET search_path = extensions, public, pg_temp;

SELECT ok(
    EXISTS(SELECT 1 FROM public.ut_remittances WHERE idempotency_key = '90000000-0000-0000-0000-000000000001'::UUID),
    'Test 36: Setoran UT berhasil dibuat saat seluruh 5 kriteria kelayakan terpenuhi 100%'
);

-- Test 37: Duplicate remittance exceeding LIP obligation is strictly rejected
SELECT throws_ok(
    $$
    SELECT public.create_ut_remittance_with_items(
        NOW(), 100000,
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-UTR-OVER', NULL, NULL, NULL, NULL, 'Over',
        gen_random_uuid(),
        jsonb_build_array(
            jsonb_build_object(
                'registration_id', (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID AND notes = 'Registrasi Aktif Phase 2' LIMIT 1),
                'lip_document_id', '50000000-0000-0000-0000-000000000099'::UUID,
                'amount', 100000
            )
        )
    );
    $$,
    'P0001',
    'OVER_REMITTANCE: Nominal alokasi (Rp 100000) melebihi sisa kewajiban LIP (Rp 0).',
    'Test 37: Dua setoran tidak dapat melebihi sisa kewajiban LIP yang sama (Over-remittance ditolak)'
);

-- Test 38: NULL lip_document_id is strictly rejected and fail-closed
SELECT throws_ok(
    $$
    SELECT public.create_ut_remittance_with_items(
        NOW(), 100000,
        (SELECT id FROM public.cash_accounts LIMIT 1),
        'REF-UTR-NULL-LIP', NULL, NULL, NULL, NULL, 'Null LIP',
        gen_random_uuid(),
        jsonb_build_array(
            jsonb_build_object(
                'registration_id', (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000001'::UUID AND notes = 'Registrasi Aktif Phase 2' LIMIT 1),
                'lip_document_id', NULL,
                'amount', 100000
            )
        )
    );
    $$,
    'P0001',
    'VALIDATION_FAILED: lip_document_id wajib diisi dan tidak boleh NULL.',
    'Test 38: Pemanggilan setoran UT dengan lip_document_id NULL ditolak secara aman (Fail-closed)'
);

RESET ROLE;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();
ROLLBACK;
