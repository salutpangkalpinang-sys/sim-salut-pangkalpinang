-- Migration: Fix create_ut_remittance_with_items JSONB parameter parsing
-- Prevents "cannot extract elements from a scalar" error if JSON string or camelCase keys are passed

CREATE OR REPLACE FUNCTION public.create_ut_remittance_with_items(
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_remittance_id UUID;
    v_rem_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_items_array JSONB;
    v_item JSONB;
    v_sum_items BIGINT := 0;
    v_existing_id UUID;
    v_lip_status VARCHAR(30);
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_outstanding BIGINT;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record UT remittances';
    END IF;

    -- Idempotency Check: Return existing remittance ID if idempotency_key matches
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.ut_remittances
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Handle scalar JSON string vs JSON array defensive conversion
    IF jsonb_typeof(p_items) = 'string' THEN
        v_items_array := (p_items#>>'{}')::jsonb;
    ELSE
        v_items_array := p_items;
    END IF;

    -- Validate Items array and SUM(items.amount) == p_amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := COALESCE(v_item->>'lip_document_id', v_item->>'lipDocumentId')::UUID;
        v_reg_id := COALESCE(v_item->>'registration_id', v_item->>'registrationId')::UUID;

        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Item allocation amount must be greater than 0';
        END IF;

        -- Validate LIP document status & official amount
        SELECT status, official_amount INTO v_lip_status, v_lip_official
        FROM public.lip_documents
        WHERE id = v_lip_id AND registration_id = v_reg_id;

        IF v_lip_status IS NULL THEN
            RAISE EXCEPTION 'Target LIP document not found or registration mismatch';
        END IF;

        IF v_lip_status = 'cancelled' THEN
            RAISE EXCEPTION 'Cannot allocate remittance to a cancelled LIP document';
        END IF;

        -- Check current outstanding liability for LIP
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_lip_id
          AND r.status = 'verified';

        v_outstanding := v_lip_official - v_already_verified;

        IF v_item_amount > v_outstanding THEN
            RAISE EXCEPTION 'Over-remittance error: Allocation amount (Rp %) exceeds current outstanding UT liability (Rp %) for LIP',
                v_item_amount, v_outstanding;
        END IF;

        v_sum_items := v_sum_items + v_item_amount;
    END LOOP;

    IF v_sum_items <> p_amount THEN
        RAISE EXCEPTION 'Total remittance amount (Rp %) does not match total item allocations (Rp %)',
            p_amount, v_sum_items;
    END IF;

    -- Generate Remittance Number atomically
    v_rem_number := public.generate_remittance_number();

    -- Insert Header record
    INSERT INTO public.ut_remittances (
        remittance_number,
        paid_at,
        amount,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        status,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_rem_number,
        p_paid_at,
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        p_notes,
        'unverified',
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_remittance_id;

    -- Insert Item Detail records
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := COALESCE(v_item->>'lip_document_id', v_item->>'lipDocumentId')::UUID;
        v_reg_id := COALESCE(v_item->>'registration_id', v_item->>'registrationId')::UUID;

        INSERT INTO public.ut_remittance_items (
            remittance_id,
            lip_document_id,
            registration_id,
            amount
        ) VALUES (
            v_remittance_id,
            v_lip_id,
            v_reg_id,
            v_item_amount
        );
    END LOOP;

    RETURN v_remittance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_ut_remittance_with_items(
    TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, JSONB
) TO authenticated, service_role, anon;
