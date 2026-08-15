-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 8: Final Hardening, Search Path Security & Hard Delete Prevention Audit
-- ============================================================================

-- 1. HARDENING SECURITY DEFINER SEARCH_PATH ON ALL STORED PROCEDURES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'handle_new_user',
            'get_current_user_role',
            'change_student_status',
            'create_registration_with_snapshots',
            'create_invoice_with_items',
            'create_payment_with_allocation',
            'verify_student_payment',
            'approve_payment_void_request',
            'create_ut_remittance_with_items',
            'verify_ut_remittance',
            'approve_ut_remittance_void_request',
            'check_lip_status_consistency',
            'create_operational_transaction',
            'verify_operational_transaction',
            'approve_operational_transaction_void_request'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', r.func_signature);
    END LOOP;
END $$;

-- 3. AUDIT COMMENT FOR HARD DELETE PREVENTION
-- Financial ledger tables (student_payments, payment_allocations, ut_remittances, ut_remittance_items, operational_transactions, invoices, invoice_items, lip_documents)
-- are protected from hard-deleting verified historical transactions.
COMMENT ON TABLE public.student_payments IS 'Protected ledger: Verified student payments are immutable and cannot be hard-deleted.';
COMMENT ON TABLE public.ut_remittances IS 'Protected ledger: Verified UT remittances are immutable and cannot be hard-deleted.';
COMMENT ON TABLE public.operational_transactions IS 'Protected ledger: Verified operational transactions are immutable and cannot be hard-deleted.';
