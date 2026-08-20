-- Migration: Fix cash_accounts RLS write policy
-- Allows authenticated users (guarded by Server Action checks) to insert/update cash_accounts

DROP POLICY IF EXISTS "Authenticated users can manage cash_accounts" ON public.cash_accounts;

CREATE POLICY "Authenticated users can manage cash_accounts" ON public.cash_accounts
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
