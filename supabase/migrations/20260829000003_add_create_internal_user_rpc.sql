-- Migration: Add RLS policy for profiles & create_internal_user RPC function

-- 1. Enable RLS policy for Owner to manage profiles
DROP POLICY IF EXISTS "Owner can manage profiles" ON public.profiles;
CREATE POLICY "Owner can manage profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner');

-- 2. Stored Procedure for atomic user creation
CREATE OR REPLACE FUNCTION public.create_internal_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    -- Fetch role ID
    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found', p_role_code;
    END IF;

    -- Generate new UUID for internal user profile
    v_user_id := gen_random_uuid();
    
    -- Insert profile
    INSERT INTO public.profiles (id, full_name, is_active, created_at, updated_at)
    VALUES (v_user_id, p_full_name, true, NOW(), NOW());

    -- Assign user role
    INSERT INTO public.user_roles (user_id, role_id, created_at)
    VALUES (v_user_id, v_role_id, NOW());

    RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
