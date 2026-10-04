BEGIN;

-- ============================================================================
-- Migration: 20261002000002_security_hardening_auth_and_void_maker_checker.sql
-- Description:
--   1. Neutralize & Drop get_user_auth_debug RPC (prevent auth schema leak).
--   2. Add email column to public.profiles, auto-sync from auth.users, and backfill.
--   3. Hardened create_internal_user RPC (enforce min 12 chars password, no default fallback).
--   4. Enforce Maker-Checker on all Void approvals (Payment, UT Remittance, Operational Cash).
--   5. Authorize Admin alongside Owner for void review and private storage management.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURE & DROP ALL SIGNATURES OF RPC DEBUG FUNCTIONS (RESTRICT ENFORCED)
-- ----------------------------------------------------------------------------
-- Safely drops get_user_auth_debug and get_auth_info (found on production)
-- without CASCADE to prevent unintended drops of dependent objects.
DO $$
DECLARE
    r RECORD;
    v_proc_name TEXT;
BEGIN
    -- 1. Loop through all debug procedure names identified historically & in production
    FOREACH v_proc_name IN ARRAY ARRAY['get_user_auth_debug', 'get_auth_info'] LOOP
        FOR r IN (
            SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = v_proc_name
        ) LOOP
            EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role', r.proname, r.args);
            EXECUTE format('DROP FUNCTION public.%I(%s) RESTRICT', r.proname, r.args);
        END LOOP;

        -- 2. Assertion: Verify that NO function with this name remains in public schema
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = v_proc_name
        ) THEN
            RAISE EXCEPTION 'Assertion failed: Fungsi % masih ditemukan pada skema public setelah drop', v_proc_name;
        END IF;
    END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 2. HELPER: ACTIVE USER STATUS VALIDATOR
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(
        (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. DEDICATED PROTECTED EMAIL DIRECTORY (STRICT RLS ENFORCED)
-- ----------------------------------------------------------------------------
-- Creating dedicated table instead of exposing email on public.profiles
-- ensures that public.profiles (accessible by authenticated users for UI display)
-- does not leak employee login emails to non-admin roles (Viewer, Academic, Finance).
CREATE TABLE IF NOT EXISTS public.user_emails (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable and Force Row Level Security
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails FORCE ROW LEVEL SECURITY;

-- Deny all privileges from PUBLIC and anon
REVOKE ALL ON TABLE public.user_emails FROM PUBLIC, anon;

-- Strictly grant ONLY SELECT to authenticated role (prevent client INSERT, UPDATE, DELETE, TRUNCATE)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_emails FROM authenticated;
GRANT SELECT ON TABLE public.user_emails TO authenticated;
GRANT ALL ON TABLE public.user_emails TO service_role;

-- RLS Policy 1: Only active Owner & Admin can view all user emails
DROP POLICY IF EXISTS "Owner and Admin can view all user emails" ON public.user_emails;
CREATE POLICY "Owner and Admin can view all user emails" ON public.user_emails
FOR SELECT TO authenticated
USING (
    public.get_current_user_role() IN ('owner', 'admin')
    AND public.is_current_user_active()
);

-- RLS Policy 2: Individual active user (Academic, Finance, Viewer) can view their OWN email only
DROP POLICY IF EXISTS "Active users can view own email" ON public.user_emails;
DROP POLICY IF EXISTS "Staff can view own email only" ON public.user_emails;
CREATE POLICY "Staff can view own email only" ON public.user_emails
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    AND public.is_current_user_active()
);

-- Trigger function: Strict search_path preventing object search-path hijacking
-- Strict Integrity: NEVER create stub/emergency profiles and NEVER leak email to profiles.full_name!
CREATE OR REPLACE FUNCTION public.handle_sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
        -- Integrity Check: Profile MUST already exist before syncing email.
        -- Emergency stub profiles are forbidden to prevent email leakage to profiles.full_name.
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
            RAISE EXCEPTION 'Profile untuk user ID % belum tersedia. Sinkronisasi email dibatalkan.', NEW.id;
        END IF;

        INSERT INTO public.user_emails (user_id, email, updated_at)
        VALUES (NEW.id, NEW.email, pg_catalog.now())
        ON CONFLICT (user_id) DO UPDATE
        SET email = EXCLUDED.email,
            updated_at = pg_catalog.now();
    ELSE
        -- If email becomes NULL or empty string, remove it safely to avoid invalid email entries
        DELETE FROM public.user_emails WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger function is internal to database triggers; revoke all access from client roles
REVOKE ALL ON FUNCTION public.handle_sync_user_email() FROM PUBLIC, anon, authenticated;

-- Clean up any legacy or duplicate trigger names
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
DROP TRIGGER IF EXISTS zz_on_auth_user_email_sync ON auth.users;

-- PostgreSQL executes AFTER INSERT triggers in alphabetical order.
-- Since the official profile creation trigger is 'on_auth_user_created',
-- the prefix 'zz_' guarantees that 'on_auth_user_created' executes first,
-- establishing the profile record BEFORE 'zz_on_auth_user_email_sync' executes.
CREATE TRIGGER zz_on_auth_user_email_sync
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sync_user_email();

-- Safe idempotent backfill matching profiles.id = auth.users.id
-- Only UUID and email are selected; NO passwords, tokens, or metadata are touched.
INSERT INTO public.user_emails (user_id, email, created_at, updated_at)
SELECT p.id, u.email, timezone('utc'::text, now()), timezone('utc'::text, now())
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email IS NOT NULL AND u.email <> ''
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());


-- ----------------------------------------------------------------------------
-- 3. HARDENED create_internal_user RPC (No Default Passwords, Min 12 Chars)
-- ----------------------------------------------------------------------------
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
    v_caller_role TEXT;
BEGIN
    -- Authorization guard: Only Owner and Admin can invoke this function
    v_caller_role := public.get_current_user_role();
    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang memiliki izin membuat pengguna baru';
    END IF;

    -- Strict Owner boundary: Only Owner can create an Owner account
    IF p_role_code = 'owner' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Hanya Owner yang berhak membuat akun dengan peran Owner';
    END IF;

    -- Password validation: Must not be null and must be at least 12 characters
    IF p_password IS NULL OR length(trim(p_password)) < 12 THEN
        RAISE EXCEPTION 'Password wajib diisi dan minimal 12 karakter';
    END IF;

    -- Fetch target role ID
    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % tidak ditemukan', p_role_code;
    END IF;

    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Check if user already exists in auth.users
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
            aud,
            email_change,
            recovery_token,
            confirmation_token,
            email_change_token_new,
            reauthentication_token,
            phone_change_token,
            phone_change,
            email_change_token_current
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            p_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            '', '', '', '', '', '', '', ''
        );

        -- Insert into auth.identities
        INSERT INTO auth.identities (
            id,
            provider_id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id::text,
            v_user_id,
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', p_email,
                'email_verified', false,
                'phone_verified', false
            ),
            'email',
            NOW(),
            NOW(),
            NOW()
        );
    ELSE
        -- Update existing user password
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Upsert Profile
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, p_full_name, true)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        is_active = true,
        updated_at = NOW();

    -- Upsert User Email into dedicated protected table
    INSERT INTO public.user_emails (user_id, email)
    VALUES (v_user_id, p_email)
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();

    -- Assign User Role
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT DO NOTHING;

    RETURN v_user_id;
