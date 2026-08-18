-- Migration: Fix app_settings RLS write policy
-- Allows users with role 'owner' to manage (insert/update/delete) system settings in app_settings table

DROP POLICY IF EXISTS "Owner can manage app_settings" ON public.app_settings;

CREATE POLICY "Owner can manage app_settings" ON public.app_settings FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner')
WITH CHECK (public.get_current_user_role() = 'owner');
