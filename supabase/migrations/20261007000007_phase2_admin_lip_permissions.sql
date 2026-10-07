-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.7: Add Admin Role to LIP Documents & Storage Management RLS Policies
-- ============================================================================

BEGIN;

-- 1. Table RLS: lip_documents
-- Allow 'owner', 'admin', and 'academic_admin' to insert and update lip_documents
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents;
DROP POLICY IF EXISTS "Owner/Admin/AcademicAdmin can insert lip_documents" ON public.lip_documents;

CREATE POLICY "Owner/Admin/AcademicAdmin can insert lip_documents"
ON public.lip_documents FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents;
DROP POLICY IF EXISTS "Owner/Admin/AcademicAdmin can update lip_documents" ON public.lip_documents;

CREATE POLICY "Owner/Admin/AcademicAdmin can update lip_documents"
ON public.lip_documents FOR UPDATE
TO authenticated
USING (public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

-- 2. Storage RLS: lip-documents bucket
-- Allow 'owner', 'admin', and 'academic_admin' to upload and update objects in lip-documents
DROP POLICY IF EXISTS "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Owner/Admin/AcademicAdmin can upload lip storage objects" ON storage.objects;

CREATE POLICY "Owner/Admin/AcademicAdmin can upload lip storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Owner/Admin/AcademicAdmin can update lip storage objects" ON storage.objects;

CREATE POLICY "Owner/Admin/AcademicAdmin can update lip storage objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'admin', 'academic_admin'));

COMMIT;
