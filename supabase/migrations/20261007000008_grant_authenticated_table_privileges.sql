-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 2.8: Grant Standard SELECT/DML Privileges to Authenticated Role
--
-- Context:
-- Supabase CLI sets restrictive default schema privileges for role 'postgres'
-- where tables created during migrations do not automatically inherit SQL table-level
-- privileges (SELECT, INSERT, UPDATE, DELETE) for role 'authenticated'.
--
-- Security:
-- 1. All tables remain strictly protected by Row-Level Security (RLS) policies.
-- 2. Role 'anon' is explicitly NOT granted SELECT/DML on internal business tables.
-- 3. Anonymous users strictly have NO access (fail-closed).
-- ============================================================================

BEGIN;

-- 1. Master Data & Identity Tables (SELECT for authenticated)
GRANT SELECT ON TABLE public.roles TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.academic_periods TO authenticated;
GRANT SELECT ON TABLE public.faculties TO authenticated;
GRANT SELECT ON TABLE public.study_levels TO authenticated;
GRANT SELECT ON TABLE public.study_programs TO authenticated;
GRANT SELECT ON TABLE public.service_schemes TO authenticated;
GRANT SELECT ON TABLE public.student_statuses TO authenticated;
GRANT SELECT ON TABLE public.fee_types TO authenticated;
GRANT SELECT ON TABLE public.fee_rates TO authenticated;
GRANT SELECT ON TABLE public.payment_methods TO authenticated;
GRANT SELECT ON TABLE public.cash_accounts TO authenticated;
GRANT SELECT ON TABLE public.operational_categories TO authenticated;
GRANT SELECT ON TABLE public.app_settings TO authenticated;

-- 2. Student & Registration Core Tables (Controlled by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_fee_snapshots TO authenticated;
GRANT SELECT ON TABLE public.registration_types TO authenticated;

-- 3. Invoice & Document Management (Controlled by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lip_documents TO authenticated;

-- 4. Financial & Payment Tables (Controlled by RLS policies & RPCs)
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_payments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_void_requests TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ut_remittances TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ut_remittance_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ut_remittance_void_requests TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.operational_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.operational_transaction_void_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

-- 5. Master Data Mutation Privileges (Authorized according to existing RLS policies)
GRANT INSERT, UPDATE, DELETE ON TABLE public.study_programs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.fee_rates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.cash_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.faculties TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.operational_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;

-- Explicitly ensure anon role has NO SELECT privilege on sensitive business tables
REVOKE ALL ON TABLE public.students FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.registrations FROM anon;
REVOKE ALL ON TABLE public.invoices FROM anon;
REVOKE ALL ON TABLE public.student_payments FROM anon;
REVOKE ALL ON TABLE public.lip_documents FROM anon;

COMMIT;
