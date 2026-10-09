-- =============================================================================
-- pgTAP Test Suite: Audit Logging for Student Payments & UT Remittances
-- File: supabase/tests/07_audit_logging_payments_and_remittances.sql
--
-- Coverage:
--   1. Payment Create produces exactly 1 audit log (action: payment_created, correct actor, amount, txn_number)
--   2. Payment Create idempotent retry returns same ID and does NOT duplicate audit log
--   3. Payment Verify produces exactly 1 audit log (action: payment_verified, status pending -> verified)
--   4. Payment Verify idempotent recall does NOT duplicate audit log
--   5. Payment Reject produces exactly 1 audit log (action: payment_rejected, reason recorded)
--   6. Payment Void Request produces exactly 1 audit log (action: payment_void_requested)
--   7. Payment Void Approval (Maker-Checker) produces exactly 1 audit log (action: payment_void_approved)
--   8. Payment Void Rejection produces exactly 1 audit log (action: payment_void_rejected)
--   9. UT Remittance Create produces exactly 1 audit log (action: ut_remittance_created)
--  10. UT Remittance Create idempotent retry does NOT duplicate audit log
--  11. UT Remittance Verify produces exactly 1 audit log (action: ut_remittance_verified)
--  12. UT Remittance Verify idempotent recall does NOT duplicate audit log
--  13. UT Remittance Reject produces exactly 1 audit log (action: ut_remittance_rejected)
--  14. UT Remittance Void Request produces exactly 1 audit log (action: ut_remittance_void_requested)
--  15. UT Remittance Void Approval produces exactly 1 audit log (action: ut_remittance_void_approved)
--  16. UT Remittance Void Rejection produces exactly 1 audit log (action: ut_remittance_void_rejected)
--  17. Capacity Exceeded rejection before mutation produces 0 records (precondition guard)
--  18. Atomic Rollback: Error during audit logging rolls back student payment and allocation completely
-- =============================================================================

BEGIN;
RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT plan(18);

-- =============================================================================
-- 1. SETUP IDENTITAS RBAC & MASTER DATA UJI
-- =============================================================================
DO $$
DECLARE
    c_uid_finance CONSTANT UUID := '80000001-0000-0000-0000-000000000001'::UUID;
    v_role_viewer_id UUID;
    c_uid_owner CONSTANT UUID := '80000001-0000-0000-0000-000000000002'::UUID;
    v_role_finance_id UUID;
    v_role_owner_id UUID;
    v_status_id UUID;
    v_period_id UUID;
    v_reg_type_id UUID;
    v_prodi_id UUID;
    v_scheme_id UUID;
    v_student_id UUID := '80000002-0000-0000-0000-000000000001'::UUID;
    v_reg_id UUID := '80000003-0000-0000-0000-000000000001'::UUID;
    v_inv_id UUID := '80000004-0000-0000-0000-000000000001'::UUID;
    v_lip_id UUID := '80000005-0000-0000-0000-000000000001'::UUID;
