-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.11: Fix reset_student_transactions Schema Drift & Cascade Integrity
--
-- Context:
-- In migration 20261004000001, public.reset_student_transactions queried
-- public.student_payments WHERE registration_id = ANY(v_reg_ids), but
-- public.student_payments has NO registration_id column. It relates to
-- public.students directly via student_id.
--
-- This migration fixes the schema drift and ensures complete, strictly-scoped
-- cascading cleanup for target student transactions while:
--   1. Restricting all deletions strictly to target p_student_id.
--   2. Cleaning up payment allocations and void requests associated with
--      the student's payments or target registrations.
--   3. Cleaning up invoice reconciliations, student credit ledgers, and
--      payment component allocations (Phase 2 ledger tables).
--   4. Cleaning up invoices, invoice items, and lip documents for target student.
--   5. Preserving operational transactions, profiles, user_roles, auth users,
--      master data, and other students' data completely untouched.
--   6. Retaining internal-only execution: REVOKE from PUBLIC, anon, authenticated;
--      GRANT ONLY to service_role and internal callers (delete_student_cascade).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_student_transactions(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reg_ids UUID[];
    v_pay_ids UUID[];
    v_inv_ids UUID[];
    v_lip_ids UUID[];
BEGIN
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'p_student_id cannot be null' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- 1. Collect all registration IDs for this student
    SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_reg_ids 
    FROM public.registrations 
    WHERE student_id = p_student_id;

    -- 2. Collect all payment IDs for this student
    SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_pay_ids 
    FROM public.student_payments 
    WHERE student_id = p_student_id;

    -- 3. Collect all invoice IDs associated with the student's registrations
    IF array_length(v_reg_ids, 1) > 0 THEN
        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_inv_ids 
        FROM public.invoices 
        WHERE registration_id = ANY(v_reg_ids);

        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_lip_ids 
        FROM public.lip_documents 
        WHERE registration_id = ANY(v_reg_ids);
    ELSE
        v_inv_ids := ARRAY[]::UUID[];
        v_lip_ids := ARRAY[]::UUID[];
    END IF;

    -- ========================================================================
    -- A. CLEAN UP PHASE 2 RECONCILIATIONS & LEDGERS
    -- ========================================================================
    -- Student Credit Ledgers (relates to student_id or registration_id)
    DELETE FROM public.student_credit_ledgers 
    WHERE student_id = p_student_id 
       OR (array_length(v_reg_ids, 1) > 0 AND registration_id = ANY(v_reg_ids));

    -- Invoice Reconciliations (relates to invoices, registrations, or LIPs)
    IF (array_length(v_inv_ids, 1) > 0) OR (array_length(v_reg_ids, 1) > 0) OR (array_length(v_lip_ids, 1) > 0) THEN
        DELETE FROM public.invoice_reconciliations
        WHERE (array_length(v_inv_ids, 1) > 0 AND invoice_id = ANY(v_inv_ids))
           OR (array_length(v_reg_ids, 1) > 0 AND registration_id = ANY(v_reg_ids))
           OR (array_length(v_lip_ids, 1) > 0 AND lip_document_id = ANY(v_lip_ids));
    END IF;

    -- Payment Component Allocations (relates to payments or invoices)
    IF (array_length(v_pay_ids, 1) > 0) OR (array_length(v_inv_ids, 1) > 0) THEN
        DELETE FROM public.payment_component_allocations
        WHERE (array_length(v_pay_ids, 1) > 0 AND payment_id = ANY(v_pay_ids))
           OR (array_length(v_inv_ids, 1) > 0 AND invoice_id = ANY(v_inv_ids));
    END IF;

    -- ========================================================================
    -- B. CLEAN UP UT REMITTANCE ITEMS (Child of LIP documents / registrations)
    -- ========================================================================
    IF (array_length(v_lip_ids, 1) > 0) OR (array_length(v_reg_ids, 1) > 0) THEN
        DELETE FROM public.ut_remittance_items 
        WHERE (array_length(v_lip_ids, 1) > 0 AND lip_document_id = ANY(v_lip_ids))
           OR (array_length(v_reg_ids, 1) > 0 AND registration_id = ANY(v_reg_ids));
    END IF;

    -- ========================================================================
    -- C. CLEAN UP PAYMENT ALLOCATIONS, VOID REQUESTS & STUDENT PAYMENTS
    -- ========================================================================
    -- Clean allocations where payment belongs to student OR invoice belongs to student's reg
    IF (array_length(v_pay_ids, 1) > 0) OR (array_length(v_inv_ids, 1) > 0) THEN
        DELETE FROM public.payment_allocations 
        WHERE (array_length(v_pay_ids, 1) > 0 AND payment_id = ANY(v_pay_ids))
           OR (array_length(v_inv_ids, 1) > 0 AND invoice_id = ANY(v_inv_ids));
    END IF;

    -- Clean payment void requests for student's payments
    IF array_length(v_pay_ids, 1) > 0 THEN
        DELETE FROM public.payment_void_requests 
        WHERE payment_id = ANY(v_pay_ids);

        -- Delete student payments
        DELETE FROM public.student_payments 
        WHERE id = ANY(v_pay_ids);
    END IF;

    -- ========================================================================
    -- D. CLEAN UP INVOICES, INVOICE ITEMS, LIP DOCUMENTS & REGISTRATIONS
    -- ========================================================================
    IF array_length(v_inv_ids, 1) > 0 THEN
        DELETE FROM public.invoice_items 
        WHERE invoice_id = ANY(v_inv_ids);

        DELETE FROM public.invoices 
        WHERE id = ANY(v_inv_ids);
    END IF;

    IF array_length(v_lip_ids, 1) > 0 THEN
        DELETE FROM public.lip_documents 
        WHERE id = ANY(v_lip_ids);
    END IF;

    IF array_length(v_reg_ids, 1) > 0 THEN
        -- Extra safety: clean any remaining LIPs directly by registration
        DELETE FROM public.lip_documents 
        WHERE registration_id = ANY(v_reg_ids);

        DELETE FROM public.registration_fee_snapshots 
        WHERE registration_id = ANY(v_reg_ids);

        DELETE FROM public.registrations 
        WHERE id = ANY(v_reg_ids);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Security & RBAC: Strictly internal, cannot be called directly by authenticated or anon
REVOKE ALL ON FUNCTION public.reset_student_transactions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_student_transactions(UUID) TO service_role;

-- Re-verify delete_student_cascade permissions and definition
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
