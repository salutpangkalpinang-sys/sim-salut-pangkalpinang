-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 6C.1: User Management & Audit Logs Table
-- ============================================================================

-- 1. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'user_invited', 'user_role_changed', 'user_deactivated', 'user_reactivated'
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'profile', 'role'
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR AUDIT LOGS
-- Only Owner can view audit logs
DROP POLICY IF EXISTS "Owner can view audit logs" ON public.audit_logs;
CREATE POLICY "Owner can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'owner'
        )
    );

-- Authenticated users can insert audit logs for authorized actions
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = actor_user_id);

-- Restrict UPDATE and DELETE on audit logs (Immutable Audit Trail)
-- No UPDATE or DELETE policies are created to enforce immutability.