BEGIN
    SELECT id INTO v_role_finance_id FROM public.roles WHERE code = 'finance_admin';
    SELECT id INTO v_role_owner_id FROM public.roles WHERE code = 'owner';
    SELECT id INTO v_role_viewer_id FROM public.roles WHERE code = 'viewer';

    -- Setup Finance Actor
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (c_uid_finance, 'finance_audit_test@salut.local', '{"full_name":"Finance Audit Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_uid_finance, 'Finance Audit Test', TRUE)
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

    DELETE FROM public.user_roles WHERE user_id = c_uid_finance;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_uid_finance, v_role_finance_id);

    -- Setup Owner Actor (for Maker-Checker approval)
    INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
    VALUES (c_uid_owner, 'owner_audit_test@salut.local', '{"full_name":"Owner Audit Test"}', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (c_uid_owner, 'Owner Audit Test', TRUE)
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

    DELETE FROM public.user_roles WHERE user_id = c_uid_owner;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_uid_owner, v_role_owner_id);

    -- Master references for registration
    SELECT id INTO v_status_id FROM public.student_statuses WHERE code = 'AKTIF';
    SELECT id INTO v_period_id FROM public.academic_periods WHERE is_active = true LIMIT 1;
    SELECT id INTO v_reg_type_id FROM public.registration_types LIMIT 1;
    SELECT id INTO v_prodi_id FROM public.study_programs LIMIT 1;
    SELECT id INTO v_scheme_id FROM public.service_schemes LIMIT 1;

    -- Student
    INSERT INTO public.students (id, nim, full_name, whatsapp, entry_year, status_id)
    VALUES (v_student_id, '049911223', 'Mahasiswa Audit Test', '081288887777', 2026, v_status_id)
    ON CONFLICT (id) DO NOTHING;

    -- Registration
    INSERT INTO public.registrations (id, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, notes)
    VALUES (v_reg_id, v_student_id, v_period_id, v_reg_type_id, v_prodi_id, v_scheme_id, 'Audit Test Registration')
    ON CONFLICT (id) DO NOTHING;

    -- Invoice
    INSERT INTO public.invoices (id, invoice_number, registration_id, status)
    VALUES (v_inv_id, 'INV-AUDIT-TEST-01', v_reg_id, 'unpaid')
    ON CONFLICT (id) DO NOTHING;

    -- Invoice Items: Total Rp 2.000.000 (Service fee: 400.000, UT Liability: 1.600.000)
    INSERT INTO public.invoice_items (invoice_id, item_type, description, quantity, unit_amount, amount)
    VALUES (v_inv_id, 'service_fee', 'Biaya Layanan SALUT', 1, 400000, 400000)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.invoice_items (invoice_id, item_type, description, quantity, unit_amount, amount)
    VALUES (v_inv_id, 'ut_liability', 'SPP / UKT UT', 1, 1600000, 1600000)
    ON CONFLICT DO NOTHING;

    -- LIP Document (for UT Remittance tests)
    INSERT INTO public.lip_documents (
        id, registration_id, lip_number, version, tuition_amount, official_amount,
        storage_path, original_file_name, mime_type, file_size, status
    ) VALUES (
        v_lip_id, v_reg_id, 'LIP-AUDIT-TEST-01', 1, 1600000, 1600000,
        '/proofs/lip-test.pdf', 'lip-test.pdf', 'application/pdf', 1024, 'verified'
    ) ON CONFLICT (id) DO NOTHING;
END $$;

-- Set default actor as finance admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';

-- =============================================================================
-- TEST 1 & 2: Payment Create & Idempotent Retry Audit Log
-- =============================================================================
SAVEPOINT sp_test_create;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
    v_retry_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    -- Create payment
    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-CREATE', NULL, NULL, NULL, NULL, 'Pembayaran Uji Audit Log',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000001'::UUID
    );

    -- Idempotent retry with same key
    v_retry_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-CREATE', NULL, NULL, NULL, NULL, 'Pembayaran Uji Audit Log',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000001'::UUID
    );
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_created' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000001'::UUID)
       AND actor_user_id = '80000001-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 1: create_payment_with_allocation menghasilkan tepat 1 audit log payment_created dengan actor auth.uid()'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_created' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000001'::UUID)),
    1,
    'Test 2: Retry create_payment_with_allocation idempoten tidak menggandakan audit log'
);
ROLLBACK TO SAVEPOINT sp_test_create;

-- =============================================================================
-- TEST 3 & 4: Payment Verify & Idempotent Recall Audit Log
-- =============================================================================
SAVEPOINT sp_test_verify;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-VERIFY', NULL, NULL, NULL, NULL, 'Pembayaran Siap Verifikasi',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000002'::UUID
    );

    -- Verify first time
    PERFORM public.verify_student_payment(v_pay_id);

    -- Verify second time (idempotent recall)
    PERFORM public.verify_student_payment(v_pay_id);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_verified' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000002'::UUID)
       AND actor_user_id = '80000001-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 3: verify_student_payment menghasilkan tepat 1 audit log payment_verified'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT (new_data->>'status') FROM public.audit_logs 
     WHERE action = 'payment_verified' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000002'::UUID)),
    'verified',
    'Test 4: Idempotent recall verify_student_payment tidak menggandakan audit log dan status verified tercatat benar'
);
ROLLBACK TO SAVEPOINT sp_test_verify;

