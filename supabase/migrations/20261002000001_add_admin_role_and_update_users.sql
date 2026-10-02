BEGIN;

-- Migration: Add 'admin' role with full system access and assign Dixit MW & Yolanda as Admin
-- Dartika remains the exclusive Owner
-- Controlled role mutation restricted to verified exact UUIDs with replayability support.

-- 1. Insert standard roles if not exist (Idempotent across fresh/local/production environments)
INSERT INTO public.roles (code, name, description)
VALUES
    ('owner', 'Owner', 'Pemilik dan penanggung jawab utama sistem SIM-SALUT'),
    ('admin', 'Admin (Akses Penuh)', 'Akses operasional penuh ke seluruh menu dan modul internal SIM-SALUT'),
    ('academic_admin', 'Admin Akademik', 'Pengelolaan data mahasiswa dan registrasi mata kuliah'),
    ('finance_admin', 'Admin Keuangan', 'Pengelolaan tagihan, pembayaran, setoran, dan kas operasional'),
    ('viewer', 'Viewer', 'Akses hanya lihat untuk keperluan monitoring dan peninjauan')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Update Dixit MW and Yolanda to 'admin' role (Exact Verified UUIDs, Environment-Aware)
DO $$
DECLARE
    v_admin_role_id UUID;
    v_owner_role_id UUID;
    c_dartika_id CONSTANT UUID := '9e9e7da9-1045-48fd-a74d-9046e13389b3'::UUID;
    c_dixit_id   CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
    c_yolanda_id CONSTANT UUID := '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID;
    v_target_count INT;
    v_dartika_name TEXT;
    v_dixit_name   TEXT;
    v_yolanda_name TEXT;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.roles WHERE code = 'admin';
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'owner';

    IF v_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Role admin tidak ditemukan di public.roles';
    END IF;

    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'Role owner tidak ditemukan di public.roles';
    END IF;

    -- Hitung keberadaan tiga target UUID pada tabel public.profiles
    SELECT COUNT(*) INTO v_target_count
    FROM public.profiles
    WHERE id IN (c_dartika_id, c_dixit_id, c_yolanda_id);

    -- KASUS A: Fresh / Local Environment (0 dari 3 ditemukan)
    IF v_target_count = 0 THEN
        RAISE NOTICE 'Fresh/local environment terdeteksi: 0 dari 3 target profile ditemukan. Role assignment dilewati secara aman.';
        RETURN;
    END IF;

    -- KASUS B: Inconsistent State (1 atau 2 dari 3 ditemukan)
    IF v_target_count IN (1, 2) THEN
        RAISE EXCEPTION 'Inkonsistensi data: Ditemukan % dari 3 target profile di public.profiles. Aborting transaction.', v_target_count;
    END IF;

    -- KASUS C: Target Environment Lengkap (3 dari 3 ditemukan)
    -- Verify exact UUIDs exist and fetch full_name for sanity verification
    SELECT full_name INTO v_dartika_name FROM public.profiles WHERE id = c_dartika_id;
    IF v_dartika_name IS NULL THEN
        RAISE EXCEPTION 'User ID Dartika (%) tidak ditemukan pada tabel public.profiles', c_dartika_id;
    END IF;
    IF UPPER(v_dartika_name) NOT LIKE '%DARTIKA%' THEN
        RAISE EXCEPTION 'User ID Dartika (%) memiliki nama tidak terduga: %', c_dartika_id, v_dartika_name;
    END IF;

    SELECT full_name INTO v_dixit_name FROM public.profiles WHERE id = c_dixit_id;
    IF v_dixit_name IS NULL THEN
        RAISE EXCEPTION 'User ID Dixit MW (%) tidak ditemukan pada tabel public.profiles', c_dixit_id;
    END IF;
    IF UPPER(v_dixit_name) NOT LIKE '%DIXIT%' THEN
        RAISE EXCEPTION 'User ID Dixit MW (%) memiliki nama tidak terduga: %', c_dixit_id, v_dixit_name;
    END IF;

    SELECT full_name INTO v_yolanda_name FROM public.profiles WHERE id = c_yolanda_id;
    IF v_yolanda_name IS NULL THEN
        RAISE EXCEPTION 'User ID Yolanda (%) tidak ditemukan pada tabel public.profiles', c_yolanda_id;
    END IF;
    IF UPPER(v_yolanda_name) NOT LIKE '%YOLANDA%' THEN
        RAISE EXCEPTION 'User ID Yolanda (%) memiliki nama tidak terduga: %', c_yolanda_id, v_yolanda_name;
    END IF;

    -- Single-role atomic enforcement: Dixit MW -> Exactly ONE role 'admin'
    DELETE FROM public.user_roles WHERE user_id = c_dixit_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dixit_id, v_admin_role_id);

    -- Single-role atomic enforcement: Yolanda -> Exactly ONE role 'admin'
    DELETE FROM public.user_roles WHERE user_id = c_yolanda_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_yolanda_id, v_admin_role_id);

    -- Sole-owner atomic enforcement: Dartika -> Exactly ONE role 'owner'
    DELETE FROM public.user_roles WHERE user_id = c_dartika_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dartika_id, v_owner_role_id);

    -- -------------------------------------------------------------------------
    -- ASSERTIONS BEFORE TRANSACTION COMMIT
    -- -------------------------------------------------------------------------
    -- 1. Enforce Dartika has exactly 1 role and that role is 'owner'
    IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = c_dartika_id) <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: Dartika must have exactly 1 role assigned';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = c_dartika_id AND role_id = v_owner_role_id) THEN
        RAISE EXCEPTION 'Assertion failed: Dartika role must be owner';
    END IF;

    -- 2. Enforce Dixit MW has exactly 1 role and that role is 'admin'
    IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = c_dixit_id) <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: Dixit MW must have exactly 1 role assigned';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = c_dixit_id AND role_id = v_admin_role_id) THEN
        RAISE EXCEPTION 'Assertion failed: Dixit MW role must be admin';
    END IF;

    -- 3. Enforce Yolanda has exactly 1 role and that role is 'admin'
    IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = c_yolanda_id) <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: Yolanda must have exactly 1 role assigned';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = c_yolanda_id AND role_id = v_admin_role_id) THEN
        RAISE EXCEPTION 'Assertion failed: Yolanda role must be admin';
    END IF;

    -- 4. Enforce SOLE-OWNER constraint across the entire database:
    --    Total accounts with 'owner' role MUST be exactly 1, and that user MUST be Dartika.
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role_id = v_owner_role_id) <> 1 THEN
        RAISE EXCEPTION 'Assertion failed: Total pemilik (owner) dalam sistem harus tepat 1 (Dartika)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = v_owner_role_id AND user_id <> c_dartika_id) THEN
        RAISE EXCEPTION 'Assertion failed: Ditemukan pemilik (owner) lain selain Dartika';
    END IF;
END $$;

-- 3. Update RLS policies to allow 'admin' alongside 'owner'
-- Master Data
DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage master data" ON public.study_programs;
CREATE POLICY "Owner/AcademicAdmin can manage master data" ON public.study_programs FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage fee_rates" ON public.fee_rates;
CREATE POLICY "Owner/AcademicAdmin can manage fee_rates" ON public.fee_rates FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

-- Profiles & User Roles Management
DROP POLICY IF EXISTS "Owner can manage profiles" ON public.profiles;
CREATE POLICY "Owner can manage profiles" ON public.profiles FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owner can manage user roles" ON public.user_roles;
CREATE POLICY "Owner can manage user roles" ON public.user_roles FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin'));

-- App Settings
DROP POLICY IF EXISTS "Owner can update app settings" ON public.app_settings;
CREATE POLICY "Owner can update app settings" ON public.app_settings FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin'));

COMMIT;
