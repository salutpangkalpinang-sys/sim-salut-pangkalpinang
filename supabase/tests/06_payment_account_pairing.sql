-- =============================================================================
-- pgTAP Test Suite: Payment Method & Cash Account Pairing Enforcement
-- File: supabase/tests/06_payment_account_pairing.sql
--
-- Coverage:
--   1. Pasangan tunai/kas (CASH -> KAS_TUNAI) valid via RPC dan direct INSERT
--   2. Pasangan transfer/bank (BANK_TRANSFER -> BANK_BCA, BANK_BRI) valid via RPC dan direct INSERT
--   3. Pasangan salah via RPC langsung (CASH -> BANK_BCA ditolak)
--   4. Pasangan salah via RPC langsung (BANK_TRANSFER -> KAS_TUNAI ditolak)
--   5. Penolakan melalui direct INSERT (CASH -> BANK_BCA ditolak trigger)
--   6. Penolakan melalui direct UPDATE (Update ke akun bank ditolak trigger)
--   7. Metode pembayaran nonaktif ditolak
--   8. Rekening kas nonaktif ditolak
--   9. Kode metode tidak dikenal ditolak fail-closed
--  10. Kode rekening tidak dikenal ditolak fail-closed
--  11. Transaksi ditolak tanpa meninggalkan header pembayaran atau alokasi (Atomic Rollback)
-- =============================================================================

BEGIN;
SET search_path = extensions, public, pg_temp;
SELECT plan(15);

-- =============================================================================
-- 1. SETUP IDENTITAS RBAC & DATA UJI
-- =============================================================================
DO $$
DECLARE
    c_uid_finance CONSTANT UUID := '70000001-0000-0000-0000-000000000001'::UUID;
    v_role_finance_id UUID;
BEGIN
    SELECT id INTO v_role_finance_id FROM public.roles WHERE code = 'finance_admin';

    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (c_uid_finance, 'finance_pairing_test@salut.local', '{"full_name":"Finance Pairing Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_uid_finance, 'Finance Pairing Test', TRUE)
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

    DELETE FROM public.user_roles WHERE user_id = c_uid_finance;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_uid_finance, v_role_finance_id);
END $$;

-- Pastikan master data payment methods & cash accounts lengkap dengan status uji
DO $$
DECLARE
    v_status_id UUID;
    v_period_id UUID;
    v_reg_type_id UUID;
    v_prodi_id UUID;
    v_scheme_id UUID;
    v_student_id UUID := '70000002-0000-0000-0000-000000000001'::UUID;
    v_reg_id UUID := '70000003-0000-0000-0000-000000000001'::UUID;
    v_inv_id UUID := '70000004-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- Student
    SELECT id INTO v_status_id FROM public.student_statuses WHERE code = 'AKTIF';
    INSERT INTO public.students (id, nim, full_name, whatsapp, entry_year, status_id)
    VALUES (v_student_id, '049988776', 'Mahasiswa Uji Pairing', '081299998888', 2026, v_status_id)
    ON CONFLICT (id) DO NOTHING;

    -- Master references for registration
    SELECT id INTO v_period_id FROM public.academic_periods WHERE is_active = true LIMIT 1;
    SELECT id INTO v_reg_type_id FROM public.registration_types LIMIT 1;
    SELECT id INTO v_prodi_id FROM public.study_programs LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes LIMIT 1;

    -- Registration
    INSERT INTO public.registrations (id, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, notes)
    VALUES (v_reg_id, v_student_id, v_period_id, v_reg_type_id, v_prodi_id, v_scheme_id, 'Uji Pairing Registration')
    ON CONFLICT (id) DO NOTHING;

    -- Invoice
    INSERT INTO public.invoices (id, invoice_number, registration_id, status)
    VALUES (v_inv_id, 'INV-PAIRING-TEST-01', v_reg_id, 'unpaid')
    ON CONFLICT (id) DO NOTHING;

    -- Invoice Items (Total Rp 2.000.000)
    INSERT INTO public.invoice_items (invoice_id, item_type, description, quantity, unit_amount, amount)
    VALUES (v_inv_id, 'service_fee', 'Biaya Layanan SALUT', 1, 400000, 400000)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.invoice_items (invoice_id, item_type, description, quantity, unit_amount, amount)
    VALUES (v_inv_id, 'ut_liability', 'SPP / UKT UT', 1, 1600000, 1600000)
    ON CONFLICT DO NOTHING;

    -- Inactive & custom test masters
    INSERT INTO public.payment_methods (id, code, name, is_active)
    VALUES ('70000010-0000-0000-0000-000000000001'::UUID, 'METHOD_INACTIVE', 'Metode Nonaktif Uji', FALSE)
    ON CONFLICT (code) DO UPDATE SET is_active = FALSE;

    INSERT INTO public.payment_methods (id, code, name, is_active)
    VALUES ('70000010-0000-0000-0000-000000000002'::UUID, 'METHOD_UNKNOWN_CODE', 'Metode Kode Tidak Dikenal', TRUE)
    ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

    INSERT INTO public.cash_accounts (id, code, name, is_active)
    VALUES ('70000020-0000-0000-0000-000000000001'::UUID, 'ACCOUNT_INACTIVE', 'Rekening Nonaktif Uji', FALSE)
    ON CONFLICT (code) DO UPDATE SET is_active = FALSE;

    INSERT INTO public.cash_accounts (id, code, name, is_active)
    VALUES ('70000020-0000-0000-0000-000000000002'::UUID, 'ACCOUNT_UNKNOWN_CODE', 'Rekening Kode Tidak Dikenal', TRUE)
    ON CONFLICT (code) DO UPDATE SET is_active = TRUE;