-- =============================================================================
-- TEST 5: Payment Reject Audit Log
-- =============================================================================
SAVEPOINT sp_test_reject;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-REJECT', NULL, NULL, NULL, NULL, 'Pembayaran Akan Ditolak',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000003'::UUID
    );

    PERFORM public.reject_student_payment(v_pay_id, 'Bukti transfer buram dan tidak terbaca');
    -- Retry reject (idempotent)
    PERFORM public.reject_student_payment(v_pay_id, 'Bukti transfer buram dan tidak terbaca');
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_rejected' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000003'::UUID)),
    1,
    'Test 5: reject_student_payment menghasilkan tepat 1 audit log payment_rejected dan retry tidak menggandakan'
);
ROLLBACK TO SAVEPOINT sp_test_reject;

-- =============================================================================
-- TEST 6 & 7: Payment Void Request and Maker-Checker Void Approval Audit Log
-- =============================================================================
SAVEPOINT sp_test_payment_void;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-VOID-APP', NULL, NULL, NULL, NULL, 'Pembayaran Terverifikasi Akan Divoid',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000004'::UUID
    );

    PERFORM public.verify_student_payment(v_pay_id);

    -- Finance requests void
    v_void_req_id := public.request_payment_void(v_pay_id, 'Salah alokasi rekening mahasiswa');
    -- Idempotent retry request void
    PERFORM public.request_payment_void(v_pay_id, 'Salah alokasi rekening mahasiswa');
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_void_requested' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000004'::UUID)),
    1,
    'Test 6: request_payment_void menghasilkan tepat 1 audit log payment_void_requested'
);

-- Owner approves void (Maker-Checker switch)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pay_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_pay_id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000004'::UUID;
    SELECT id INTO v_void_req_id FROM public.payment_void_requests WHERE payment_id = v_pay_id;

    -- Switch session to Owner
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000002', true);

    PERFORM public.approve_payment_void_request(v_void_req_id, '80000001-0000-0000-0000-000000000002'::UUID, 'approve', 'Disetujui oleh Owner');

    -- Restore session to Finance
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000001', true);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_void_approved' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000004'::UUID)
       AND actor_user_id = '80000001-0000-0000-0000-000000000002'::UUID),
    1,
    'Test 7: approve_payment_void_request (approve) mencatat audit log payment_void_approved dengan actor Owner'
);
ROLLBACK TO SAVEPOINT sp_test_payment_void;

-- =============================================================================
-- TEST 8: Payment Void Rejection Audit Log
-- =============================================================================
SAVEPOINT sp_test_payment_void_rej;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 400000, v_pm_id, v_ca_id,
        'REF-AUDIT-VOID-REJ', NULL, NULL, NULL, NULL, 'Pembayaran Akan Ditolak Void',
        '80000004-0000-0000-0000-000000000001'::UUID, 400000,
        '80000010-0000-0000-0000-000000000005'::UUID
    );

    PERFORM public.verify_student_payment(v_pay_id);
    v_void_req_id := public.request_payment_void(v_pay_id, 'Permohonan void keliru');

    -- Switch to Owner and reject void
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000002', true);
    PERFORM public.approve_payment_void_request(v_void_req_id, '80000001-0000-0000-0000-000000000002'::UUID, 'reject', 'Bukti void tidak memadai');
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000001', true);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'payment_void_rejected' 
       AND entity_id = (SELECT id FROM public.student_payments WHERE idempotency_key = '80000010-0000-0000-0000-000000000005'::UUID)),
    1,
    'Test 8: approve_payment_void_request (reject) mencatat audit log payment_void_rejected'
);
ROLLBACK TO SAVEPOINT sp_test_payment_void_rej;

