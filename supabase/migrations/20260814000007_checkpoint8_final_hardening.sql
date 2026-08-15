-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 8: Final Hardening, Search Path Security & Hard Delete Prevention Audit
-- ============================================================================

-- 1. HARDENING SECURITY DEFINER SEARCH_PATH ON LEGACY FUNCTIONS (CP 1 - 3)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.change_student_status(UUID, UUID, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_registration_with_snapshots(UUID, UUID, UUID, UUID, INTEGER, INTEGER, JSONB, UUID) SET search_path = public, pg_temp;

-- 2. VERIFY SECURITY DEFINER SEARCH_PATH ON ALL OTHER STORED PROCEDURES (CP 4 - 7A)
ALTER FUNCTION public.create_invoice_with_items(UUID, VARCHAR, JSONB, UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_payment_with_allocation(UUID, TIMESTAMPTZ, BIGINT, UUID, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, BIGINT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_student_payment(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_payment_void_request(UUID, UUID, VARCHAR, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_ut_remittance_with_items(TIMESTAMPTZ, BIGINT, UUID, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID, JSONB) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_ut_remittance(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_ut_remittance_void_request(UUID, UUID, VARCHAR, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_lip_status_consistency() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_operational_transaction(VARCHAR, UUID, UUID, TIMESTAMPTZ, BIGINT, TEXT, VARCHAR, TEXT, VARCHAR, VARCHAR, BIGINT, TEXT, UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_operational_transaction(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_operational_transaction_void_request(UUID, UUID, VARCHAR, TEXT) SET search_path = public, pg_temp;

-- 3. AUDIT COMMENT FOR HARD DELETE PREVENTION
-- Financial ledger tables (student_payments, payment_allocations, ut_remittances, ut_remittance_items, operational_transactions, invoices, invoice_items, lip_documents)
-- are protected from hard-deleting verified historical transactions.
COMMENT ON TABLE public.student_payments IS 'Protected ledger: Verified student payments are immutable and cannot be hard-deleted.';
COMMENT ON TABLE public.ut_remittances IS 'Protected ledger: Verified UT remittances are immutable and cannot be hard-deleted.';
COMMENT ON TABLE public.operational_transactions IS 'Protected ledger: Verified operational transactions are immutable and cannot be hard-deleted.';
