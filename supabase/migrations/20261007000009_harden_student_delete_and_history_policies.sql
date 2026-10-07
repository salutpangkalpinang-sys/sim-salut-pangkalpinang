-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.9: Harden Student Deletion, Status History, and Ledger RLS Policies
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HARDEN STUDENTS DELETE POLICY (FAIL-CLOSED)
-- ----------------------------------------------------------------------------
-- Drop permissive DELETE policy that allowed all authenticated users
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;

-- Restrict direct DELETE to Owner, Admin, and Academic Admin only
CREATE POLICY "Owner/Admin/AcademicAdmin can delete students"
    ON public.students
    FOR DELETE
    TO authenticated
    USING (
        (public.get_current_user_role())::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'academic_admin'::character varying]::text[])
        AND public.is_current_user_active()
    );


-- ----------------------------------------------------------------------------
-- 2. HARDEN STUDENT STATUS HISTORY (APPEND-ONLY FOR CLIENTS)
-- ----------------------------------------------------------------------------
-- Drop permissive DELETE policy that allowed all authenticated users
DROP POLICY IF EXISTS "Authenticated users can delete status history" ON public.student_status_history;

-- Explicitly REVOKE direct DELETE from authenticated users to enforce append-only
-- Deletion is strictly performed via verified delete_student_cascade RPC
REVOKE DELETE ON TABLE public.student_status_history FROM authenticated;


-- ----------------------------------------------------------------------------
-- 3. AUDIT & RE-HARDEN delete_student_cascade RPC
-- ----------------------------------------------------------------------------
-- Ensures:
-- 1. Valid auth.uid()
-- 2. Active profile verification
-- 3. Role whitelist ('owner', 'admin', 'academic_admin')
-- 4. Audit logging of student deletion event
-- 5. Atomic transaction
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

    -- 3. Record Audit Log Entry
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


-- ----------------------------------------------------------------------------
-- 4. HARDEN FINANCIAL LEDGERS WITH RLS (LEAST-PRIVILEGE READ ACCESS)
-- ----------------------------------------------------------------------------

-- A. Table: public.invoice_reconciliations
ALTER TABLE public.invoice_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized roles can view invoice reconciliations" ON public.invoice_reconciliations;
CREATE POLICY "Authorized roles can view invoice reconciliations"
    ON public.invoice_reconciliations
    FOR SELECT
    TO authenticated
    USING (
        (public.get_current_user_role())::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'academic_admin'::character varying, 'finance_admin'::character varying, 'viewer'::character varying]::text[])
        AND public.is_current_user_active()
    );

-- B. Table: public.payment_component_allocations
ALTER TABLE public.payment_component_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized roles can view payment component allocations" ON public.payment_component_allocations;
CREATE POLICY "Authorized roles can view payment component allocations"
    ON public.payment_component_allocations
    FOR SELECT
    TO authenticated
    USING (
        (public.get_current_user_role())::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'finance_admin'::character varying, 'viewer'::character varying]::text[])
        AND public.is_current_user_active()
    );

-- C. Table: public.student_credit_ledgers
ALTER TABLE public.student_credit_ledgers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized roles can view student credit ledgers" ON public.student_credit_ledgers;
CREATE POLICY "Authorized roles can view student credit ledgers"
    ON public.student_credit_ledgers
    FOR SELECT
    TO authenticated
    USING (
        (public.get_current_user_role())::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'finance_admin'::character varying, 'viewer'::character varying]::text[])
        AND public.is_current_user_active()
    );

COMMIT;