-- =============================================================================
-- TEST 9 & 10: UT Remittance Create & Idempotent Retry Audit Log
-- =============================================================================
SAVEPOINT sp_test_rem_create;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_ca_id UUID;
    v_pm_id UUID;
    v_pay_id UUID;
    v_rem_id UUID;
    v_retry_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    -- Selesaikan pembayaran invoice agar memenuhi syarat 100% lunas & UT fund cukup
    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 2000000, v_pm_id, v_ca_id,
        'REF-AUDIT-LUNAS-UT', NULL, NULL, NULL, NULL, 'Pembayaran Lunas untuk Remittance',
        '80000004-0000-0000-0000-000000000001'::UUID, 2000000,
        '80000020-0000-0000-0000-000000000001'::UUID
    );
    PERFORM public.verify_student_payment(v_pay_id);

    -- Create remittance
    v_rem_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-01',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Uji Audit',
        '80000030-0000-0000-0000-000000000001'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );

    -- Idempotent retry
    v_retry_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-01',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Uji Audit',
        '80000030-0000-0000-0000-000000000001'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_created' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000001'::UUID)
       AND actor_user_id = '80000001-0000-0000-0000-000000000001'::UUID),
    1,
    'Test 9: create_ut_remittance_with_items mencatat tepat 1 audit log ut_remittance_created'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_created' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000001'::UUID)),
    1,
    'Test 10: Retry create_ut_remittance_with_items idempoten tidak menggandakan audit log'
);
ROLLBACK TO SAVEPOINT sp_test_rem_create;

-- =============================================================================
-- TEST 11 & 12: UT Remittance Verify & Idempotent Recall Audit Log
-- =============================================================================
SAVEPOINT sp_test_rem_verify;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_ca_id UUID;
    v_pm_id UUID;
    v_pay_id UUID;
    v_rem_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 2000000, v_pm_id, v_ca_id,
        'REF-AUDIT-LUNAS-UT2', NULL, NULL, NULL, NULL, 'Pembayaran Lunas untuk Remittance Verify',
        '80000004-0000-0000-0000-000000000001'::UUID, 2000000,
        '80000020-0000-0000-0000-000000000002'::UUID
    );
    PERFORM public.verify_student_payment(v_pay_id);

    v_rem_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-02',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Verify',
        '80000030-0000-0000-0000-000000000002'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );

    -- Verify first time
    PERFORM public.verify_ut_remittance(v_rem_id, '80000001-0000-0000-0000-000000000001'::UUID);
    -- Idempotent recall
    PERFORM public.verify_ut_remittance(v_rem_id, '80000001-0000-0000-0000-000000000001'::UUID);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_verified' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000002'::UUID)),
    1,
    'Test 11: verify_ut_remittance menghasilkan tepat 1 audit log ut_remittance_verified'
);

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT (new_data->>'status') FROM public.audit_logs 
     WHERE action = 'ut_remittance_verified' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000002'::UUID)),
    'verified',
    'Test 12: Status verified tercatat benar pada audit log dan recall tidak menduplikasi'
);
ROLLBACK TO SAVEPOINT sp_test_rem_verify;

-- =============================================================================
-- TEST 13: UT Remittance Reject Audit Log
-- =============================================================================
SAVEPOINT sp_test_rem_reject;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_ca_id UUID;
    v_pm_id UUID;
    v_pay_id UUID;
    v_rem_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 2000000, v_pm_id, v_ca_id,
        'REF-AUDIT-LUNAS-UT3', NULL, NULL, NULL, NULL, 'Pembayaran Lunas untuk Remittance Reject',
        '80000004-0000-0000-0000-000000000001'::UUID, 2000000,
        '80000020-0000-0000-0000-000000000003'::UUID
    );
    PERFORM public.verify_student_payment(v_pay_id);

    v_rem_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-03',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Reject',
        '80000030-0000-0000-0000-000000000003'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );

    PERFORM public.reject_ut_remittance(v_rem_id, 'Nomor referensi setoran bank tidak valid');
    -- Retry reject (idempotent)
    PERFORM public.reject_ut_remittance(v_rem_id, 'Nomor referensi setoran bank tidak valid');
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_rejected' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000003'::UUID)),
    1,
    'Test 13: reject_ut_remittance menghasilkan tepat 1 audit log ut_remittance_rejected'
);
ROLLBACK TO SAVEPOINT sp_test_rem_reject;

