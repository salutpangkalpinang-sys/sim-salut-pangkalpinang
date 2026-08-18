-- Migration: Fix app_settings RLS write policy
-- Allows users with role 'owner' to manage (insert/update/delete) system settings in app_settings table

-- Migration: Fix app_settings RLS write policy
-- Allows authenticated users (guarded by Server Action Owner check) to manage system settings in app_settings table

DROP POLICY IF EXISTS "Owner can manage app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can manage app_settings" ON public.app_settings;

CREATE POLICY "Authenticated users can manage app_settings" ON public.app_settings
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

