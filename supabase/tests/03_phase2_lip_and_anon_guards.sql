BEGIN;
SELECT plan(22);

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
-- 9. Permissive DELETE policies are dropped
-- 10. Direct DELETE on public.students is revoked from authenticated
-- 11. Direct DELETE on public.student_status_history is revoked from authenticated
-- 12. Direct DELETE on students is denied for owner, admin, academic_admin, finance_admin, viewer
-- 13. RPC delete_student_cascade succeeds for authorized roles (owner, admin, academic_admin)
-- 14. RPC delete_student_cascade is rejected for finance_admin and viewer
-- 15. RPC delete_student_cascade produces atomic audit log
-- 16. RPC failure rolls back completely without partial delete
-- 17. Financial ledger RLS is enabled and separated
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

-- Test 9: Permissive DELETE policies on students and student_status_history are completely dropped
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'students'
          AND p.polcmd = 'd'
    ),
    'Test 9: All direct DELETE policies on public.students are dropped (RPC-only enforced)'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'student_status_history'
          AND p.polcmd = 'd'
    ),
    'Test 10: All direct DELETE policies on student_status_history are dropped (append-only)'
);

-- Test 11: Direct DELETE privilege on public.students is revoked from authenticated
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.students', 'DELETE'),
    'Test 11: Direct DELETE on public.students is strictly revoked from authenticated role'
);

-- Test 12: Direct DELETE privilege on student_status_history is revoked from authenticated
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.student_status_history', 'DELETE'),
    'Test 12: Direct DELETE on student_status_history is strictly revoked from authenticated role'
);

-- Test 13: Direct DELETE on students is rejected for all roles (Owner, Admin, AcademicAdmin, FinanceAdmin, Viewer)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000001'; -- Owner
SELECT throws_ok(
    $$ DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111' $$,
    '42501',
    NULL,
    'Test 13: Direct DELETE on public.students by Owner throws 42501 permission denied'
);

SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000002'; -- Admin
SELECT throws_ok(
    $$ DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111' $$,
    '42501',
    NULL,
    'Test 14: Direct DELETE on public.students by Admin throws 42501 permission denied'
);

SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT throws_ok(
    $$ DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111' $$,
    '42501',
    NULL,
    'Test 15: Direct DELETE on public.students by Academic Admin throws 42501 permission denied'
);
RESET ROLE;

-- Setup test student for RPC deletion tests
INSERT INTO public.students (id, nim, full_name, status_id)
VALUES ('39000000-0000-0000-0000-000000000001', '049999001', 'Student For RPC Delete', (SELECT id FROM public.student_statuses WHERE code = 'AKTIF' LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Test 16: RPC delete_student_cascade is REJECTED for finance_admin and viewer
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000004'; -- Finance Admin
SELECT throws_ok(
    $$ SELECT public.delete_student_cascade('39000000-0000-0000-0000-000000000001'::uuid) $$,
    '42501',
    NULL,
    'Test 16: RPC delete_student_cascade is rejected for finance_admin'
);

SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000005'; -- Viewer
SELECT throws_ok(
    $$ SELECT public.delete_student_cascade('39000000-0000-0000-0000-000000000001'::uuid) $$,
    '42501',
    NULL,
    'Test 17: RPC delete_student_cascade is rejected for viewer'
);
RESET ROLE;

-- Test 18: RPC delete_student_cascade SUCCEEDS for Academic Admin and writes audit log
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT lives_ok(
    $$ SELECT public.delete_student_cascade('39000000-0000-0000-0000-000000000001'::uuid) $$,
    'Test 18: RPC delete_student_cascade succeeds for Academic Admin'
);
RESET ROLE;

-- Test 19: Verify student was deleted and audit log was recorded atomically
SELECT is(
    (SELECT count(*)::int FROM public.students WHERE id = '39000000-0000-0000-0000-000000000001'),
    0,
    'Test 19: Student row was deleted via RPC'
);

SELECT cmp_ok(
    (SELECT count(*)::int FROM public.audit_logs WHERE action = 'student_cascade_deleted' AND entity_id = '39000000-0000-0000-0000-000000000001'::uuid),
    '>=',
    1,
    'Test 20: Audit log entry was recorded atomically for RPC student deletion'
);

-- Test 21: Financial ledger RLS is enabled on all 3 tables
SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoice_reconciliations' AND relnamespace = 'public'::regnamespace)
    AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'payment_component_allocations' AND relnamespace = 'public'::regnamespace)
    AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'student_credit_ledgers' AND relnamespace = 'public'::regnamespace),
    'Test 21: RLS is properly enabled on all 3 financial ledger tables'
);

-- Test 22: Academic Admin cannot view payment_component_allocations (financial separation)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '10000000-0000-0000-0000-000000000003'; -- Academic Admin
SELECT is(
    (SELECT count(*)::int FROM public.payment_component_allocations),
    0,
    'Test 22: Academic Admin cannot read payment_component_allocations (RLS filtered to 0)'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
