-- Migration: Add update_cash_account SECURITY DEFINER RPC and ensure RLS write policy for cash_accounts
-- Date: 2026-08-30

DROP POLICY IF EXISTS "Authenticated users can view cash_accounts" ON public.cash_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage cash_accounts" ON public.cash_accounts;

CREATE POLICY "Authenticated users can manage cash_accounts" ON public.cash_accounts
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_cash_account(
    p_id UUID,
    p_name VARCHAR,
    p_account_number VARCHAR DEFAULT NULL,
    p_bank_name VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cash_accounts
    SET name = TRIM(p_name),
        account_number = NULLIF(TRIM(p_account_number), ''),
        bank_name = NULLIF(TRIM(p_bank_name), ''),
        updated_at = NOW()
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rekening tidak ditemukan.');
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cash_account(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;