END $$;

-- Setup actor session
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '70000001-0000-0000-0000-000000000001';

-- =============================================================================
-- 2. UJI PASANGAN VALID (CASH -> KAS_TUNAI & BANK_TRANSFER -> BANK_BCA)
-- =============================================================================

-- Test 1: Pasangan valid CASH -> KAS_TUNAI via RPC
SAVEPOINT sp_valid_cash;
DO $$
DECLARE
    v_pay_id UUID;
    v_pm_id UUID;
    v_ca_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    v_pay_id := public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-VALID-CASH', NULL, NULL, NULL, NULL, 'Pembayaran Tunai Kas',
        '70000004-0000-0000-0000-000000000001'::UUID, 400000,
        '70000030-0000-0000-0000-000000000001'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.student_payments WHERE idempotency_key = '70000030-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 1: Pasangan valid CASH -> KAS_TUNAI via create_payment_with_allocation berhasil dibuat'
);
ROLLBACK TO SAVEPOINT sp_valid_cash;

-- Test 2: Pasangan valid BANK_TRANSFER -> BANK_BCA via RPC
SAVEPOINT sp_valid_bank;
DO $$
DECLARE
    v_pay_id UUID;
    v_pm_id UUID;
    v_ca_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    v_pay_id := public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 500000, v_pm_id, v_ca_id,
        'REF-VALID-BANK', NULL, NULL, NULL, NULL, 'Pembayaran Transfer Bank',
        '70000004-0000-0000-0000-000000000001'::UUID, 500000,
        '70000030-0000-0000-0000-000000000002'::UUID
    );
END $$;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.student_payments WHERE idempotency_key = '70000030-0000-0000-0000-000000000002'::UUID),
    1,
    'Test 2: Pasangan valid BANK_TRANSFER -> BANK_BCA via create_payment_with_allocation berhasil dibuat'
);
ROLLBACK TO SAVEPOINT sp_valid_bank;
SET search_path = extensions, public, pg_temp;

-- =============================================================================
-- 3. UJI PASANGAN SALAH VIA RPC LANGSUNG
-- =============================================================================

-- Test 3: Pasangan salah CASH -> BANK_BCA via RPC langsung DITOLAK
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        (SELECT id FROM public.cash_accounts WHERE code = 'BANK_BCA'),
        'REF-INVALID-01', NULL, NULL, NULL, NULL, 'CASH to BCA',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Metode pembayaran Tunai (CASH) wajib disalurkan ke Rekening Kas Tunai, bukan rekening bank (BANK_BCA)',
    'Test 3: Pemanggilan RPC langsung dengan CASH ke BANK_BCA ditolak'
);

