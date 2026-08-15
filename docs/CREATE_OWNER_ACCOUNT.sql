-- ============================================================================
-- SIM-SALUT Pangkalpinang Owner Account Generator
-- Username: admin (admin@salut-pangkalpinang.ac.id)
-- Password: suksesterus
-- Role: Owner / Pimpinan
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    encrypted_pw TEXT;
    owner_role_id UUID;
BEGIN
    -- 1. Generate bcrypt hash for password 'suksesterus'
    encrypted_pw := crypt('suksesterus', gen_salt('bf'));

    -- 2. Find Owner Role ID
    SELECT id INTO owner_role_id FROM public.roles WHERE code = 'owner' LIMIT 1;

    -- 3. Check if admin user already exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@salut-pangkalpinang.ac.id') THEN
        -- Insert User into auth.users
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
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            'admin@salut-pangkalpinang.ac.id',
            encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Owner SIM-SALUT"}',
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );

        -- Insert User Identity
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            new_user_id,
            format('{"sub":"%s","email":"%s"}', new_user_id, 'admin@salut-pangkalpinang.ac.id')::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        );

        -- Insert Profile
        INSERT INTO public.profiles (id, full_name, is_active)
        VALUES (new_user_id, 'Owner SIM-SALUT Pangkalpinang', TRUE)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = TRUE;

        -- Assign Owner Role
        IF owner_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (new_user_id, owner_role_id)
            ON CONFLICT DO NOTHING;
        END IF;

    ELSE
        -- Update Password and Confirm Status if user exists
        UPDATE auth.users 
        SET encrypted_password = encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE email = 'admin@salut-pangkalpinang.ac.id';

        SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@salut-pangkalpinang.ac.id';

        IF owner_role_id IS NOT NULL AND new_user_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (new_user_id, owner_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
END $$;