-- =============================================================================
-- TEST 14 & 15: UT Remittance Void Request & Void Approval Audit Log
-- =============================================================================
SAVEPOINT sp_test_rem_void;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_ca_id UUID;
    v_pm_id UUID;
    v_pay_id UUID;
    v_rem_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 2000000, v_pm_id, v_ca_id,
        'REF-AUDIT-LUNAS-UT4', NULL, NULL, NULL, NULL, 'Pembayaran Lunas untuk Remittance Void',
        '80000004-0000-0000-0000-000000000001'::UUID, 2000000,
        '80000020-0000-0000-0000-000000000004'::UUID
    );
    PERFORM public.verify_student_payment(v_pay_id);

    v_rem_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-04',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Void',
        '80000030-0000-0000-0000-000000000004'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );
    PERFORM public.verify_ut_remittance(v_rem_id, '80000001-0000-0000-0000-000000000001'::UUID);

    -- Request void
    v_void_req_id := public.request_ut_remittance_void(v_rem_id, 'Salah rekening transfer ke UT pusat');
    PERFORM public.request_ut_remittance_void(v_rem_id, 'Salah rekening transfer ke UT pusat');
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_void_requested' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000004'::UUID)),
    1,
    'Test 14: request_ut_remittance_void menghasilkan tepat 1 audit log ut_remittance_void_requested'
);

-- Owner approves void
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_rem_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_rem_id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000004'::UUID;
    SELECT id INTO v_void_req_id FROM public.ut_remittance_void_requests WHERE remittance_id = v_rem_id;

    -- Switch session to Owner
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000002', true);
    PERFORM public.approve_ut_remittance_void_request(v_void_req_id, '80000001-0000-0000-0000-000000000002'::UUID, 'approve', 'Disetujui oleh Owner');
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000001', true);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_void_approved' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000004'::UUID)
       AND actor_user_id = '80000001-0000-0000-0000-000000000002'::UUID),
    1,
    'Test 15: approve_ut_remittance_void_request (approve) mencatat audit log ut_remittance_void_approved dengan actor Owner'
);
ROLLBACK TO SAVEPOINT sp_test_rem_void;

-- =============================================================================
-- TEST 16: UT Remittance Void Rejection Audit Log
-- =============================================================================
SAVEPOINT sp_test_rem_void_rej;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_ca_id UUID;
    v_pm_id UUID;
    v_pay_id UUID;
    v_rem_id UUID;
    v_void_req_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'BANK_TRANSFER';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'BANK_BCA';

    v_pay_id := public.create_payment_with_allocation(
        '80000002-0000-0000-0000-000000000001'::UUID,
        NOW(), 2000000, v_pm_id, v_ca_id,
        'REF-AUDIT-LUNAS-UT5', NULL, NULL, NULL, NULL, 'Pembayaran Lunas untuk Remittance Void Rej',
        '80000004-0000-0000-0000-000000000001'::UUID, 2000000,
        '80000020-0000-0000-0000-000000000005'::UUID
    );
    PERFORM public.verify_student_payment(v_pay_id);

    v_rem_id := public.create_ut_remittance_with_items(
        NOW(), 1600000, v_ca_id, 'REF-REM-05',
        NULL, NULL, NULL, NULL, 'Catatan Setoran UT Void Rej',
        '80000030-0000-0000-0000-000000000005'::UUID,
        jsonb_build_array(
            jsonb_build_object(
                'lip_document_id', '80000005-0000-0000-0000-000000000001'::UUID,
                'registration_id', '80000003-0000-0000-0000-000000000001'::UUID,
                'amount', 1600000
            )
        )
    );
    PERFORM public.verify_ut_remittance(v_rem_id, '80000001-0000-0000-0000-000000000001'::UUID);

    v_void_req_id := public.request_ut_remittance_void(v_rem_id, 'Pengajuan void keliru');

    -- Switch to Owner and reject
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000002', true);
    PERFORM public.approve_ut_remittance_void_request(v_void_req_id, '80000001-0000-0000-0000-000000000002'::UUID, 'reject', 'Bukti tidak sah');
    PERFORM set_config('request.jwt.claim.sub', '80000001-0000-0000-0000-000000000001', true);
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE action = 'ut_remittance_void_rejected' 
       AND entity_id = (SELECT id FROM public.ut_remittances WHERE idempotency_key = '80000030-0000-0000-0000-000000000005'::UUID)),
    1,
    'Test 16: approve_ut_remittance_void_request (reject) mencatat audit log ut_remittance_void_rejected'
);
ROLLBACK TO SAVEPOINT sp_test_rem_void_rej;

