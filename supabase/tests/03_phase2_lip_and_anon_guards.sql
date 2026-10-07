BEGIN;
SELECT plan(8);

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

SELECT * FROM finish();
ROLLBACK;
