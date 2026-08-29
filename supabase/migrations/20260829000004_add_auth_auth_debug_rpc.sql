-- Helper RPC to debug auth tables safely

CREATE OR REPLACE FUNCTION public.get_user_auth_debug(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_u RECORD;
    v_i RECORD;
BEGIN
    SELECT * INTO v_u FROM auth.users WHERE email = p_email;
    SELECT * INTO v_i FROM auth.identities WHERE email = p_email OR identity_data->>'email' = p_email LIMIT 1;
    
    RETURN jsonb_build_object(
        'user', row_to_json(v_u),
        'identity', row_to_json(v_i)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_auth_debug(TEXT) TO authenticated, anon, service_role;
