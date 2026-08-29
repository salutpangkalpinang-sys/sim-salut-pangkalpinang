-- Migration: Add RLS DELETE policies for students & student_status_history + Comprehensive Reset RPC

-- 1. Enable RLS DELETE policies for students and student_status_history
DROP POLICY IF EXISTS "Authenticated users can delete students" ON public.students;
CREATE POLICY "Authenticated users can delete students" ON public.students
    FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete status history" ON public.student_status_history;
CREATE POLICY "Authenticated users can delete status history" ON public.student_status_history
    FOR DELETE TO authenticated USING (true);

-- 2. Fixed reset_student_transactions function
CREATE OR REPLACE FUNCTION public.reset_student_transactions(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg_ids UUID[];
    v_pay_ids UUID[];
    v_inv_ids UUID[];
    v_lip_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(id) INTO v_reg_ids FROM public.registrations WHERE student_id = p_student_id;

    IF v_reg_ids IS NOT NULL AND array_length(v_reg_ids, 1) > 0 THEN
        SELECT ARRAY_AGG(id) INTO v_lip_ids FROM public.lip_documents WHERE registration_id = ANY(v_reg_ids);
        IF v_lip_ids IS NOT NULL AND array_length(v_lip_ids, 1) > 0 THEN
            DELETE FROM public.ut_remittance_items WHERE lip_document_id = ANY(v_lip_ids);
        END IF;

        SELECT ARRAY_AGG(id) INTO v_pay_ids FROM public.student_payments WHERE registration_id = ANY(v_reg_ids);
        IF v_pay_ids IS NOT NULL AND array_length(v_pay_ids, 1) > 0 THEN
            DELETE FROM public.payment_allocations WHERE payment_id = ANY(v_pay_ids);
            DELETE FROM public.payment_void_requests WHERE payment_id = ANY(v_pay_ids);
            DELETE FROM public.student_payments WHERE id = ANY(v_pay_ids);
        END IF;

        SELECT ARRAY_AGG(id) INTO v_inv_ids FROM public.invoices WHERE registration_id = ANY(v_reg_ids);
        IF v_inv_ids IS NOT NULL AND array_length(v_inv_ids, 1) > 0 THEN
            DELETE FROM public.invoice_items WHERE invoice_id = ANY(v_inv_ids);
            DELETE FROM public.invoices WHERE id = ANY(v_inv_ids);
        END IF;

        DELETE FROM public.lip_documents WHERE registration_id = ANY(v_reg_ids);
        DELETE FROM public.registration_fee_snapshots WHERE registration_id = ANY(v_reg_ids);
        DELETE FROM public.registrations WHERE id = ANY(v_reg_ids);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Atomic delete_student_cascade function
CREATE OR REPLACE FUNCTION public.delete_student_cascade(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset all transactions first
    PERFORM public.reset_student_transactions(p_student_id);

    -- Delete Student Status History & Student row
    DELETE FROM public.student_status_history WHERE student_id = p_student_id;
    DELETE FROM public.students WHERE id = p_student_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Atomic delete_student_by_name function
CREATE OR REPLACE FUNCTION public.delete_student_by_name(p_name_pattern TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_rec RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_student_rec IN SELECT id, full_name FROM public.students WHERE full_name ILIKE '%' || p_name_pattern || '%' LOOP
        PERFORM public.delete_student_cascade(v_student_rec.id);
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

-- 5. Comprehensive Reset All System Data function (Wipes ALL students & transactions)
CREATE OR REPLACE FUNCTION public.reset_all_system_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ut_items INTEGER := 0;
    v_ut_voids INTEGER := 0;
    v_ut_rems INTEGER := 0;
    v_pay_alloc INTEGER := 0;
    v_pay_voids INTEGER := 0;
    v_payments INTEGER := 0;
    v_inv_items INTEGER := 0;
    v_invoices INTEGER := 0;
    v_lips INTEGER := 0;
    v_snapshots INTEGER := 0;
    v_regs INTEGER := 0;
    v_ops_voids INTEGER := 0;
    v_ops_txns INTEGER := 0;
    v_hist INTEGER := 0;
    v_students INTEGER := 0;
BEGIN
    -- 1. Delete UT Remittance items, void requests, & remittances
    DELETE FROM public.ut_remittance_items WHERE true;
    GET DIAGNOSTICS v_ut_items = ROW_COUNT;

    DELETE FROM public.ut_remittance_void_requests WHERE true;
    GET DIAGNOSTICS v_ut_voids = ROW_COUNT;

    DELETE FROM public.ut_remittances WHERE true;
    GET DIAGNOSTICS v_ut_rems = ROW_COUNT;

    -- 2. Delete Student Payments, Void Requests & Payment Allocations
    DELETE FROM public.payment_allocations WHERE true;
    GET DIAGNOSTICS v_pay_alloc = ROW_COUNT;

    DELETE FROM public.payment_void_requests WHERE true;
    GET DIAGNOSTICS v_pay_voids = ROW_COUNT;

    DELETE FROM public.student_payments WHERE true;
    GET DIAGNOSTICS v_payments = ROW_COUNT;

    -- 3. Delete Invoice Items & Invoices
    DELETE FROM public.invoice_items WHERE true;
    GET DIAGNOSTICS v_inv_items = ROW_COUNT;

    DELETE FROM public.invoices WHERE true;
    GET DIAGNOSTICS v_invoices = ROW_COUNT;

    -- 4. Delete LIP Documents
    DELETE FROM public.lip_documents WHERE true;
    GET DIAGNOSTICS v_lips = ROW_COUNT;

    -- 5. Delete Fee Snapshots & Registrations
    DELETE FROM public.registration_fee_snapshots WHERE true;
    GET DIAGNOSTICS v_snapshots = ROW_COUNT;

    DELETE FROM public.registrations WHERE true;
    GET DIAGNOSTICS v_regs = ROW_COUNT;

    -- 6. Delete Operational Transactions & Void Requests
    DELETE FROM public.operational_transaction_void_requests WHERE true;
    GET DIAGNOSTICS v_ops_voids = ROW_COUNT;

    DELETE FROM public.operational_transactions WHERE true;
    GET DIAGNOSTICS v_ops_txns = ROW_COUNT;

    -- 7. Delete Student Status History & Students
    DELETE FROM public.student_status_history WHERE true;
    GET DIAGNOSTICS v_hist = ROW_COUNT;

    DELETE FROM public.students WHERE true;
    GET DIAGNOSTICS v_students = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'students', v_students,
            'registrations', v_regs,
            'lip_documents', v_lips,
            'invoices', v_invoices,
            'student_payments', v_payments,
            'ut_remittances', v_ut_rems,
            'operational_transactions', v_ops_txns
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_system_data() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.reset_all_system_transactions() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_transactions(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_cascade(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_by_name(TEXT) TO authenticated, service_role, anon;
