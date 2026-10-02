-- ============================================================================
-- DRAFT EMERGENCY ROLLBACK SPECIFICATION & GUIDELINES
-- File: docs/rollback/draft_rollback_plan_20261002.sql
-- Status: DRAFT / DOCUMENTATION ONLY (DO NOT RUN AS MIGRATION)
--
-- PENTING / SECURITY WARNING:
-- 1. Rollback script ini BUKAN migration file dan TIDAK boleh disimpan di supabase/migrations/.
-- 2. Menjalankan 'git revert' HANYA mengembalikan kode aplikasi, TIDAK mengembalikan skema/data database.
-- 3. JIKA terjadi ketidakcocokan aplikasi, SOLUSI TERBAIK ADALAH:
--    a. Forward-fix (memperbaiki bug pada kode aplikasi).
--    b. Restore database dari snapshot backup resmi (Supabase Dashboard Point-in-Time Recovery).
-- 4. ATURAN ROLLBACK KEAMANAN:
--    - DILARANG membuka kembali password default historis atau nilai default lainnya.
--    - DILARANG mengaktifkan kembali RPC debug public.get_user_auth_debug.
--    - DILARANG memberikan privilege EXECUTE/SELECT kepada anon atau PUBLIC.
--    - DILARANG mengembalikan celah self-approval void (Maker-Checker wajib dipertahankan).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SKENARIO A: ROLLBACK ISOLASI TABEL user_emails
-- Hanya dijalankan jika tabel user_emails perlu dilepas tanpa merusak profil pengguna.
-- ----------------------------------------------------------------------------
-- 1. Drop trigger pada auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;

-- 2. Drop trigger function
DROP FUNCTION IF EXISTS public.handle_sync_user_email();

-- 3. Drop RLS policies
DROP POLICY IF EXISTS "Owner and Admin can view all user emails" ON public.user_emails;
DROP POLICY IF EXISTS "Staff can view own email only" ON public.user_emails;
DROP POLICY IF EXISTS "Active users can view own email" ON public.user_emails;

-- 4. Drop table user_emails
DROP TABLE IF EXISTS public.user_emails;

-- ----------------------------------------------------------------------------
-- SKENARIO B: ROLLBACK PENUGASAN ROLE ADMIN JIKA TERJADI ISU BISNIS
-- Perhatian: Dixit MW dan Yolanda TIDAK BOLEH dikembalikan ke Owner!
-- Jika role admin dibatalkan, kembalikan ke role viewer atau role fungsional terisolasi.
-- Dartika TETAP menjadi sole owner.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_viewer_role_id UUID;
    v_admin_role_id  UUID;
    c_dixit_id   CONSTANT UUID := '2193d03b-1112-4a7a-b987-e5ebde62fbf7'::UUID;
    c_yolanda_id CONSTANT UUID := '86532a24-5b5e-4213-a26f-bb098d84d319'::UUID;
BEGIN
    SELECT id INTO v_viewer_role_id FROM public.roles WHERE code = 'viewer';
    SELECT id INTO v_admin_role_id  FROM public.roles WHERE code = 'admin';

    -- Contoh pemindahan aman ke viewer jika diperintahkan manajemen:
    -- DELETE FROM public.user_roles WHERE user_id IN (c_dixit_id, c_yolanda_id) AND role_id = v_admin_role_id;
    -- INSERT INTO public.user_roles (user_id, role_id) VALUES (c_dixit_id, v_viewer_role_id), (c_yolanda_id, v_viewer_role_id);

    RAISE NOTICE 'Rollback role admin harus diverifikasi manual bersama manajemen';
END $$;

-- ----------------------------------------------------------------------------
-- SKENARIO C: CATATAN SECURITY KONTROL YANG TIDAK BOLEH DI-ROLLBACK
-- ----------------------------------------------------------------------------
-- 1. RPC get_user_auth_debug TETAP DROPPED (Jangan pernah dibuat ulang).
-- 2. Validasi password >= 12 karakter pada create_internal_user TETAP DITEGAKKAN.
-- 3. Maker-Checker pada Void Approval TETAP DITEGAKKAN (Self-approval tetap dilarang).
-- 4. Akses anon TETAP DICABUT.
