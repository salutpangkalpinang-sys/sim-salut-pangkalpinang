-- Migration: Fix verify_ut_remittance execution order and status checks
-- Ensures ut_remittances status is set to 'verified' BEFORE updating lip_documents status to 'paid_to_ut'
-- so trigger check_lip_status_consistency passes cleanly.

CREATE OR REPLACE FUNCTION public.verify_ut_remittance(
    p_remittance_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_new_verified_total BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_ut_remittance';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify UT remittances';
    END IF;

    -- Lock remittance header
    SELECT status INTO v_status
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'UT Remittance not found';
    END IF;

    IF v_status <> 'pending_verification' AND v_status <> 'unverified' THEN
        RAISE EXCEPTION 'Only pending or unverified remittances can be verified';
    END IF;

    -- 1. Update Remittance Header to 'verified' FIRST
    UPDATE public.ut_remittances
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    -- 2. Lock LIP records & update LIP status to paid_to_ut if fully paid to UT
    FOR v_item IN 
        SELECT ri.lip_document_id, ri.amount 
        FROM public.ut_remittance_items ri 
        WHERE ri.remittance_id = p_remittance_id
    LOOP
        -- Lock target LIP row
        SELECT official_amount INTO v_lip_official
        FROM public.lip_documents
        WHERE id = v_item.lip_document_id
        FOR UPDATE;

        -- Calculate verified UT paid within transaction (now includes this verified remittance)
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_item.lip_document_id
          AND r.status = 'verified';

        v_new_verified_total := v_already_verified;

        IF v_new_verified_total > v_lip_official THEN
            RAISE EXCEPTION 'Over-remittance protection: Total setoran (Rp %) exceeds LIP official amount (Rp %)',
                v_new_verified_total, v_lip_official;
        END IF;

        -- Update LIP status to paid_to_ut if fully paid to UT
        IF v_new_verified_total >= v_lip_official THEN
            UPDATE public.lip_documents
            SET status = 'paid_to_ut',
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_item.lip_document_id;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.verify_ut_remittance(UUID, UUID) TO authenticated, service_role, anon;
