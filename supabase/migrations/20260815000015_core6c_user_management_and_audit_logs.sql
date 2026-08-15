-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 6C.1: User Management & Audit Logs Table & RPC Creation Function
-- ============================================================================

-- 1. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'user_invited', 'user_role_changed', 'user_deactivated', 'user_reactivated'
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'profile', 'role'
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR AUDIT LOGS
-- Only Owner can view audit logs
DROP POLICY IF EXISTS "Owner can view audit logs" ON public.audit_logs;
CREATE POLICY "Owner can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'owner'
        )
    );

-- Authenticated users can insert audit logs for authorized actions
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = actor_user_id);

-- 4. SECURE ATOMIC USER CREATION FUNCTION
CREATE OR REPLACE FUNCTION public.create_internal_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_role_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Check caller is owner
    SELECT r.code INTO v_caller_role
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid();

    IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
        RAISE EXCEPTION 'Hanya role Owner yang diizinkan membuat pengguna.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % tidak ditemukan.', p_role_code;
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', p_email, v_encrypted_pw, NOW(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_full_name),
            NOW(), NOW(), 'authenticated', 'authenticated'
        );

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
        ) VALUES (
            v_user_id, v_user_id, format('{"sub":"%s","email":"%s"}', v_user_id, p_email)::jsonb,
            'email', NOW(), NOW(), NOW(), p_email
        ) ON CONFLICT DO NOTHING;
    ELSE
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, p_full_name, TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = TRUE;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RETURN v_user_id;
END;
$$;
