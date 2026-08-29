-- Migration: Full Fail-Safe create_internal_user RPC function matching CREATE_OWNER_ACCOUNT GoTrue schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Enable RLS policy for Owner to manage profiles & user_roles
DROP POLICY IF EXISTS "Owner can manage profiles" ON public.profiles;
CREATE POLICY "Owner can manage profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner');

DROP POLICY IF EXISTS "Owner can manage user roles" ON public.user_roles;
CREATE POLICY "Owner can manage user roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner');

-- 2. Stored Procedure for atomic internal user creation in Supabase Auth & Profiles
CREATE OR REPLACE FUNCTION public.create_internal_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- 1. Fetch role ID
    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found', p_role_code;
    END IF;

    v_encrypted_pw := crypt(COALESCE(p_password, 'suksesterus'), gen_salt('bf'));

    -- 2. Check if user already exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        -- Insert into auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            p_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', p_full_name),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );

        -- Insert into auth.identities (Identical to CREATE_OWNER_ACCOUNT.sql)
        DELETE FROM auth.identities WHERE user_id = v_user_id;
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            format('{"sub":"%s","email":"%s"}', v_user_id, p_email)::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        ) ON CONFLICT DO NOTHING;
    ELSE
        -- Update password and GoTrue auth metadata for existing user
        UPDATE auth.users 
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = NOW(),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}',
            raw_user_meta_data = jsonb_build_object('full_name', p_full_name),
            updated_at = NOW(),
            role = 'authenticated',
            aud = 'authenticated'
        WHERE id = v_user_id;

        DELETE FROM auth.identities WHERE user_id = v_user_id;
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            format('{"sub":"%s","email":"%s"}', v_user_id, p_email)::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- 3. Upsert Profile
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, p_full_name, true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = true;

    -- 4. Assign User Role
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT DO NOTHING;

    RETURN v_user_id;
END;
$$;

ALTER FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