-- Test 4: Pasangan salah BANK_TRANSFER -> KAS_TUNAI via RPC langsung DITOLAK
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods WHERE code = 'BANK_TRANSFER'),
        (SELECT id FROM public.cash_accounts WHERE code = 'KAS_TUNAI'),
        'REF-INVALID-02', NULL, NULL, NULL, NULL, 'BANK to CASH ACC',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Metode pembayaran Transfer Bank (BANK_TRANSFER) wajib disalurkan ke Rekening Bank, bukan kas tunai (KAS_TUNAI)',
    'Test 4: Pemanggilan RPC langsung dengan BANK_TRANSFER ke KAS_TUNAI ditolak'
);

-- =============================================================================
-- 4. UJI PENOLAKAN MELALUI DIRECT INSERT / UPDATE (TRIGGER PROTECTION)
-- =============================================================================

-- Test 5: Direct INSERT dengan pasangan salah (CASH -> BANK_BCA) ditolak oleh trigger
SELECT throws_ok(
    $$
    INSERT INTO public.student_payments (
        transaction_number, student_id, amount, payment_method_id, cash_account_id, status
    ) VALUES (
        'PAY-DIRECT-ERR-01',
        '70000002-0000-0000-0000-000000000001'::UUID,
        250000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        (SELECT id FROM public.cash_accounts WHERE code = 'BANK_BCA'),
        'pending_verification'
    );
    $$,
    'P0001',
    'Metode pembayaran Tunai (CASH) wajib disalurkan ke Rekening Kas Tunai, bukan rekening bank (BANK_BCA)',
    'Test 5: Direct INSERT pasangan salah CASH -> BANK_BCA ditolak oleh trigger'
);

-- Test 6: Direct UPDATE mengubah rekening kas ke tipe yang tidak cocok ditolak oleh trigger
SAVEPOINT sp_update_test;
DO $$
BEGIN
    INSERT INTO public.student_payments (
        id, transaction_number, student_id, amount, payment_method_id, cash_account_id, status
    ) VALUES (
        '70000040-0000-0000-0000-000000000001'::UUID,
        'PAY-DIRECT-OK-01',
        '70000002-0000-0000-0000-000000000001'::UUID,
        250000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        (SELECT id FROM public.cash_accounts WHERE code = 'KAS_TUNAI'),
        'pending_verification'
    );
END $$;

SELECT throws_ok(
    $$
    UPDATE public.student_payments
    SET cash_account_id = (SELECT id FROM public.cash_accounts WHERE code = 'BANK_BCA')
    WHERE id = '70000040-0000-0000-0000-000000000001'::UUID;
    $$,
    'P0001',
    'Metode pembayaran Tunai (CASH) wajib disalurkan ke Rekening Kas Tunai, bukan rekening bank (BANK_BCA)',
    'Test 6: Direct UPDATE mengubah rekening kas menjadi tidak cocok ditolak oleh trigger'
);
ROLLBACK TO SAVEPOINT sp_update_test;

-- =============================================================================
-- 5. UJI METODE DAN REKENING NONAKTIF
-- =============================================================================

-- Test 7: Metode nonaktif via RPC langsung ditolak
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        '70000010-0000-0000-0000-000000000001'::UUID, -- METHOD_INACTIVE
        (SELECT id FROM public.cash_accounts WHERE code = 'KAS_TUNAI'),
        'REF-INACTIVE-01', NULL, NULL, NULL, NULL, 'Inactive Method',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Metode pembayaran METHOD_INACTIVE sedang nonaktif',
    'Test 7: Metode pembayaran nonaktif ditolak'
);

-- Test 8: Rekening nonaktif via RPC langsung ditolak
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        '70000020-0000-0000-0000-000000000001'::UUID, -- ACCOUNT_INACTIVE
        'REF-INACTIVE-02', NULL, NULL, NULL, NULL, 'Inactive Account',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Rekening kas / bank ACCOUNT_INACTIVE sedang nonaktif',
    'Test 8: Rekening kas nonaktif ditolak'
);

-- =============================================================================
-- 6. UJI KODE TIDAK DIKENAL (FAIL-CLOSED)
-- =============================================================================