END;
$$;

ALTER FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_internal_user(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. MAKER-CHECKER VOID APPROVAL: STUDENT PAYMENTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payment_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_payment_id UUID;
    v_requested_by UUID;
    v_req_status VARCHAR(20);
    v_void_reason TEXT;
    v_user_role VARCHAR;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_payment_void_request';
    END IF;

    -- Role Check: Owner and Admin are permitted
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang memiliki wewenang untuk memproses persetujuan void pembayaran';
    END IF;

    SELECT payment_id, requested_by, status, reason
    INTO v_payment_id, v_requested_by, v_req_status, v_void_reason
    FROM public.payment_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Permintaan void tidak ditemukan atau telah diproses sebelumnya';
    END IF;

    -- Maker-Checker Security Rule: Requester cannot approve their own void request
    IF p_action = 'approve' AND v_actor_id = v_requested_by THEN
        RAISE EXCEPTION 'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.payment_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.student_payments
        SET status = 'voided',
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = v_void_reason,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_payment_id;
    ELSE
        UPDATE public.payment_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 5. MAKER-CHECKER VOID APPROVAL: UT REMITTANCES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_ut_remittance_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_remittance_id UUID;
    v_requested_by UUID;
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_ut_remittance_void_request';
    END IF;

    -- Role Check: Owner and Admin are permitted
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang berhak memproses persetujuan void setoran UT';
    END IF;

    SELECT remittance_id, requested_by, status
    INTO v_remittance_id, v_requested_by, v_req_status
    FROM public.ut_remittance_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Permintaan void tidak ditemukan atau telah diproses sebelumnya';
    END IF;

    -- Maker-Checker Security Rule: Requester cannot approve their own void request
    IF p_action = 'approve' AND v_actor_id = v_requested_by THEN
        RAISE EXCEPTION 'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.ut_remittance_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.ut_remittances
        SET status = 'voided',
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = p_review_notes,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_remittance_id;

        -- Re-evaluate target LIP statuses
        FOR v_item IN
            SELECT ri.lip_document_id
            FROM public.ut_remittance_items ri
            WHERE ri.remittance_id = v_remittance_id
        LOOP
            SELECT official_amount INTO v_lip_official
            FROM public.lip_documents
            WHERE id = v_item.lip_document_id;

            SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
            FROM public.ut_remittance_items ri
            JOIN public.ut_remittances r ON ri.remittance_id = r.id
            WHERE ri.lip_document_id = v_item.lip_document_id
              AND r.status = 'verified';

            IF v_already_verified >= v_lip_official THEN
                UPDATE public.lip_documents
                SET status = 'paid'
                WHERE id = v_item.lip_document_id;
            ELSIF v_already_verified > 0 THEN
                UPDATE public.lip_documents
                SET status = 'partially_paid'
                WHERE id = v_item.lip_document_id;
            ELSE
                UPDATE public.lip_documents
                SET status = 'unpaid'
                WHERE id = v_item.lip_document_id;
            END IF;
        END LOOP;
    ELSE
        UPDATE public.ut_remittance_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 6. MAKER-CHECKER VOID APPROVAL: OPERATIONAL CASH TRANSACTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_operational_transaction_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR,
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_ops_id UUID;
    v_requested_by UUID;
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_operational_transaction_void_request';
    END IF;

    -- Role Check: Owner and Admin are permitted
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Hanya Owner dan Admin yang berhak memproses persetujuan void kas operasional';
    END IF;

    SELECT operational_transaction_id, requested_by, status
    INTO v_ops_id, v_requested_by, v_req_status
    FROM public.operational_transaction_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Permintaan void tidak ditemukan atau telah diproses sebelumnya';
    END IF;

    -- Maker-Checker Security Rule: Requester cannot approve their own void request
    IF p_action = 'approve' AND v_actor_id = v_requested_by THEN
        RAISE EXCEPTION 'Prinsip Maker-Checker: Anda tidak dapat menyetujui permohonan void yang Anda ajukan sendiri. Persetujuan harus dilakukan oleh Owner atau Admin lain.';
    END IF;

    IF p_action = 'approve' THEN
        UPDATE public.operational_transaction_void_requests
        SET status = 'approved',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;

        UPDATE public.operational_transactions
        SET status = 'voided',
            voided_at = NOW(),
            voided_by = v_actor_id,
            void_reason = p_review_notes,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_ops_id;
    ELSE
        UPDATE public.operational_transaction_void_requests
        SET status = 'rejected',
            reviewed_by = v_actor_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes
        WHERE id = p_void_request_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 7. STORAGE POLICIES FOR ADMIN ROLE
-- ----------------------------------------------------------------------------
-- payment-proofs
DROP POLICY IF EXISTS "Owner/Admin/FinanceAdmin can upload payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/Admin/FinanceAdmin can upload payment proof storage objects" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'admin', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/Admin/FinanceAdmin can update payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/Admin/FinanceAdmin can update payment proof storage objects" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'admin', 'finance_admin'));

-- ut-remittance-proofs
DROP POLICY IF EXISTS "Owner/Admin/FinanceAdmin can upload ut remittance proofs" ON storage.objects;
CREATE POLICY "Owner/Admin/FinanceAdmin can upload ut remittance proofs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'admin', 'finance_admin'));

-- operational-proofs
DROP POLICY IF EXISTS "Owner/Admin/FinanceAdmin can upload operational proofs" ON storage.objects;
CREATE POLICY "Owner/Admin/FinanceAdmin can upload operational proofs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'admin', 'finance_admin'));

COMMIT;
