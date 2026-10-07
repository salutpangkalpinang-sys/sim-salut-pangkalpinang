-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.10: Enforce RPC-Only Student Deletion and Revoke Direct Table DELETE
--
-- Security Context:
-- Direct DELETE on public.students bypasses public.delete_student_cascade,
-- bypassing atomic transaction, child transaction cleanups, and audit logging.
-- This migration closes direct DELETE on public.students for all authenticated
-- users, making public.delete_student_cascade the sole authorized mutation path.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DROP DIRECT DELETE POLICY ON public.students
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner/Admin/AcademicAdmin can delete students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

-- ----------------------------------------------------------------------------
-- 2. REVOKE DIRECT TABLE DELETE PRIVILEGE ON public.students
-- ----------------------------------------------------------------------------
REVOKE DELETE ON TABLE public.students FROM authenticated, anon;

-- Ensure student_status_history remains strictly append-only (no direct DELETE)
REVOKE DELETE ON TABLE public.student_status_history FROM authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. AUDIT & RE-HARDEN delete_student_cascade RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_student_cascade(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_user_role TEXT;
    v_is_active BOOLEAN;
    v_student_nim VARCHAR;
    v_student_name VARCHAR;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to delete_student_cascade'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller profile is active
    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'User profile is inactive or not found'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Verify caller has authorized role
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner, Admin, and Academic Admin can cascade delete student'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Fetch student info for audit logging
    SELECT nim, full_name INTO v_student_nim, v_student_name
    FROM public.students
    WHERE id = p_student_id;

    IF v_student_nim IS NULL AND v_student_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Data mahasiswa tidak ditemukan.');
    END IF;

    -- 1. Reset all student transactions first (child records)
    PERFORM public.reset_student_transactions(p_student_id);

    -- 2. Delete Student Status History & Student row
    DELETE FROM public.student_status_history WHERE student_id = p_student_id;
    DELETE FROM public.students WHERE id = p_student_id;

    -- 3. Record Audit Log Entry atomically in the same transaction
    INSERT INTO public.audit_logs (
        actor_user_id, action, entity_type, entity_id, metadata
    ) VALUES (
        v_actor_id,
        'student_cascade_deleted',
        'student',
        p_student_id,
        jsonb_build_object(
            'student_id', p_student_id,
            'nim', v_student_nim,
            'full_name', v_student_name,
            'deleted_by_role', v_user_role
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_student_cascade(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_cascade(UUID) TO authenticated, service_role;

COMMIT;
