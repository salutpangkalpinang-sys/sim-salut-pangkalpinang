-- Stored Procedures for Clean Transaction Reset (SECURITY DEFINER to bypass RLS)

CREATE OR REPLACE FUNCTION public.reset_all_system_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ut_items INTEGER;
    v_ut_voids INTEGER;
    v_ut_rems INTEGER;
    v_pay_alloc INTEGER;
    v_payments INTEGER;
    v_inv_items INTEGER;
    v_invoices INTEGER;
    v_lips INTEGER;
    v_snapshots INTEGER;
    v_regs INTEGER;
    v_cash INTEGER;
BEGIN
    -- 1. Delete UT Remittance items, void requests, & remittances
    DELETE FROM public.ut_remittance_items;
    GET DIAGNOSTICS v_ut_items = ROW_COUNT;

    DELETE FROM public.ut_remittance_void_requests;
    GET DIAGNOSTICS v_ut_voids = ROW_COUNT;

    DELETE FROM public.ut_remittances;
    GET DIAGNOSTICS v_ut_rems = ROW_COUNT;

    -- 2. Delete Student Payments & Payment Allocations
    DELETE FROM public.payment_allocations;
    GET DIAGNOSTICS v_pay_alloc = ROW_COUNT;

    DELETE FROM public.student_payments;
    GET DIAGNOSTICS v_payments = ROW_COUNT;

    -- 3. Delete Invoice Items & Invoices
    DELETE FROM public.invoice_items;
    GET DIAGNOSTICS v_inv_items = ROW_COUNT;

    DELETE FROM public.invoices;
    GET DIAGNOSTICS v_invoices = ROW_COUNT;

    -- 4. Delete LIP Documents
    DELETE FROM public.lip_documents;
    GET DIAGNOSTICS v_lips = ROW_COUNT;

    -- 5. Delete Fee Snapshots & Registrations
    DELETE FROM public.registration_fee_snapshots;
    GET DIAGNOSTICS v_snapshots = ROW_COUNT;

    DELETE FROM public.registrations;
    GET DIAGNOSTICS v_regs = ROW_COUNT;

    -- 6. Delete Operational Cash Transactions
    DELETE FROM public.cash_transactions;
    GET DIAGNOSTICS v_cash = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'registrations', v_regs,
            'lip_documents', v_lips,
            'invoices', v_invoices,
            'student_payments', v_payments,
            'ut_remittances', v_ut_rems,
            'cash_transactions', v_cash
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_student_transactions(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg_ids UUID[];
    v_pay_ids UUID[];
    v_inv_ids UUID[];
BEGIN
    -- Collect registration IDs for target student
    SELECT ARRAY_AGG(id) INTO v_reg_ids FROM public.registrations WHERE student_id = p_student_id;

    IF v_reg_ids IS NOT NULL AND array_length(v_reg_ids, 1) > 0 THEN
        -- 1. UT Remittance items
        DELETE FROM public.ut_remittance_items WHERE registration_id = ANY(v_reg_ids);

        -- 2. Student Payments & Payment Allocations
        SELECT ARRAY_AGG(id) INTO v_pay_ids FROM public.student_payments WHERE registration_id = ANY(v_reg_ids);
        IF v_pay_ids IS NOT NULL AND array_length(v_pay_ids, 1) > 0 THEN
            DELETE FROM public.payment_allocations WHERE payment_id = ANY(v_pay_ids);
            DELETE FROM public.student_payments WHERE id = ANY(v_pay_ids);
        END IF;

        -- 3. Invoice Items & Invoices
        SELECT ARRAY_AGG(id) INTO v_inv_ids FROM public.invoices WHERE registration_id = ANY(v_reg_ids);
        IF v_inv_ids IS NOT NULL AND array_length(v_inv_ids, 1) > 0 THEN
            DELETE FROM public.invoice_items WHERE invoice_id = ANY(v_inv_ids);
            DELETE FROM public.invoices WHERE id = ANY(v_inv_ids);
        END IF;

        -- 4. LIP Documents
        DELETE FROM public.lip_documents WHERE registration_id = ANY(v_reg_ids);

        -- 5. Fee Snapshots & Registrations
        DELETE FROM public.registration_fee_snapshots WHERE registration_id = ANY(v_reg_ids);
        DELETE FROM public.registrations WHERE id = ANY(v_reg_ids);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_system_transactions() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_transactions(UUID) TO authenticated, service_role, anon;
