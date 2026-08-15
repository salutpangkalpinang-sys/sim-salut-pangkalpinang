-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 3: Registrations & Registration Fee Snapshots
-- ============================================================================

-- 1. REGISTRATION TYPES MASTER TABLE
CREATE TABLE IF NOT EXISTS public.registration_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'NEW_STUDENT', 'RE_REGISTRATION'
    name VARCHAR(100) NOT NULL,       -- e.g., 'Mahasiswa Baru', 'Registrasi Ulang'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed Registration Types initial data
INSERT INTO public.registration_types (code, name) VALUES
('NEW_STUDENT', 'Mahasiswa Baru'),
('RE_REGISTRATION', 'Registrasi Ulang')
ON CONFLICT (code) DO NOTHING;

-- 2. REGISTRATION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.registration_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.registration_number_seq');
    RETURN 'REG-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. REGISTRATIONS TABLE (Storing Academic Context Snapshots)
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_registration_number(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    academic_period_id UUID NOT NULL REFERENCES public.academic_periods(id) ON DELETE RESTRICT,
    registration_type_id UUID NOT NULL REFERENCES public.registration_types(id) ON DELETE RESTRICT,
    study_program_id UUID NOT NULL REFERENCES public.study_programs(id) ON DELETE RESTRICT, -- Context Snapshot
    service_scheme_id UUID NOT NULL REFERENCES public.service_schemes(id) ON DELETE RESTRICT, -- Context Snapshot
    credits INTEGER DEFAULT 0 NOT NULL CHECK (credits >= 0),
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('draft', 'active', 'cancelled')),
    notes TEXT NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for registrations
CREATE INDEX IF NOT EXISTS idx_registrations_student ON public.registrations (student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_period ON public.registrations (academic_period_id);
CREATE INDEX IF NOT EXISTS idx_registrations_type ON public.registrations (registration_type_id);
CREATE INDEX IF NOT EXISTS idx_registrations_program ON public.registrations (study_program_id);
CREATE INDEX IF NOT EXISTS idx_registrations_scheme ON public.registrations (service_scheme_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations (status);

-- 4. REGISTRATION FEE SNAPSHOTS TABLE (Immutable Historical Tariff Copy)
CREATE TABLE IF NOT EXISTS public.registration_fee_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    source_fee_rate_id UUID REFERENCES public.fee_rates(id) ON DELETE SET NULL,
    fee_type_id UUID NOT NULL REFERENCES public.fee_types(id) ON DELETE RESTRICT,
    fee_name_snapshot VARCHAR(150) NOT NULL,
    calculation_type VARCHAR(20) NOT NULL CHECK (calculation_type IN ('FIXED', 'PER_SKS', 'per_semester', 'per_sks')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_amount BIGINT NOT NULL CHECK (unit_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount = quantity * unit_amount),
    source_snapshot VARCHAR(100) DEFAULT 'Master Rate Snapshot' NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_snapshots_registration ON public.registration_fee_snapshots (registration_id);

-- 5. ATOMIC STORED PROCEDURE FOR CREATING REGISTRATION + SNAPSHOTS
CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_study_program_id UUID,
    p_service_scheme_id UUID,
    p_credits INTEGER,
    p_notes TEXT,
    p_created_by UUID,
    p_fee_items JSONB -- JSON Array of fee snapshot lines
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_item JSONB;
BEGIN
    -- 1. Generate Registration Number
    v_reg_number := public.generate_registration_number();

    -- 2. Insert Registration Record
    INSERT INTO public.registrations (
        registration_number,
        student_id,
        academic_period_id,
        registration_type_id,
        study_program_id,
        service_scheme_id,
        credits,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_reg_number,
        p_student_id,
        p_academic_period_id,
        p_registration_type_id,
        p_study_program_id,
        p_service_scheme_id,
        p_credits,
        'active',
        p_notes,
        p_created_by,
        p_created_by
    ) RETURNING id INTO v_registration_id;

    -- 3. Insert Fee Snapshot Lines
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_fee_items)
    LOOP
        INSERT INTO public.registration_fee_snapshots (
            registration_id,
            source_fee_rate_id,
            fee_type_id,
            fee_name_snapshot,
            calculation_type,
            quantity,
            unit_amount,
            total_amount,
            source_snapshot,
            notes
        ) VALUES (
            v_registration_id,
            (v_item->>'source_fee_rate_id')::UUID,
            (v_item->>'fee_type_id')::UUID,
            (v_item->>'fee_name_snapshot')::VARCHAR,
            (v_item->>'calculation_type')::VARCHAR,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_amount')::BIGINT,
            (v_item->>'quantity')::INTEGER * (v_item->>'unit_amount')::BIGINT,
            COALESCE(v_item->>'source_snapshot', 'Master Rate Snapshot'),
            v_item->>'notes'
        );
    END LOOP;

    RETURN v_registration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.registration_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_fee_snapshots ENABLE ROW LEVEL SECURITY;

-- Read policies
DROP POLICY IF EXISTS "Authenticated users can view registration_types" ON public.registration_types;
CREATE POLICY "Authenticated users can view registration_types" ON public.registration_types
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view registrations" ON public.registrations;
CREATE POLICY "Authenticated users can view registrations" ON public.registrations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Authenticated users can view registration_fee_snapshots" ON public.registration_fee_snapshots
    FOR SELECT TO authenticated USING (true);

-- Write policies (Only Owner and Academic Admin can manage registrations)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert registrations" ON public.registrations;
CREATE POLICY "Owner/AcademicAdmin can insert registrations" ON public.registrations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update registrations" ON public.registrations;
CREATE POLICY "Owner/AcademicAdmin can update registrations" ON public.registrations
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Owner/AcademicAdmin can insert registration_fee_snapshots" ON public.registration_fee_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Owner/AcademicAdmin can update registration_fee_snapshots" ON public.registration_fee_snapshots
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
