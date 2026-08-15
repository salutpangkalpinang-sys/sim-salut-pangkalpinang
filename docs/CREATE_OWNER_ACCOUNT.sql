-- ============================================================================
-- SIM-SALUT Pangkalpinang Fail-Safe Owner Account Creator
-- Username: admin
-- Real Auth Email: admin@salut-pangkalpinang.ac.id
-- Password: suksesterus
-- Role: Owner / Pimpinan (Full Access)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_role_id UUID;
    v_email TEXT := 'admin@salut-pangkalpinang.ac.id';
    v_password TEXT := 'suksesterus';
BEGIN
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    -- 1. Check if user already exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        -- Insert User
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
            v_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Owner SIM-SALUT"}',
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );

        -- Insert Identity
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at,
            email
        ) VALUES (
            v_user_id,
            v_user_id,
            format('{"sub":"%s","email":"%s"}', v_user_id, v_email)::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW(),
            v_email
        ) ON CONFLICT DO NOTHING;

    ELSE
        -- Update password and confirmation
        UPDATE auth.users 
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Ensure Profile exists
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, 'Owner SIM-SALUT Pangkalpinang', TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = TRUE;

    -- Ensure Owner Role is assigned
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'owner' LIMIT 1;

    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (v_user_id, v_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;