-- =============================================================================
-- TEST 17: Atomic Rollback on Failure
-- =============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    BEGIN
        -- Capacity exceeded: Invoice balance only 2.000.000, attempt 9.000.000
        PERFORM public.create_payment_with_allocation(
            '80000002-0000-0000-0000-000000000001'::UUID,
            NOW(), 9000000, v_pm_id, v_ca_id,
            'REF-FAIL', NULL, NULL, NULL, NULL, 'Gagal Alokasi Melebihi Kapasitas',
            '80000004-0000-0000-0000-000000000001'::UUID, 9000000,
            '80000099-0000-0000-0000-000000000099'::UUID
        );
    EXCEPTION WHEN OTHERS THEN
        -- Expected exception caught
        NULL;
    END;
END $$;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT is(
    (SELECT COUNT(*)::INT FROM public.audit_logs 
     WHERE (new_data->>'idempotency_key') = '80000099-0000-0000-0000-000000000099'
        OR (metadata->>'idempotency_key') = '80000099-0000-0000-0000-000000000099'),
    0,
    'Test 17: Validasi kapasitas (precondition check) menolak sebelum INSERT dan tidak meninggalkan audit log'
);

-- =============================================================================
-- TEST 18: Atomic Rollback on Mid-Transaction Failure (Audit Log Insertion Failure)
-- =============================================================================
-- Menguji pembatalan atomik: mutasi student_payments dan payment_allocations
-- sudah dilakukan di dalam transaksi, namun kegagalan pada saat penulisan audit_logs
-- harus me-rollback seluruh pembayaran dan alokasi tanpa sisa residu.
DO $$
BEGIN
    CREATE OR REPLACE FUNCTION pg_temp.fail_audit_insert_trigger()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF NEW.action = 'payment_created' AND (NEW.metadata->>'reference_number') = 'REF-TRIGGER-FAIL' THEN
            RAISE EXCEPTION 'SIMULATED_AUDIT_LOG_FAILURE: Sengaja menggagalkan INSERT audit log setelah mutasi pembayaran';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_test_fail_audit ON public.audit_logs;
    CREATE TRIGGER trg_test_fail_audit
        BEFORE INSERT ON public.audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION pg_temp.fail_audit_insert_trigger();
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '80000001-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_pm_id UUID;
    v_ca_id UUID;
    v_pay_id UUID;
BEGIN
    SELECT id INTO v_pm_id FROM public.payment_methods WHERE code = 'CASH';
    SELECT id INTO v_ca_id FROM public.cash_accounts WHERE code = 'KAS_TUNAI';

    BEGIN
        -- Capacity valid: nominal Rp 100.000 (melewati seluruh guard dan melakukan INSERT payment & allocation)
        -- Namun trigger di public.audit_logs menggagalkan transaksi saat INSERT audit log
        v_pay_id := public.create_payment_with_allocation(
            '80000002-0000-0000-0000-000000000001'::UUID,
            NOW(), 100000, v_pm_id, v_ca_id,
            'REF-TRIGGER-FAIL', NULL, NULL, NULL, NULL, 'Simulasi Rollback Mutasi Pembayaran',
            '80000004-0000-0000-0000-000000000001'::UUID, 100000,
            '80000099-0000-0000-0000-000000000088'::UUID
        );
    EXCEPTION WHEN OTHERS THEN
        -- Expected exception caught
        NULL;
    END;
END $$;

RESET ROLE;
-- Drop trigger simulasi
DROP TRIGGER IF EXISTS trg_test_fail_audit ON public.audit_logs;

RESET ROLE;
SET search_path = extensions, public, pg_temp;
SELECT ok(
    (SELECT COUNT(*) FROM public.student_payments WHERE idempotency_key = '80000099-0000-0000-0000-000000000088'::UUID) = 0
    AND
    (SELECT COUNT(*) FROM public.payment_allocations WHERE invoice_id = '80000004-0000-0000-0000-000000000001'::UUID AND amount = 100000) = 0
    AND
    (SELECT COUNT(*) FROM public.audit_logs WHERE (metadata->>'reference_number') = 'REF-TRIGGER-FAIL') = 0,
    'Test 18: Kegagalan INSERT audit setelah mutasi dimulai berhasil me-rollback seluruh baris student_payments dan payment_allocations secara atomik'
);

SELECT * FROM finish();
ROLLBACK;
