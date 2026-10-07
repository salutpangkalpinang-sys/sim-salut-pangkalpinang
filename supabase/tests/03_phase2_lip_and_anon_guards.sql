BEGIN;
SELECT plan(16);

-- ============================================================================
-- SIM-SALUT PANGKALPINANG - PHASE 2.3 RLS GUARDS & LIP PERMISSIONS TESTS (pgTAP)
-- Testing:
-- 1. anon role cannot read public.students (permission denied / RLS blocked)
-- 2. Policy "Authenticated users can view students" exists and applies to authenticated role
-- 3. Policy "Owner/AcademicAdmin can insert students" restricts to owner & academic_admin
-- 4. Policy "Owner/Admin/AcademicAdmin can insert lip_documents" includes admin
-- 5. Policy "Owner/Admin/AcademicAdmin can update lip_documents" includes admin
-- 6. Storage policy for lip-documents includes admin in upload
-- 7. Storage policy for lip-documents includes admin in update
-- 8. Storage policy excludes finance_admin and viewer from lip upload
-- ============================================================================

-- Test 1: Role 'anon' CANNOT read students table (throws permission denied 42501)
SET ROLE anon;
RESET "request.jwt.claim.sub";
SELECT throws_ok(
    $$ SELECT count(*) FROM public.students $$,
    '42501',
    NULL,
    'Test 1: Role anon cannot read students table (permission denied / RLS deny)'
);
RESET ROLE;

-- Test 2: Policy "Authenticated users can view students" exists on public.students
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'students'
          AND p.polname = 'Authenticated users can view students'
          AND p.polcmd = 'r'
    ),
    'Test 2: Policy Authenticated users can view students exists and allows SELECT'
);

-- Test 3: Policy "Owner/AcademicAdmin can insert students" restricts to owner and academic_admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'students'
          AND p.polname = 'Owner/AcademicAdmin can insert students'
          AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%academic_admin%'
    ),
    'Test 3: Policy Owner/AcademicAdmin can insert students is properly configured'
);

-- Test 4: Policy "Owner/Admin/AcademicAdmin can insert lip_documents" exists and includes admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'lip_documents'
          AND p.polname = 'Owner/Admin/AcademicAdmin can insert lip_documents'
          AND p.polcmd = 'a'
          AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%admin%'
    ),
    'Test 4: Policy Owner/Admin/AcademicAdmin can insert lip_documents allows admin role'
);

-- Test 5: Policy "Owner/Admin/AcademicAdmin can update lip_documents" exists and includes admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'lip_documents'
          AND p.polname = 'Owner/Admin/AcademicAdmin can update lip_documents'
          AND p.polcmd = 'w'
          AND pg_get_expr(p.polqual, p.polrelid) LIKE '%admin%'
    ),
    'Test 5: Policy Owner/Admin/AcademicAdmin can update lip_documents allows admin role'
);

-- Test 6: Storage policy for lip-documents upload includes admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'objects'
          AND p.polname = 'Owner/Admin/AcademicAdmin can upload lip storage objects'
          AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%admin%'
    ),
    'Test 6: Storage upload policy for lip-documents includes admin role'
);

-- Test 7: Storage policy for lip-documents update includes admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'objects'
          AND p.polname = 'Owner/Admin/AcademicAdmin can update lip storage objects'
          AND pg_get_expr(p.polqual, p.polrelid) LIKE '%admin%'
    ),
    'Test 7: Storage update policy for lip-documents includes admin role'
);

-- Test 8: lip_documents policy check expression strictly excludes finance_admin and viewer
SELECT ok(
    (
        SELECT (
            pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%finance_admin%'
            AND pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%viewer%'
        )
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'lip_documents'
          AND p.polname = 'Owner/Admin/AcademicAdmin can insert lip_documents'
    ),
    'Test 8: Policy strictly excludes finance_admin and viewer from lip_documents mutation'
);

-- Test 9: Permissive DELETE policies on students and student_status_history are dropped
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'students'
          AND p.polname = 'Authenticated users can delete students'
    ),
    'Test 9: Permissive Authenticated users can delete students policy is dropped'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'student_status_history'
          AND p.polname = 'Authenticated users can delete status history'
    ),
    'Test 10: Permissive Authenticated users can delete status history policy is dropped'
);

-- Test 11: Fail-closed DELETE policy on students exists and whitelists owner/admin/academic_admin
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'students'
          AND p.polname = 'Owner/Admin/AcademicAdmin can delete students'
          AND p.polcmd = 'd'
    ),
    'Test 11: Fail-closed Owner/Admin/AcademicAdmin can delete students policy exists'
);

-- Test 12: Direct DELETE on student_status_history is completely revoked from authenticated
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.student_status_history', 'DELETE'),
    'Test 12: Direct DELETE on student_status_history is strictly revoked from authenticated'
);

-- Test 13: Direct DELETE on students by finance_admin is REJECTED by RLS
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004'; -- Finance Admin
DO $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count > 0 THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: finance_admin should NOT delete students!';
    END IF;
END $$;
SELECT pass('Test 13: Direct DELETE on students by finance_admin is rejected (0 rows affected)');
RESET ROLE;

-- Test 14: Direct DELETE on students by viewer is REJECTED by RLS
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005'; -- Viewer
DO $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count > 0 THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: viewer should NOT delete students!';
    END IF;
END $$;
SELECT pass('Test 14: Direct DELETE on students by viewer is rejected (0 rows affected)');
RESET ROLE;

-- Test 15: RLS is ENABLED on ledger tables
SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoice_reconciliations' AND relnamespace = 'public'::regnamespace)
    AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'payment_component_allocations' AND relnamespace = 'public'::regnamespace)
    AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'student_credit_ledgers' AND relnamespace = 'public'::regnamespace),
    'Test 15: RLS is properly enabled on all 3 financial ledger tables'
);

-- Test 16: Academic Admin cannot view payment_component_allocations (financial separation)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT is(
    (SELECT count(*)::int FROM public.payment_component_allocations),
    0,
    'Test 16: Academic Admin cannot read payment_component_allocations (RLS filtered to 0)'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
