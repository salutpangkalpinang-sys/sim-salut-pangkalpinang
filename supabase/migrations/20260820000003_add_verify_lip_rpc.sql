-- Migration: Add verify_lip_document SECURITY DEFINER RPC to bypass RLS and atomically supersede old verified LIP documents
-- Date: 2026-08-20

CREATE OR REPLACE FUNCTION public.verify_lip_document(
    p_lip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_registration_id UUID;
    v_lip_number VARCHAR;
BEGIN
    -- 1. Fetch target LIP details
    SELECT registration_id, lip_number
    INTO v_registration_id, v_lip_number
    FROM public.lip_documents
    WHERE id = p_lip_id;

    IF v_registration_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dokumen LIP tidak ditemukan.');
    END IF;

    -- 2. Mark any existing verified LIP for the same registration as 'superseded'
    UPDATE public.lip_documents
    SET status = 'superseded',
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE registration_id = v_registration_id
      AND status = 'verified'
      AND id <> p_lip_id;

    -- 3. Mark target LIP as 'verified'
    UPDATE public.lip_documents
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = p_user_id,
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id = p_lip_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_lip_document(UUID, UUID) TO authenticated, service_role;