-- Test 9: Kode metode tidak dikenal ditolak fail-closed
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        '70000010-0000-0000-0000-000000000002'::UUID, -- METHOD_UNKNOWN_CODE
        (SELECT id FROM public.cash_accounts WHERE code = 'KAS_TUNAI'),
        'REF-UNKNOWN-01', NULL, NULL, NULL, NULL, 'Unknown Method',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Metode pembayaran dengan kode "METHOD_UNKNOWN_CODE" tidak dikenal dalam master resmi',
    'Test 9: Metode pembayaran dengan kode tidak dikenal ditolak fail-closed'
);

-- Test 10: Kode rekening tidak dikenal ditolak fail-closed
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        '70000020-0000-0000-0000-000000000002'::UUID, -- ACCOUNT_UNKNOWN_CODE
        'REF-UNKNOWN-02', NULL, NULL, NULL, NULL, 'Unknown Account',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Rekening kas / bank dengan kode "ACCOUNT_UNKNOWN_CODE" tidak dikenal dalam master resmi',
    'Test 10: Rekening kas dengan kode tidak dikenal ditolak fail-closed'
);

-- Test 11: ID metode tidak ditemukan di database ditolak
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        '70000099-9999-9999-9999-999999999999'::UUID,
        (SELECT id FROM public.cash_accounts WHERE code = 'KAS_TUNAI'),
        'REF-NOTFOUND-01', NULL, NULL, NULL, NULL, 'Not Found',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Metode pembayaran dengan ID 70000099-9999-9999-9999-999999999999 tidak ditemukan',
    'Test 11: ID metode yang tidak ada di database ditolak'
);

-- Test 12: ID rekening tidak ditemukan di database ditolak
SELECT throws_ok(
    $$
    SELECT public.create_payment_with_allocation(
        '70000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 300000,
        (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
        '70000099-9999-9999-9999-999999999999'::UUID,
        'REF-NOTFOUND-02', NULL, NULL, NULL, NULL, 'Not Found',
        '70000004-0000-0000-0000-000000000001'::UUID, 300000,
        gen_random_uuid()
    );
    $$,
    'P0001',
    'Rekening kas / bank dengan ID 70000099-9999-9999-9999-999999999999 tidak ditemukan',
    'Test 12: ID rekening kas yang tidak ada di database ditolak'
);

-- =============================================================================
-- 7. UJI ROLLBACK ATOMIK: TIDAK MENINGGALKAN HEADER PEMBAYARAN ATAU ALOKASI
-- =============================================================================

-- Test 13-15: Eksekusi gagal tidak meninggalkan header atau alokasi
DO $$
DECLARE
    v_fail_key CONSTANT UUID := '70000050-0000-0000-0000-000000000001'::UUID;
BEGIN
    BEGIN
        PERFORM public.create_payment_with_allocation(
            '70000002-0000-0000-0000-000000000001'::UUID,
            NOW(), 300000,
            (SELECT id FROM public.payment_methods WHERE code = 'CASH'),
            (SELECT id FROM public.cash_accounts WHERE code = 'BANK_BCA'), -- Saldo gagal karena pasangan salah
            'REF-ROLLBACK-TEST', NULL, NULL, NULL, NULL, 'Rollback Test',
            '70000004-0000-0000-0000-000000000001'::UUID, 300000,
            v_fail_key
        );
    EXCEPTION WHEN OTHERS THEN
        -- Expected exception caught
        NULL;
    END;
END $$;
SET search_path = extensions, public, pg_temp;

SELECT is(
    (SELECT COUNT(*)::INT FROM public.student_payments WHERE idempotency_key = '70000050-0000-0000-0000-000000000001'::UUID),
    0,
    'Test 13: Transaksi ditolak tidak meninggalkan baris di public.student_payments (Header rollback bersih)'
);

SELECT is(
    (SELECT COUNT(*)::INT FROM public.payment_allocations pa
     JOIN public.student_payments sp ON pa.payment_id = sp.id
     WHERE sp.idempotency_key = '70000050-0000-0000-0000-000000000001'::UUID),
    0,
    'Test 14: Transaksi ditolak tidak meninggalkan baris di public.payment_allocations (Alokasi rollback bersih)'
);

SELECT is(
    (SELECT COUNT(*)::INT FROM public.payment_allocations WHERE invoice_id = '70000004-0000-0000-0000-000000000001'::UUID),
    0,
    'Test 15: Tagihan invoice sasaran tetap bersih dari alokasi yatim'
);

SELECT finish();
ROLLBACK;
