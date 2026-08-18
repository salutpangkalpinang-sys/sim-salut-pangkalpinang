-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 1: Foundation, Auth, Profiles, Roles, RLS & Master Data
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. IDENTITY & RBAC TABLES

-- Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User Roles Table (User to Role mapping)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, role_id)
);

-- 3. MASTER DATA TABLES

-- Academic Periods Table
CREATE TABLE IF NOT EXISTS public.academic_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., '20261'
    name VARCHAR(100) NOT NULL,        -- e.g., '2026/2027 Ganjil'
    term VARCHAR(20) NOT NULL,        -- e.g., 'Ganjil', 'Genap'
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Faculties Table
CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Study Levels Table
CREATE TABLE IF NOT EXISTS public.study_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'S1', 'D3'
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Study Programs Table
CREATE TABLE IF NOT EXISTS public.study_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    faculty_id UUID REFERENCES public.faculties(id) ON DELETE RESTRICT,
    study_level_id UUID REFERENCES public.study_levels(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Service Schemes Table
CREATE TABLE IF NOT EXISTS public.service_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'SIPAS_NON_TTM', 'NON_SIPAS'
    name VARCHAR(100) NOT NULL,       -- e.g., 'SIPAS Non-TTM', 'Non-SIPAS'
    category VARCHAR(50) NOT NULL,   -- e.g., 'SIPAS', 'Non-SIPAS'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Fee Types Table
CREATE TABLE IF NOT EXISTS public.fee_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'TUITION', 'REPEAT_COURSE', 'SALUT_SERVICE'
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,    -- 'UT_OFFICIAL', 'SALUT_INTERNAL'
    is_per_sks BOOLEAN DEFAULT FALSE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Fee Rates Table (Master Tarif with Historical Validity)
CREATE TABLE IF NOT EXISTS public.fee_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_period_id UUID REFERENCES public.academic_periods(id) ON DELETE RESTRICT,
    study_program_id UUID REFERENCES public.study_programs(id) ON DELETE RESTRICT,
    service_scheme_id UUID REFERENCES public.service_schemes(id) ON DELETE RESTRICT,
    fee_type_id UUID NOT NULL REFERENCES public.fee_types(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    calculation_type VARCHAR(20) DEFAULT 'FIXED' NOT NULL, -- 'FIXED', 'PER_SKS'
    unit_amount BIGINT NOT NULL CHECK (unit_amount >= 0),  -- Stored in Integer Rupiah
    start_date DATE,
    end_date DATE,
    source VARCHAR(100) DEFAULT 'SK Resmi' NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'VERIFIED' NOT NULL, -- 'DRAFT', 'VERIFIED'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'CASH', 'BANK_TRANSFER'
    name VARCHAR(100) NOT NULL,
    requires_reference BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Student Statuses Table
CREATE TABLE IF NOT EXISTS public.student_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'CALON', 'AKTIF', 'CUTI', 'NONAKTIF', 'DO', 'LULUS'
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Cash Accounts Table
CREATE TABLE IF NOT EXISTS public.cash_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,       -- e.g., 'Kas Tunai SALUT', 'Rekening Bank BCA SALUT'
    account_number VARCHAR(50),
    bank_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Operational Transaction Categories Table
CREATE TABLE IF NOT EXISTS public.operational_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES public.profiles(id)
);

-- 4. AUTOMATIC PROFILE TRIGGER ON SIGNUP

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id UUID;
BEGIN
    -- Insert profile
    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        TRUE
    );

    -- Find viewer role ID as fallback
    SELECT id INTO default_role_id FROM public.roles WHERE code = 'viewer' LIMIT 1;

    -- Assign default role if exists
    IF default_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, default_role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES — DEFAULT DENY PRINCIPLE

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Base helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS VARCHAR AS $$
DECLARE
    role_code VARCHAR;
BEGIN
    SELECT r.code INTO role_code
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    LIMIT 1;

    RETURN COALESCE(role_code, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Read policies (All authenticated internal users can read master data)
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;
CREATE POLICY "Authenticated users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view user_roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view academic_periods" ON public.academic_periods;
CREATE POLICY "Authenticated users can view academic_periods" ON public.academic_periods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view faculties" ON public.faculties;
CREATE POLICY "Authenticated users can view faculties" ON public.faculties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view study_levels" ON public.study_levels;
CREATE POLICY "Authenticated users can view study_levels" ON public.study_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view study_programs" ON public.study_programs;
CREATE POLICY "Authenticated users can view study_programs" ON public.study_programs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view service_schemes" ON public.service_schemes;
CREATE POLICY "Authenticated users can view service_schemes" ON public.service_schemes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view fee_types" ON public.fee_types;
CREATE POLICY "Authenticated users can view fee_types" ON public.fee_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view fee_rates" ON public.fee_rates;
CREATE POLICY "Authenticated users can view fee_rates" ON public.fee_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view payment_methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can view payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view student_statuses" ON public.student_statuses;
CREATE POLICY "Authenticated users can view student_statuses" ON public.student_statuses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view cash_accounts" ON public.cash_accounts;
CREATE POLICY "Authenticated users can view cash_accounts" ON public.cash_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view operational_categories" ON public.operational_categories;
CREATE POLICY "Authenticated users can view operational_categories" ON public.operational_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can view app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Write policies (Only Owner and Academic Admin can mutate master data)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage master data" ON public.study_programs;
CREATE POLICY "Owner/AcademicAdmin can manage master data" ON public.study_programs FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage fee_rates" ON public.fee_rates;
CREATE POLICY "Owner/AcademicAdmin can manage fee_rates" ON public.fee_rates FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner can manage user roles" ON public.user_roles;
CREATE POLICY "Owner can manage user roles" ON public.user_roles FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner');

DROP POLICY IF EXISTS "Owner can manage app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can manage app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can manage app_settings" ON public.app_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 2: Students & Student Status History
-- ============================================================================

-- 1. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nim VARCHAR(30) NULL,
    nik VARCHAR(30) NULL,
    full_name VARCHAR(255) NOT NULL,
    birth_place VARCHAR(100) NULL,
    birth_date DATE NULL,
    gender VARCHAR(20) NULL CHECK (gender IN ('L', 'P')),
    whatsapp VARCHAR(30) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    city VARCHAR(100) NULL,
    entry_year INTEGER NULL CHECK (entry_year >= 1990 AND entry_year <= 2100),
    faculty_id UUID REFERENCES public.faculties(id) ON DELETE RESTRICT,
    study_level_id UUID REFERENCES public.study_levels(id) ON DELETE RESTRICT,
    study_program_id UUID REFERENCES public.study_programs(id) ON DELETE RESTRICT,
    service_scheme_id UUID REFERENCES public.service_schemes(id) ON DELETE RESTRICT,
    status_id UUID NOT NULL REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    status_effective_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    internal_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. PARTIAL UNIQUE INDEXES (Crucial for handling NULL NIM/NIK without duplicate constraint errors)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nim_unique ON public.students (nim) WHERE nim IS NOT NULL AND nim <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nik_unique ON public.students (nik) WHERE nik IS NOT NULL AND nik <> '';

-- 3. SEARCH & FILTER INDEXES
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students (full_name);
CREATE INDEX IF NOT EXISTS idx_students_whatsapp ON public.students (whatsapp);
CREATE INDEX IF NOT EXISTS idx_students_faculty ON public.students (faculty_id);
CREATE INDEX IF NOT EXISTS idx_students_program ON public.students (study_program_id);
CREATE INDEX IF NOT EXISTS idx_students_year ON public.students (entry_year);
CREATE INDEX IF NOT EXISTS idx_students_scheme ON public.students (service_scheme_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status_id);

-- 4. STUDENT STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.student_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    previous_status_id UUID REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    new_status_id UUID NOT NULL REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    effective_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_student ON public.student_status_history (student_id);

-- 5. ATOMIC STATUS CHANGE STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.change_student_status(
    p_student_id UUID,
    p_new_status_id UUID,
    p_effective_at TIMESTAMPTZ,
    p_reason TEXT,
    p_changed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status_id UUID;
BEGIN
    -- 1. Fetch current status
    SELECT status_id INTO v_old_status_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_old_status_id IS NULL THEN
        RAISE EXCEPTION 'Student with ID % not found', p_student_id;
    END IF;

    -- If status hasn't changed, return early
    IF v_old_status_id = p_new_status_id THEN
        RETURN TRUE;
    END IF;

    -- 2. Update student status
    UPDATE public.students
    SET 
        status_id = p_new_status_id,
        status_effective_at = COALESCE(p_effective_at, NOW()),
        updated_at = NOW(),
        updated_by = p_changed_by
    WHERE id = p_student_id;

    -- 3. Record status history entry
    INSERT INTO public.student_status_history (
        student_id,
        previous_status_id,
        new_status_id,
        effective_at,
        reason,
        changed_by
    ) VALUES (
        p_student_id,
        v_old_status_id,
        p_new_status_id,
        COALESCE(p_effective_at, NOW()),
        p_reason,
        p_changed_by
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

-- Read policy (All internal authenticated users can view student records)
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
CREATE POLICY "Authenticated users can view students" ON public.students
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.student_status_history;
CREATE POLICY "Authenticated users can view status history" ON public.student_status_history
    FOR SELECT TO authenticated USING (true);

-- Write policies (Only Owner and Academic Admin can insert/update students)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert students" ON public.students;
CREATE POLICY "Owner/AcademicAdmin can insert students" ON public.students
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update students" ON public.students;
CREATE POLICY "Owner/AcademicAdmin can update students" ON public.students
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert status history" ON public.student_status_history;
CREATE POLICY "Owner/AcademicAdmin can insert status history" ON public.student_status_history
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
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
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 4: Preflight Security Patch, LIP Documents, Invoices & Storage
-- ============================================================================

-- 1. PREFLIGHT SECURITY PATCH ON create_registration_with_snapshots
CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_study_program_id UUID,
    p_service_scheme_id UUID,
    p_credits INTEGER,
    p_notes TEXT,
    p_created_by UUID,
    p_fee_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    -- Derive actor ID safely from auth.uid() or server payload
    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_registration_with_snapshots';
    END IF;

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
        v_actor_id,
        v_actor_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. LIP DOCUMENTS TABLE (Official UT Financial Liability Document)
CREATE TABLE IF NOT EXISTS public.lip_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_number VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL CHECK (version >= 1),
    official_amount BIGINT NOT NULL CHECK (official_amount >= 0),
    tuition_amount BIGINT DEFAULT 0 NOT NULL CHECK (tuition_amount >= 0),
    book_amount BIGINT DEFAULT 0 NOT NULL CHECK (book_amount >= 0),
    shipping_amount BIGINT DEFAULT 0 NOT NULL CHECK (shipping_amount >= 0),
    other_ut_amount BIGINT DEFAULT 0 NOT NULL CHECK (other_ut_amount >= 0),
    issued_at DATE NULL,
    due_at DATE NULL,
    storage_path TEXT NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'paid_to_ut', 'cancelled')),
    notes TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE(registration_id, version)
);

-- Partial Unique Index: Max 1 active verified LIP per registration
CREATE UNIQUE INDEX IF NOT EXISTS idx_lip_unique_verified_per_reg
ON public.lip_documents (registration_id)
WHERE status = 'verified';

CREATE INDEX IF NOT EXISTS idx_lip_registration ON public.lip_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_lip_status ON public.lip_documents (status);
CREATE INDEX IF NOT EXISTS idx_lip_number ON public.lip_documents (lip_number);


-- 3. INVOICE NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.invoice_number_seq');
    RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 4. INVOICES TABLE (Internal Student Bill Header)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_invoice_number(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    issued_at DATE DEFAULT CURRENT_DATE NOT NULL,
    due_at DATE NULL,
    status VARCHAR(20) DEFAULT 'unpaid' NOT NULL CHECK (status IN ('draft', 'unpaid', 'cancelled', 'partial', 'paid', 'overdue')),
    notes TEXT NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Partial Unique Index: Max 1 active invoice per verified LIP
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_active_per_lip
ON public.invoices (lip_document_id)
WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_invoices_registration ON public.invoices (registration_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lip ON public.invoices (lip_document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);


-- 5. INVOICE ITEMS TABLE (Auditable Itemized Billing Details)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('ut_liability', 'service_fee', 'internal_fee', 'discount')),
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_amount BIGINT NOT NULL CHECK (unit_amount >= 0),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    source_type VARCHAR(30) DEFAULT 'manual' NOT NULL,
    source_id UUID NULL,
    approval_status VARCHAR(20) NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_reason TEXT NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON public.invoice_items (item_type);


-- 6. ATOMIC STORED PROCEDURE FOR INVOICE CREATION WITH ITEMS
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    p_registration_id UUID,
    p_lip_document_id UUID,
    p_due_at DATE,
    p_notes TEXT,
    p_created_by UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_inv_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
    v_lip_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_invoice_with_items';
    END IF;

    -- Verify that LIP document status is 'verified'
    SELECT status INTO v_lip_status FROM public.lip_documents WHERE id = p_lip_document_id;
    IF v_lip_status IS NULL OR v_lip_status <> 'verified' THEN
        RAISE EXCEPTION 'Invoice can only be issued for verified LIP documents';
    END IF;

    -- Generate Invoice Number
    v_inv_number := public.generate_invoice_number();

    -- Insert Invoice Header
    INSERT INTO public.invoices (
        invoice_number,
        registration_id,
        lip_document_id,
        due_at,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_inv_number,
        p_registration_id,
        p_lip_document_id,
        p_due_at,
        'unpaid',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_invoice_id;

    -- Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            fee_type_id,
            description,
            quantity,
            unit_amount,
            amount,
            source_type,
            source_id,
            approval_status,
            approval_reason,
            approved_by,
            approved_at,
            created_by
        ) VALUES (
            v_invoice_id,
            (v_item->>'item_type')::VARCHAR,
            (v_item->>'fee_type_id')::UUID,
            (v_item->>'description')::VARCHAR,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_amount')::BIGINT,
            (v_item->>'quantity')::INTEGER * (v_item->>'unit_amount')::BIGINT,
            COALESCE(v_item->>'source_type', 'manual'),
            (v_item->>'source_id')::UUID,
            v_item->>'approval_status',
            v_item->>'approval_reason',
            (v_item->>'approved_by')::UUID,
            CASE WHEN v_item->>'approval_status' = 'approved' THEN NOW() ELSE NULL END,
            v_actor_id
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.lip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view lip_documents" ON public.lip_documents;
CREATE POLICY "Authenticated users can view lip_documents" ON public.lip_documents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
CREATE POLICY "Authenticated users can view invoices" ON public.invoices
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated users can view invoice_items" ON public.invoice_items
    FOR SELECT TO authenticated USING (true);

-- Write policies (Owner and Academic Admin can manage LIP)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

-- Write policies for invoices (Owner and Academic Admin can issue invoices)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can insert invoices" ON public.invoices
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can update invoices" ON public.invoices
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));


-- 8. SUPABASE STORAGE BUCKET SETUP (Private Bucket: lip-documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lip-documents', 'lip-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Objects RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view lip storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view lip storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'lip-documents');

DROP POLICY IF EXISTS "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can upload lip storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can update lip storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 5: Security Preflight, Student Payments, Allocations, Void & Receipts
-- ============================================================================

-- 1. PREFLIGHT SECURITY PATCH ON RPC FUNCTIONS (Enforcing auth.uid() requirement)
CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_study_program_id UUID,
    p_service_scheme_id UUID,
    p_credits INTEGER,
    p_notes TEXT,
    p_created_by UUID,
    p_fee_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_registration_with_snapshots: auth.uid() is required';
    END IF;

    v_reg_number := public.generate_registration_number();

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
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_registration_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. TRANSACTION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.transaction_number_seq');
    RETURN 'PAY-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 3. STUDENT PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.student_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_transaction_number(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON public.student_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.student_payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_txn ON public.student_payments (transaction_number);


-- 4. PAYMENT ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.student_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON public.payment_allocations (invoice_id);


-- 5. PAYMENT VOID REQUESTS TABLE (Owner Approval Workflow)
CREATE TABLE IF NOT EXISTS public.payment_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.student_payments(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_void_requests_payment ON public.payment_void_requests (payment_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_status ON public.payment_void_requests (status);


-- 6. INVOICE FINANCIAL LOCK TRIGGER
CREATE OR REPLACE FUNCTION public.check_invoice_locked_before_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_verified_count INTEGER;
    v_inv_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COUNT(*) INTO v_verified_count
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = v_inv_id
      AND sp.status = 'verified';

    IF v_verified_count > 0 THEN
        RAISE EXCEPTION 'Financial structure locked: Invoice has verified student payments and items cannot be modified';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_invoice_item_lock ON public.invoice_items;
CREATE TRIGGER trg_invoice_item_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_locked_before_item_mutation();


-- 7. ATOMIC STORED PROCEDURE FOR CREATING STUDENT PAYMENT + ALLOCATION
CREATE OR REPLACE FUNCTION public.create_payment_with_allocation(
    p_student_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_payment_method_id UUID,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_invoice_id UUID,
    p_allocated_amount BIGINT
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Validate invoice student relation & status
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'Target invoice not found';
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot allocate payment to a cancelled invoice';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student mismatch: Invoice does not belong to the selected student';
    END IF;

    IF p_allocated_amount > p_amount THEN
        RAISE EXCEPTION 'Allocated amount cannot exceed total payment amount';
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- Insert Payment Header
    INSERT INTO public.student_payments (
        transaction_number,
        student_id,
        paid_at,
        amount,
        payment_method_id,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        received_by,
        created_by,
        updated_by
    ) VALUES (
        v_txn_number,
        p_student_id,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_payment_method_id,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_payment_id;

    -- Insert Payment Allocation
    INSERT INTO public.payment_allocations (
        payment_id,
        invoice_id,
        amount,
        created_by
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        p_allocated_amount,
        v_actor_id
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. STORED PROCEDURE FOR PAYMENT VERIFICATION
CREATE OR REPLACE FUNCTION public.verify_student_payment(
    p_payment_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_verifier_id;
    END IF;

    -- Lock payment row for verification
    SELECT status INTO v_status
    FROM public.student_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending payments can be verified';
    END IF;

    UPDATE public.student_payments
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_payment_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 9. STORED PROCEDURE FOR OWNER APPROVAL OF VOID REQUEST
CREATE OR REPLACE FUNCTION public.approve_payment_void_request(
    p_void_request_id UUID,
    p_reviewer_id UUID,
    p_action VARCHAR, -- 'approve' or 'reject'
    p_review_notes TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_payment_id UUID;
    v_req_status VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_reviewer_id;
    END IF;

    SELECT payment_id, status INTO v_payment_id, v_req_status
    FROM public.payment_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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


-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_void_requests ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view student_payments" ON public.student_payments;
CREATE POLICY "Authenticated users can view student_payments" ON public.student_payments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view payment_allocations" ON public.payment_allocations;
CREATE POLICY "Authenticated users can view payment_allocations" ON public.payment_allocations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view payment_void_requests" ON public.payment_void_requests;
CREATE POLICY "Authenticated users can view payment_void_requests" ON public.payment_void_requests
    FOR SELECT TO authenticated USING (true);

-- Write policies (Owner and Academic Admin/Finance can insert/update payments)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert student_payments" ON public.student_payments;
CREATE POLICY "Owner/AcademicAdmin can insert student_payments" ON public.student_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update student_payments" ON public.student_payments;
CREATE POLICY "Owner/AcademicAdmin can update student_payments" ON public.student_payments
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_allocations" ON public.payment_allocations;
CREATE POLICY "Owner/AcademicAdmin can insert payment_allocations" ON public.payment_allocations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_void_requests" ON public.payment_void_requests;
CREATE POLICY "Owner/AcademicAdmin can insert payment_void_requests" ON public.payment_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner can update payment_void_requests" ON public.payment_void_requests;
CREATE POLICY "Owner can update payment_void_requests" ON public.payment_void_requests
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'owner');


-- 11. SUPABASE STORAGE BUCKET SETUP (Private Bucket: payment-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Objects RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view payment proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proof storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Owner/AcademicAdmin can upload payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can upload payment proof storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'academic_admin'));

DROP POLICY IF EXISTS "Owner/AcademicAdmin can update payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can update payment proof storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 6: Preflight Hardening, UT Remittances, Allocations, Void & Storage
-- ============================================================================

-- 1. HARDENING CHECKPOINT 5: Add idempotency_key to student_payments
ALTER TABLE public.student_payments 
ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE NULL;

-- Hardening RLS Policies for student_payments & payment_allocations (Academic Admin Read-Only)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert student_payments" ON public.student_payments;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update student_payments" ON public.student_payments;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert payment_void_requests" ON public.payment_void_requests;

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert student_payments" ON public.student_payments;
CREATE POLICY "Owner/FinanceAdmin can insert student_payments" ON public.student_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can update student_payments" ON public.student_payments;
CREATE POLICY "Owner/FinanceAdmin can update student_payments" ON public.student_payments
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert payment_allocations" ON public.payment_allocations;
CREATE POLICY "Owner/FinanceAdmin can insert payment_allocations" ON public.payment_allocations
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert payment_void_requests" ON public.payment_void_requests;
CREATE POLICY "Owner/FinanceAdmin can insert payment_void_requests" ON public.payment_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));


-- Update RPC create_payment_with_allocation with Idempotency & RBAC Fix
CREATE OR REPLACE FUNCTION public.create_payment_with_allocation(
    p_student_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_payment_method_id UUID,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_invoice_id UUID,
    p_allocated_amount BIGINT,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record student payments';
    END IF;

    -- Idempotency Check: Return existing payment ID if idempotency_key matches
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.student_payments
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate invoice student relation & status
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'Target invoice not found';
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot allocate payment to a cancelled invoice';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student mismatch: Invoice does not belong to the selected student';
    END IF;

    IF p_allocated_amount > p_amount THEN
        RAISE EXCEPTION 'Allocated amount cannot exceed total payment amount';
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- Insert Payment Header
    INSERT INTO public.student_payments (
        transaction_number,
        student_id,
        paid_at,
        amount,
        payment_method_id,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        received_by,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_txn_number,
        p_student_id,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_payment_method_id,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_payment_id;

    -- Insert Payment Allocation
    INSERT INTO public.payment_allocations (
        payment_id,
        invoice_id,
        amount,
        created_by
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        p_allocated_amount,
        v_actor_id
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. UT REMITTANCE SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.remittance_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_remittance_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.remittance_number_seq');
    RETURN 'UTR-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 3. UT REMITTANCES TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_remittance_number(),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key UUID UNIQUE NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    void_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_remittances_status ON public.ut_remittances (status);
CREATE INDEX IF NOT EXISTS idx_remittances_num ON public.ut_remittances (remittance_number);


-- 4. UT REMITTANCE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittance_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_id UUID NOT NULL REFERENCES public.ut_remittances(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_remittance_items_parent ON public.ut_remittance_items (remittance_id);
CREATE INDEX IF NOT EXISTS idx_remittance_items_lip ON public.ut_remittance_items (lip_document_id);


-- 5. UT REMITTANCE VOID REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.ut_remittance_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_id UUID NOT NULL REFERENCES public.ut_remittances(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remittance_void_parent ON public.ut_remittance_void_requests (remittance_id);


-- 6. ATOMIC STORED PROCEDURE FOR CREATING UT REMITTANCE WITH ITEMS
CREATE OR REPLACE FUNCTION public.create_ut_remittance_with_items(
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_remittance_id UUID;
    v_rem_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_item JSONB;
    v_sum_items BIGINT := 0;
    v_existing_id UUID;
    v_lip_status VARCHAR(20);
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_outstanding BIGINT;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record UT remittances';
    END IF;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.ut_remittances
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate Items array and SUM(items.amount) == p_amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := (v_item->>'lip_document_id')::UUID;
        v_reg_id := (v_item->>'registration_id')::UUID;

        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Item allocation amount must be greater than 0';
        END IF;

        -- Validate LIP document status & official amount
        SELECT status, official_amount INTO v_lip_status, v_lip_official
        FROM public.lip_documents
        WHERE id = v_lip_id AND registration_id = v_reg_id;

        IF v_lip_status IS NULL THEN
            RAISE EXCEPTION 'Target LIP document not found or registration mismatch';
        END IF;

        IF v_lip_status = 'cancelled' THEN
            RAISE EXCEPTION 'Cannot allocate remittance to a cancelled LIP document';
        END IF;

        -- Check current outstanding liability for LIP
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_lip_id
          AND r.status = 'verified';

        v_outstanding := v_lip_official - v_already_verified;

        IF v_item_amount > v_outstanding THEN
            RAISE EXCEPTION 'Over-remittance error: Allocation amount (Rp %) exceeds current outstanding UT liability (Rp %) for LIP',
                v_item_amount, v_outstanding;
        END IF;

        v_sum_items := v_sum_items + v_item_amount;
    END LOOP;

    IF v_sum_items <> p_amount THEN
        RAISE EXCEPTION 'Remittance total amount (Rp %) must exactly match sum of allocated items (Rp %)',
            p_amount, v_sum_items;
    END IF;

    v_rem_number := public.generate_remittance_number();

    -- Insert Remittance Header
    INSERT INTO public.ut_remittances (
        remittance_number,
        paid_at,
        amount,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        received_by,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_rem_number,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_remittance_id;

    -- Insert Remittance Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.ut_remittance_items (
            remittance_id,
            registration_id,
            lip_document_id,
            amount,
            created_by
        ) VALUES (
            v_remittance_id,
            (v_item->>'registration_id')::UUID,
            (v_item->>'lip_document_id')::UUID,
            (v_item->>'amount')::BIGINT,
            v_actor_id
        );
    END LOOP;

    RETURN v_remittance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 7. ATOMIC STORED PROCEDURE FOR VERIFYING UT REMITTANCE WITH ROW LOCKING
CREATE OR REPLACE FUNCTION public.verify_ut_remittance(
    p_remittance_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_new_verified_total BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_verifier_id;
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify UT remittances';
    END IF;

    -- Lock remittance header
    SELECT status INTO v_status
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'UT Remittance not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending remittances can be verified';
    END IF;

    -- Lock LIP records & re-verify concurrency over-remittance protection
    FOR v_item IN 
        SELECT ri.lip_document_id, ri.amount 
        FROM public.ut_remittance_items ri 
        WHERE ri.remittance_id = p_remittance_id
    LOOP
        -- Lock target LIP row
        SELECT official_amount INTO v_lip_official
        FROM public.lip_documents
        WHERE id = v_item.lip_document_id
        FOR UPDATE;

        -- Re-calculate verified UT paid within transaction
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_item.lip_document_id
          AND r.status = 'verified'
          AND r.id <> p_remittance_id;

        v_new_verified_total := v_already_verified + v_item.amount;

        IF v_new_verified_total > v_lip_official THEN
            RAISE EXCEPTION 'Over-remittance protection: Concurrent verification caused total setoran (Rp %) to exceed LIP official amount (Rp %)',
                v_new_verified_total, v_lip_official;
        END IF;

        -- Update LIP status to paid_to_ut if fully paid to UT
        IF v_new_verified_total >= v_lip_official THEN
            UPDATE public.lip_documents
            SET status = 'paid_to_ut',
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_item.lip_document_id;
        END IF;
    END LOOP;

    -- Update Remittance Header
    UPDATE public.ut_remittances
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. ATOMIC STORED PROCEDURE FOR OWNER APPROVAL OF REMITTANCE VOID
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
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_reviewer_id;
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve UT remittance void requests';
    END IF;

    SELECT remittance_id, status INTO v_remittance_id, v_req_status
    FROM public.ut_remittance_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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

            IF v_already_verified < v_lip_official THEN
                UPDATE public.lip_documents
                SET status = 'verified',
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_item.lip_document_id AND status = 'paid_to_ut';
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


-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.ut_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_remittance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_remittance_void_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ut_remittances" ON public.ut_remittances;
CREATE POLICY "Authenticated users can view ut_remittances" ON public.ut_remittances
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view ut_remittance_items" ON public.ut_remittance_items;
CREATE POLICY "Authenticated users can view ut_remittance_items" ON public.ut_remittance_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view ut_remittance_void_requests" ON public.ut_remittance_void_requests;
CREATE POLICY "Authenticated users can view ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert ut_remittances" ON public.ut_remittances;
CREATE POLICY "Owner/FinanceAdmin can insert ut_remittances" ON public.ut_remittances
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can update ut_remittances" ON public.ut_remittances;
CREATE POLICY "Owner/FinanceAdmin can update ut_remittances" ON public.ut_remittances
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert ut_remittance_items" ON public.ut_remittance_items;
CREATE POLICY "Owner/FinanceAdmin can insert ut_remittance_items" ON public.ut_remittance_items
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert ut_remittance_void_requests" ON public.ut_remittance_void_requests;
CREATE POLICY "Owner/FinanceAdmin can insert ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner can update ut_remittance_void_requests" ON public.ut_remittance_void_requests;
CREATE POLICY "Owner can update ut_remittance_void_requests" ON public.ut_remittance_void_requests
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'owner');


-- 10. SUPABASE PRIVATE STORAGE BUCKET (ut-remittance-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ut-remittance-proofs', 'ut-remittance-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view ut remittance proof storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ut-remittance-proofs');

DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload ut remittance proof storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can update ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update ut remittance proof storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Checkpoint 7A: Preflight Hardening, Operational Transactions, Categories & Void
-- ============================================================================

-- 1. PREFLIGHT HARDENING A: Require Non-Null Idempotency Key in Payment & Remittance RPCs
CREATE OR REPLACE FUNCTION public.create_payment_with_allocation(
    p_student_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_payment_method_id UUID,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_invoice_id UUID,
    p_allocated_amount BIGINT,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record student payments';
    END IF;

    -- Non-Null Idempotency Key Requirement
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required for transaction creation';
    END IF;

    -- Idempotency Check: Return existing payment ID if idempotency_key matches
    SELECT id INTO v_existing_id
    FROM public.student_payments
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    -- Validate invoice student relation & status
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'Target invoice not found';
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot allocate payment to a cancelled invoice';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student mismatch: Invoice does not belong to the selected student';
    END IF;

    IF p_allocated_amount > p_amount THEN
        RAISE EXCEPTION 'Allocated amount cannot exceed total payment amount';
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- Insert Payment Header
    INSERT INTO public.student_payments (
        transaction_number,
        student_id,
        paid_at,
        amount,
        payment_method_id,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        received_by,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_txn_number,
        p_student_id,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_payment_method_id,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_payment_id;

    -- Insert Payment Allocation
    INSERT INTO public.payment_allocations (
        payment_id,
        invoice_id,
        amount,
        created_by
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        p_allocated_amount,
        v_actor_id
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. PREFLIGHT HARDENING B: LIP paid_to_ut Status Consistency Trigger
CREATE OR REPLACE FUNCTION public.check_lip_status_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_already_verified BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    IF NEW.status = 'paid_to_ut' AND (OLD.status IS NULL OR OLD.status <> 'paid_to_ut') THEN
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = NEW.id
          AND r.status = 'verified';

        IF v_already_verified < NEW.official_amount THEN
            RAISE EXCEPTION 'Consistency error: Cannot manually set LIP status to paid_to_ut without sufficient verified UT remittances (Paid: Rp %, Official: Rp %)',
                v_already_verified, NEW.official_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_lip_status_consistency ON public.lip_documents;
CREATE TRIGGER trg_lip_status_consistency
BEFORE UPDATE ON public.lip_documents
FOR EACH ROW EXECUTE FUNCTION public.check_lip_status_consistency();


-- 3. OPERATIONAL CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.operational_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NULL,
    name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Ensure column name is transaction_type if created by earlier schema draft
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'operational_categories' 
          AND column_name = 'type'
    ) THEN
        ALTER TABLE public.operational_categories RENAME COLUMN type TO transaction_type;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ops_categories_type ON public.operational_categories (transaction_type);

-- Seed Default Master Categories safely
INSERT INTO public.operational_categories (code, name, transaction_type, is_active)
VALUES
    ('INC-GEN', 'Pemasukan Non-Mahasiswa / Hibah', 'income', true),
    ('INC-SRV', 'Pemasukan Jasa Layanan Lain', 'income', true),
    ('EXP-OFF', 'Beban Operasional Kantor / ATK', 'expense', true),
    ('EXP-UTL', 'Beban Listrik, Air & Internet', 'expense', true),
    ('EXP-RENT', 'Beban Sewa Tempat / Gedung', 'expense', true),
    ('EXP-SAL', 'Beban Gaji & Honor Petugas', 'expense', true)
ON CONFLICT DO NOTHING;


-- 4. OPERATIONAL TRANSACTION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.ops_transaction_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_ops_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.ops_transaction_number_seq');
    RETURN 'OPS-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- 5. OPERATIONAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_ops_transaction_number(),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    category_id UUID NOT NULL REFERENCES public.operational_categories(id) ON DELETE RESTRICT,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    idempotency_key UUID UNIQUE NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    void_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_txns_type ON public.operational_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_ops_txns_status ON public.operational_transactions (status);
CREATE INDEX IF NOT EXISTS idx_ops_txns_num ON public.operational_transactions (transaction_number);


-- 6. OPERATIONAL TRANSACTION VOID REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transaction_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operational_transaction_id UUID NOT NULL REFERENCES public.operational_transactions(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_void_parent ON public.operational_transaction_void_requests (operational_transaction_id);


-- 7. ATOMIC STORED PROCEDURE FOR CREATING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.create_operational_transaction(
    p_transaction_type VARCHAR,
    p_category_id UUID,
    p_cash_account_id UUID,
    p_transaction_date TIMESTAMPTZ,
    p_amount BIGINT,
    p_description TEXT,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_ops_id UUID;
    v_ops_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_cat_type VARCHAR(20);
    v_cat_active BOOLEAN;
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_created_by;
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_operational_transaction';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record operational transactions';
    END IF;

    -- Non-Null Idempotency Key Requirement
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required for transaction creation';
    END IF;

    -- Idempotency check
    SELECT id INTO v_existing_id
    FROM public.operational_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Operational transaction amount must be greater than 0';
    END IF;

    IF p_transaction_type NOT IN ('income', 'expense') THEN
        RAISE EXCEPTION 'Invalid transaction_type: must be income or expense';
    END IF;

    -- Validate Category matching & active status
    SELECT transaction_type, is_active INTO v_cat_type, v_cat_active
    FROM public.operational_categories
    WHERE id = p_category_id;

    IF v_cat_type IS NULL THEN
        RAISE EXCEPTION 'Target operational category not found';
    END IF;

    IF NOT v_cat_active THEN
        RAISE EXCEPTION 'Cannot use an inactive operational category for new transactions';
    END IF;

    IF v_cat_type <> p_transaction_type THEN
        RAISE EXCEPTION 'Category transaction type mismatch: Category % cannot be used for % transaction',
            v_cat_type, p_transaction_type;
    END IF;

    v_ops_number := public.generate_ops_transaction_number();

    INSERT INTO public.operational_transactions (
        transaction_number,
        transaction_type,
        category_id,
        cash_account_id,
        transaction_date,
        amount,
        description,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_ops_number,
        p_transaction_type,
        p_category_id,
        p_cash_account_id,
        COALESCE(p_transaction_date, NOW()),
        p_amount,
        p_description,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_ops_id;

    RETURN v_ops_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. STORED PROCEDURE FOR VERIFYING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.verify_operational_transaction(
    p_transaction_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_verifier_id;
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify operational transactions';
    END IF;

    SELECT status INTO v_status
    FROM public.operational_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Operational transaction not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending operational transactions can be verified';
    END IF;

    UPDATE public.operational_transactions
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_transaction_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 9. STORED PROCEDURE FOR OWNER APPROVAL OF OPERATIONAL VOID REQUEST
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
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := p_reviewer_id;
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve operational void requests';
    END IF;

    SELECT operational_transaction_id, status INTO v_ops_id, v_req_status
    FROM public.operational_transaction_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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


-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.operational_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_transaction_void_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view operational_categories" ON public.operational_categories;
CREATE POLICY "Authenticated users can view operational_categories" ON public.operational_categories
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view operational_transactions" ON public.operational_transactions;
CREATE POLICY "Authenticated users can view operational_transactions" ON public.operational_transactions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view operational_transaction_void_requests" ON public.operational_transaction_void_requests;
CREATE POLICY "Authenticated users can view operational_transaction_void_requests" ON public.operational_transaction_void_requests
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert operational_categories" ON public.operational_categories;
CREATE POLICY "Owner/FinanceAdmin can insert operational_categories" ON public.operational_categories
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert operational_transactions" ON public.operational_transactions;
CREATE POLICY "Owner/FinanceAdmin can insert operational_transactions" ON public.operational_transactions
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can update operational_transactions" ON public.operational_transactions;
CREATE POLICY "Owner/FinanceAdmin can update operational_transactions" ON public.operational_transactions
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can insert operational_transaction_void_requests" ON public.operational_transaction_void_requests;
CREATE POLICY "Owner/FinanceAdmin can insert operational_transaction_void_requests" ON public.operational_transaction_void_requests
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner can update operational_transaction_void_requests" ON public.operational_transaction_void_requests;
CREATE POLICY "Owner can update operational_transaction_void_requests" ON public.operational_transaction_void_requests
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'owner');


-- 11. SUPABASE PRIVATE STORAGE BUCKET (operational-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operational-proofs', 'operational-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view operational proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view operational proof storage objects"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'operational-proofs');

DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload operational proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload operational proof storage objects"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));

DROP POLICY IF EXISTS "Owner/FinanceAdmin can update operational proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update operational proof storage objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
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
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 1: Master Data, Students & Status History
-- ============================================================================

-- 1. MASTER ACADEMIC PERIODS
CREATE TABLE IF NOT EXISTS public.academic_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    term VARCHAR(20) NULL,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. MASTER FACULTIES
CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. MASTER STUDY LEVELS
CREATE TABLE IF NOT EXISTS public.study_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. MASTER STUDY PROGRAMS (Connected to Faculty & Study Level)
CREATE TABLE IF NOT EXISTS public.study_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT,
    study_level_id UUID NOT NULL REFERENCES public.study_levels(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. MASTER SERVICE SCHEMES (SIPAS, Non-SIPAS, Non-TTM, TTM, Semi, Full, Plus)
CREATE TABLE IF NOT EXISTS public.service_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- SIPAS vs Non-SIPAS
    description TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. MASTER STUDENT STATUSES (calon, aktif, cuti, nonaktif, DO, lulus)
CREATE TABLE IF NOT EXISTS public.student_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nim VARCHAR(30) NULL,
    nik VARCHAR(30) NULL,
    full_name VARCHAR(255) NOT NULL,
    birth_place VARCHAR(100) NULL,
    birth_date DATE NULL,
    gender VARCHAR(20) NULL CHECK (gender IN ('L', 'P')),
    whatsapp VARCHAR(30) NULL,
    email VARCHAR(255) NULL,
    address TEXT NULL,
    city VARCHAR(100) NULL,
    entry_year INTEGER NULL CHECK (entry_year >= 1990 AND entry_year <= 2100),
    faculty_id UUID REFERENCES public.faculties(id) ON DELETE RESTRICT,
    study_level_id UUID REFERENCES public.study_levels(id) ON DELETE RESTRICT,
    study_program_id UUID REFERENCES public.study_programs(id) ON DELETE RESTRICT,
    service_scheme_id UUID REFERENCES public.service_schemes(id) ON DELETE RESTRICT,
    status_id UUID NOT NULL REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    status_effective_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    internal_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Unique Partial Indexes for NIM and NIK (NULL allowed, unique when filled)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nim_unique ON public.students (nim) WHERE nim IS NOT NULL AND nim <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nik_unique ON public.students (nik) WHERE nik IS NOT NULL AND nik <> '';

-- Search & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students (full_name);
CREATE INDEX IF NOT EXISTS idx_students_whatsapp ON public.students (whatsapp);
CREATE INDEX IF NOT EXISTS idx_students_faculty ON public.students (faculty_id);
CREATE INDEX IF NOT EXISTS idx_students_program ON public.students (study_program_id);
CREATE INDEX IF NOT EXISTS idx_students_year ON public.students (entry_year);
CREATE INDEX IF NOT EXISTS idx_students_scheme ON public.students (service_scheme_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status_id);

-- 8. STUDENT STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.student_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    previous_status_id UUID REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    new_status_id UUID NOT NULL REFERENCES public.student_statuses(id) ON DELETE RESTRICT,
    effective_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_student ON public.student_status_history (student_id);

-- 9. ATOMIC STATUS CHANGE PROCEDURE
CREATE OR REPLACE FUNCTION public.change_student_status(
    p_student_id UUID,
    p_new_status_id UUID,
    p_effective_at TIMESTAMPTZ,
    p_reason TEXT,
    p_changed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status_id UUID;
BEGIN
    SELECT status_id INTO v_old_status_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_old_status_id IS NULL THEN
        RAISE EXCEPTION 'Student with ID % not found', p_student_id;
    END IF;

    IF v_old_status_id = p_new_status_id THEN
        RETURN TRUE;
    END IF;

    UPDATE public.students
    SET 
        status_id = p_new_status_id,
        status_effective_at = COALESCE(p_effective_at, NOW()),
        updated_at = NOW(),
        updated_by = p_changed_by
    WHERE id = p_student_id;

    INSERT INTO public.student_status_history (
        student_id,
        previous_status_id,
        new_status_id,
        effective_at,
        reason,
        changed_by
    ) VALUES (
        p_student_id,
        v_old_status_id,
        p_new_status_id,
        COALESCE(p_effective_at, NOW()),
        p_reason,
        p_changed_by
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

-- Master data READ for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read master data" ON public.academic_periods;
CREATE POLICY "Authenticated users can read master data" ON public.academic_periods FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read faculties" ON public.faculties;
DROP POLICY IF EXISTS "Authenticated users can manage faculties" ON public.faculties;
CREATE POLICY "Authenticated users can manage faculties" ON public.faculties FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read study levels" ON public.study_levels;
CREATE POLICY "Authenticated users can read study levels" ON public.study_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read study programs" ON public.study_programs;
CREATE POLICY "Authenticated users can read study programs" ON public.study_programs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read service schemes" ON public.service_schemes;
CREATE POLICY "Authenticated users can read service schemes" ON public.service_schemes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read student statuses" ON public.student_statuses;
CREATE POLICY "Authenticated users can read student statuses" ON public.student_statuses FOR SELECT TO authenticated USING (true);

-- Master data WRITE for Owner & Academic Admin
DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage academic_periods" ON public.academic_periods;
CREATE POLICY "Owner/AcademicAdmin can manage academic_periods" ON public.academic_periods FOR ALL TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can manage study_programs" ON public.study_programs;
CREATE POLICY "Owner/AcademicAdmin can manage study_programs" ON public.study_programs FOR ALL TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

-- Students READ for all authenticated users (Owner, Academic Admin, Finance Admin, Viewer)
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
CREATE POLICY "Authenticated users can view students" ON public.students FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.student_status_history;
CREATE POLICY "Authenticated users can view status history" ON public.student_status_history FOR SELECT TO authenticated USING (true);

-- Students WRITE for Owner & Academic Admin ONLY (Finance Admin and Viewer DENIED)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert students" ON public.students;
CREATE POLICY "Owner/AcademicAdmin can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update students" ON public.students;
CREATE POLICY "Owner/AcademicAdmin can update students" ON public.students FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert status history" ON public.student_status_history;
CREATE POLICY "Owner/AcademicAdmin can insert status history" ON public.student_status_history FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 2: Registrations, Context Snapshots & Tariff Snapshots
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
    p_fee_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_item JSONB;
BEGIN
    v_reg_number := public.generate_registration_number();

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
CREATE POLICY "Authenticated users can view registration_types" ON public.registration_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view registrations" ON public.registrations;
CREATE POLICY "Authenticated users can view registrations" ON public.registrations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Authenticated users can view registration_fee_snapshots" ON public.registration_fee_snapshots FOR SELECT TO authenticated USING (true);

-- Write policies (Only Owner and Academic Admin can create/update/cancel registrations)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert registrations" ON public.registrations;
CREATE POLICY "Owner/AcademicAdmin can insert registrations" ON public.registrations FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update registrations" ON public.registrations;
CREATE POLICY "Owner/AcademicAdmin can update registrations" ON public.registrations FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Owner/AcademicAdmin can insert registration_fee_snapshots" ON public.registration_fee_snapshots FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update registration_fee_snapshots" ON public.registration_fee_snapshots;
CREATE POLICY "Owner/AcademicAdmin can update registration_fee_snapshots" ON public.registration_fee_snapshots FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 3: LIP Documents, Invoices, Items & Private Storage
-- ============================================================================

-- 1. LIP DOCUMENTS TABLE (Official UT Financial Liability Document)
CREATE TABLE IF NOT EXISTS public.lip_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_number VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL CHECK (version >= 1),
    official_amount BIGINT NOT NULL CHECK (official_amount >= 0),
    tuition_amount BIGINT DEFAULT 0 NOT NULL CHECK (tuition_amount >= 0),
    book_amount BIGINT DEFAULT 0 NOT NULL CHECK (book_amount >= 0),
    shipping_amount BIGINT DEFAULT 0 NOT NULL CHECK (shipping_amount >= 0),
    other_ut_amount BIGINT DEFAULT 0 NOT NULL CHECK (other_ut_amount >= 0),
    issued_at DATE NULL,
    due_at DATE NULL,
    storage_path TEXT NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'cancelled')),
    notes TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE(registration_id, version)
);

-- Partial Unique Index: Max 1 active verified LIP per registration
CREATE UNIQUE INDEX IF NOT EXISTS idx_lip_unique_verified_per_reg
ON public.lip_documents (registration_id)
WHERE status = 'verified';

CREATE INDEX IF NOT EXISTS idx_lip_registration ON public.lip_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_lip_status ON public.lip_documents (status);
CREATE INDEX IF NOT EXISTS idx_lip_number ON public.lip_documents (lip_number);

-- 2. INVOICE NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.invoice_number_seq');
    RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. INVOICES TABLE (Internal Student Bill Header)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_invoice_number(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    issued_at DATE DEFAULT CURRENT_DATE NOT NULL,
    due_at DATE NULL,
    status VARCHAR(20) DEFAULT 'unpaid' NOT NULL CHECK (status IN ('draft', 'unpaid', 'cancelled', 'partial', 'paid', 'overdue')),
    notes TEXT NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Partial Unique Index: Max 1 active invoice per verified LIP
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_active_per_lip
ON public.invoices (lip_document_id)
WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_invoices_registration ON public.invoices (registration_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lip ON public.invoices (lip_document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- 4. INVOICE ITEMS TABLE (Auditable Itemized Billing Details)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('ut_liability', 'service_fee', 'internal_fee', 'discount')),
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_amount BIGINT NOT NULL CHECK (unit_amount >= 0),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    source_type VARCHAR(30) DEFAULT 'manual' NOT NULL,
    source_id UUID NULL,
    approval_status VARCHAR(20) NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_reason TEXT NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON public.invoice_items (item_type);

-- 5. ATOMIC STORED PROCEDURE FOR INVOICE CREATION WITH ITEMS
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    p_registration_id UUID,
    p_lip_document_id UUID,
    p_due_at DATE,
    p_notes TEXT,
    p_created_by UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_inv_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
    v_lip_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_invoice_with_items';
    END IF;

    -- Verify that LIP document status is 'verified'
    SELECT status INTO v_lip_status FROM public.lip_documents WHERE id = p_lip_document_id;
    IF v_lip_status IS NULL OR v_lip_status <> 'verified' THEN
        RAISE EXCEPTION 'Invoice can only be issued for verified LIP documents';
    END IF;

    -- Generate Invoice Number
    v_inv_number := public.generate_invoice_number();

    -- Insert Invoice Header
    INSERT INTO public.invoices (
        invoice_number,
        registration_id,
        lip_document_id,
        due_at,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_inv_number,
        p_registration_id,
        p_lip_document_id,
        p_due_at,
        'unpaid',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_invoice_id;

    -- Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            fee_type_id,
            description,
            quantity,
            unit_amount,
            amount,
            source_type,
            source_id,
            approval_status,
            approval_reason,
            approved_by,
            approved_at,
            created_by
        ) VALUES (
            v_invoice_id,
            (v_item->>'item_type')::VARCHAR,
            (v_item->>'fee_type_id')::UUID,
            (v_item->>'description')::VARCHAR,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_amount')::BIGINT,
            (v_item->>'quantity')::INTEGER * (v_item->>'unit_amount')::BIGINT,
            COALESCE(v_item->>'source_type', 'manual'),
            (v_item->>'source_id')::UUID,
            v_item->>'approval_status',
            v_item->>'approval_reason',
            (v_item->>'approved_by')::UUID,
            CASE WHEN v_item->>'approval_status' = 'approved' THEN NOW() ELSE NULL END,
            v_actor_id
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.lip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view lip_documents" ON public.lip_documents;
CREATE POLICY "Authenticated users can view lip_documents" ON public.lip_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated users can view invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);

-- Write policies (Owner and Academic Admin can manage LIP and issue Invoices)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

-- 7. PRIVATE STORAGE BUCKET SETUP (lip-documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lip-documents', 'lip-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view lip storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view lip storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lip-documents');
DROP POLICY IF EXISTS "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can update lip storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 4: Student Payments, Allocations, Idempotency & Void Requests
-- ============================================================================

-- 1. ENSURE IDEMPOTENCY KEY COLUMN ON STUDENT PAYMENTS
ALTER TABLE public.student_payments
ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_payments_idempotency
ON public.student_payments (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. ENSURE VOID AUDIT COLUMNS ON STUDENT PAYMENTS
ALTER TABLE public.student_payments
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

-- 3. INVOICE FINANCIAL LOCK TRIGGER (Prevents item mutations after verified payments)
CREATE OR REPLACE FUNCTION public.check_invoice_locked_before_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_verified_count INTEGER;
    v_inv_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COUNT(*) INTO v_verified_count
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = v_inv_id
      AND sp.status = 'verified';

    IF v_verified_count > 0 THEN
        RAISE EXCEPTION 'Financial structure locked: Invoice has verified student payments and items cannot be modified';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_invoice_item_lock ON public.invoice_items;
CREATE TRIGGER trg_invoice_item_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_locked_before_item_mutation();

-- 4. IDEMPOTENT & ATOMIC STORED PROCEDURE FOR CREATING STUDENT PAYMENT WITH ALLOCATION
CREATE OR REPLACE FUNCTION public.create_payment_with_allocation(
    p_student_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_payment_method_id UUID,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_invoice_id UUID,
    p_allocated_amount BIGINT,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_txn_number VARCHAR(50);
    v_actor_id UUID;
    v_inv_student_id UUID;
    v_inv_status VARCHAR(20);
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_payment_with_allocation';
    END IF;

    -- Idempotency check: if idempotency key exists, return existing payment ID
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.student_payments
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate target invoice status and student ownership
    SELECT i.status, r.student_id INTO v_inv_status, v_inv_student_id
    FROM public.invoices i
    JOIN public.registrations r ON i.registration_id = r.id
    WHERE i.id = p_invoice_id;

    IF v_inv_status IS NULL THEN
        RAISE EXCEPTION 'Target invoice not found';
    END IF;

    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot allocate payment to a cancelled invoice';
    END IF;

    IF v_inv_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student mismatch: Invoice does not belong to the selected student';
    END IF;

    IF p_allocated_amount > p_amount THEN
        RAISE EXCEPTION 'Allocated amount cannot exceed total payment amount';
    END IF;

    v_txn_number := public.generate_transaction_number();

    -- Insert Payment Header
    INSERT INTO public.student_payments (
        transaction_number,
        student_id,
        paid_at,
        amount,
        payment_method_id,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        idempotency_key,
        received_by,
        created_by,
        updated_by
    ) VALUES (
        v_txn_number,
        p_student_id,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_payment_method_id,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        p_idempotency_key,
        v_actor_id,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_payment_id;

    -- Insert Payment Allocation
    INSERT INTO public.payment_allocations (
        payment_id,
        invoice_id,
        amount,
        created_by
    ) VALUES (
        v_payment_id,
        p_invoice_id,
        p_allocated_amount,
        v_actor_id
    );

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. STORED PROCEDURE FOR OWNER APPROVAL OF VOID REQUEST
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
    v_req_status VARCHAR(20);
    v_void_reason TEXT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_payment_void_request';
    END IF;

    SELECT payment_id, status, reason INTO v_payment_id, v_req_status, v_void_reason
    FROM public.payment_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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

-- 6. PRIVATE STORAGE BUCKET SETUP FOR PAYMENT PROOFS
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view payment proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs');
DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload payment proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
DROP POLICY IF EXISTS "Owner/FinanceAdmin can update payment proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update payment proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 5: UT Remittances, Multi-LIP Allocation, Concurrency & Void
-- ============================================================================

-- 1. ENSURE IDEMPOTENCY KEY COLUMN ON UT REMITTANCES
ALTER TABLE public.ut_remittances
ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ut_remittances_idempotency
ON public.ut_remittances (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. ENSURE VOID AUDIT COLUMNS ON UT REMITTANCES
ALTER TABLE public.ut_remittances
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

-- 3. ATOMIC STORED PROCEDURE FOR CREATING UT REMITTANCE WITH MULTI-LIP ITEMS
CREATE OR REPLACE FUNCTION public.create_ut_remittance_with_items(
    p_paid_at TIMESTAMPTZ,
    p_amount BIGINT,
    p_cash_account_id UUID,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_remittance_id UUID;
    v_rem_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_item JSONB;
    v_sum_items BIGINT := 0;
    v_existing_id UUID;
    v_lip_status VARCHAR(30);
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_outstanding BIGINT;
    v_item_amount BIGINT;
    v_lip_id UUID;
    v_reg_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_ut_remittance_with_items';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record UT remittances';
    END IF;

    -- Idempotency Check: Return existing remittance ID if idempotency_key matches
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.ut_remittances
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    -- Validate Items array and SUM(items.amount) == p_amount
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_amount := (v_item->>'amount')::BIGINT;
        v_lip_id := (v_item->>'lip_document_id')::UUID;
        v_reg_id := (v_item->>'registration_id')::UUID;

        IF v_item_amount <= 0 THEN
            RAISE EXCEPTION 'Item allocation amount must be greater than 0';
        END IF;

        -- Validate LIP document status & official amount
        SELECT status, official_amount INTO v_lip_status, v_lip_official
        FROM public.lip_documents
        WHERE id = v_lip_id AND registration_id = v_reg_id;

        IF v_lip_status IS NULL THEN
            RAISE EXCEPTION 'Target LIP document not found or registration mismatch';
        END IF;

        IF v_lip_status = 'cancelled' THEN
            RAISE EXCEPTION 'Cannot allocate remittance to a cancelled LIP document';
        END IF;

        -- Check current outstanding liability for LIP
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_lip_id
          AND r.status = 'verified';

        v_outstanding := v_lip_official - v_already_verified;

        IF v_item_amount > v_outstanding THEN
            RAISE EXCEPTION 'Over-remittance error: Allocation amount (Rp %) exceeds current outstanding UT liability (Rp %) for LIP',
                v_item_amount, v_outstanding;
        END IF;

        v_sum_items := v_sum_items + v_item_amount;
    END LOOP;

    IF v_sum_items <> p_amount THEN
        RAISE EXCEPTION 'Remittance total amount (Rp %) must exactly match sum of allocated items (Rp %)',
            p_amount, v_sum_items;
    END IF;

    v_rem_number := public.generate_transaction_number();
    -- Replace prefix to UTR- if default returned PAY-
    IF v_rem_number LIKE 'PAY-%' THEN
        v_rem_number := 'UTR-' || SUBSTRING(v_rem_number FROM 5);
    END IF;

    -- Insert Remittance Header
    INSERT INTO public.ut_remittances (
        remittance_number,
        paid_at,
        amount,
        cash_account_id,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        received_by,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_rem_number,
        COALESCE(p_paid_at, NOW()),
        p_amount,
        p_cash_account_id,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        v_actor_id,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_remittance_id;

    -- Insert Remittance Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.ut_remittance_items (
            remittance_id,
            registration_id,
            lip_document_id,
            amount,
            created_by
        ) VALUES (
            v_remittance_id,
            (v_item->>'registration_id')::UUID,
            (v_item->>'lip_document_id')::UUID,
            (v_item->>'amount')::BIGINT,
            v_actor_id
        );
    END LOOP;

    RETURN v_remittance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. ATOMIC STORED PROCEDURE FOR VERIFYING UT REMITTANCE WITH ROW LOCKING & CONCURRENCY PROTECTION
CREATE OR REPLACE FUNCTION public.verify_ut_remittance(
    p_remittance_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
    v_new_verified_total BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_ut_remittance';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify UT remittances';
    END IF;

    -- Lock remittance header
    SELECT status INTO v_status
    FROM public.ut_remittances
    WHERE id = p_remittance_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'UT Remittance not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending remittances can be verified';
    END IF;

    -- Lock LIP records & re-verify concurrency over-remittance protection
    FOR v_item IN 
        SELECT ri.lip_document_id, ri.amount 
        FROM public.ut_remittance_items ri 
        WHERE ri.remittance_id = p_remittance_id
    LOOP
        -- Lock target LIP row
        SELECT official_amount INTO v_lip_official
        FROM public.lip_documents
        WHERE id = v_item.lip_document_id
        FOR UPDATE;

        -- Re-calculate verified UT paid within transaction
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = v_item.lip_document_id
          AND r.status = 'verified'
          AND r.id <> p_remittance_id;

        v_new_verified_total := v_already_verified + v_item.amount;

        IF v_new_verified_total > v_lip_official THEN
            RAISE EXCEPTION 'Over-remittance protection: Concurrent verification caused total setoran (Rp %) to exceed LIP official amount (Rp %)',
                v_new_verified_total, v_lip_official;
        END IF;

        -- Update LIP status to paid_to_ut if fully paid to UT
        IF v_new_verified_total >= v_lip_official THEN
            UPDATE public.lip_documents
            SET status = 'paid_to_ut',
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_item.lip_document_id;
        END IF;
    END LOOP;

    -- Update Remittance Header
    UPDATE public.ut_remittances
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_remittance_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. ATOMIC STORED PROCEDURE FOR OWNER APPROVAL OF REMITTANCE VOID
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
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
    v_item RECORD;
    v_lip_official BIGINT;
    v_already_verified BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_ut_remittance_void_request';
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve UT remittance void requests';
    END IF;

    SELECT remittance_id, status INTO v_remittance_id, v_req_status
    FROM public.ut_remittance_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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

            IF v_already_verified < v_lip_official THEN
                UPDATE public.lip_documents
                SET status = 'verified',
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_item.lip_document_id AND status = 'paid_to_ut';
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

-- 6. PRIVATE STORAGE BUCKET (ut-remittance-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ut-remittance-proofs', 'ut-remittance-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view ut remittance proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ut-remittance-proofs');
DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload ut remittance proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
DROP POLICY IF EXISTS "Owner/FinanceAdmin can update ut remittance proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update ut remittance proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ut-remittance-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 6: Operational Cash Transactions, Master Categories & Void Workflow
-- ============================================================================

-- 1. OPERATIONAL CATEGORIES TABLE & DEFAULT MASTER SEED
CREATE TABLE IF NOT EXISTS public.operational_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NULL,
    name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Ensure column name is transaction_type if created by earlier schema draft
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'operational_categories' 
          AND column_name = 'type'
    ) THEN
        ALTER TABLE public.operational_categories RENAME COLUMN type TO transaction_type;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ops_categories_type ON public.operational_categories (transaction_type);

-- Seed Default Master Categories safely
INSERT INTO public.operational_categories (code, name, transaction_type, is_active)
VALUES
    ('INC-GEN', 'Pemasukan Non-Mahasiswa / Hibah', 'income', true),
    ('INC-SRV', 'Pemasukan Jasa Layanan Lain', 'income', true),
    ('EXP-OFF', 'Beban Operasional Kantor / ATK', 'expense', true),
    ('EXP-UTL', 'Beban Listrik, Air & Internet', 'expense', true),
    ('EXP-RENT', 'Beban Sewa Tempat / Gedung', 'expense', true),
    ('EXP-SAL', 'Beban Gaji & Honor Petugas', 'expense', true)
ON CONFLICT DO NOTHING;

-- 2. OPERATIONAL TRANSACTION NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.ops_transaction_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_ops_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.ops_transaction_number_seq');
    RETURN 'OPS-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. OPERATIONAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_ops_transaction_number(),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    category_id UUID NOT NULL REFERENCES public.operational_categories(id) ON DELETE RESTRICT,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    reference_number VARCHAR(100) NULL,
    proof_storage_path TEXT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT NULL,
    status VARCHAR(30) DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'rejected', 'voided')),
    notes TEXT NULL,
    idempotency_key UUID UNIQUE NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ NULL,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    void_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_txns_type ON public.operational_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_ops_txns_status ON public.operational_transactions (status);
CREATE INDEX IF NOT EXISTS idx_ops_txns_num ON public.operational_transactions (transaction_number);

-- 4. OPERATIONAL TRANSACTION VOID REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.operational_transaction_void_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operational_transaction_id UUID NOT NULL REFERENCES public.operational_transactions(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_void_parent ON public.operational_transaction_void_requests (operational_transaction_id);

-- 5. ATOMIC STORED PROCEDURE FOR CREATING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.create_operational_transaction(
    p_transaction_type VARCHAR,
    p_category_id UUID,
    p_cash_account_id UUID,
    p_transaction_date TIMESTAMPTZ,
    p_amount BIGINT,
    p_description TEXT,
    p_reference_number VARCHAR,
    p_proof_storage_path TEXT,
    p_original_file_name VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_notes TEXT,
    p_created_by UUID,
    p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
    v_ops_id UUID;
    v_ops_number VARCHAR(50);
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_cat_type VARCHAR(20);
    v_cat_active BOOLEAN;
    v_existing_id UUID;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_operational_transaction';
    END IF;

    -- Strict RBAC check (Owner and Finance Admin ONLY)
    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can record operational transactions';
    END IF;

    -- Non-Null Idempotency Key Requirement
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required for transaction creation';
    END IF;

    -- Idempotency check
    SELECT id INTO v_existing_id
    FROM public.operational_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Operational transaction amount must be greater than 0';
    END IF;

    IF p_transaction_type NOT IN ('income', 'expense') THEN
        RAISE EXCEPTION 'Invalid transaction_type: must be income or expense';
    END IF;

    -- Validate Category matching & active status
    SELECT transaction_type, is_active INTO v_cat_type, v_cat_active
    FROM public.operational_categories
    WHERE id = p_category_id;

    IF v_cat_type IS NULL THEN
        RAISE EXCEPTION 'Target operational category not found';
    END IF;

    IF NOT v_cat_active THEN
        RAISE EXCEPTION 'Cannot use an inactive operational category for new transactions';
    END IF;

    IF v_cat_type <> p_transaction_type THEN
        RAISE EXCEPTION 'Category transaction type mismatch: Category % cannot be used for % transaction',
            v_cat_type, p_transaction_type;
    END IF;

    v_ops_number := public.generate_ops_transaction_number();

    INSERT INTO public.operational_transactions (
        transaction_number,
        transaction_type,
        category_id,
        cash_account_id,
        transaction_date,
        amount,
        description,
        reference_number,
        proof_storage_path,
        original_file_name,
        mime_type,
        file_size,
        status,
        notes,
        idempotency_key,
        created_by,
        updated_by
    ) VALUES (
        v_ops_number,
        p_transaction_type,
        p_category_id,
        p_cash_account_id,
        COALESCE(p_transaction_date, NOW()),
        p_amount,
        p_description,
        p_reference_number,
        p_proof_storage_path,
        p_original_file_name,
        p_mime_type,
        p_file_size,
        'pending_verification',
        p_notes,
        p_idempotency_key,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_ops_id;

    RETURN v_ops_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. STORED PROCEDURE FOR VERIFYING OPERATIONAL TRANSACTION
CREATE OR REPLACE FUNCTION public.verify_operational_transaction(
    p_transaction_id UUID,
    p_verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_user_role VARCHAR;
    v_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_verifier_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to verify_operational_transaction';
    END IF;

    v_user_role := public.get_current_user_role();
    IF v_user_role NOT IN ('owner', 'finance_admin') THEN
        RAISE EXCEPTION 'Permission denied: Only Owner and Finance Admin can verify operational transactions';
    END IF;

    SELECT status INTO v_status
    FROM public.operational_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Operational transaction not found';
    END IF;

    IF v_status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Only pending operational transactions can be verified';
    END IF;

    UPDATE public.operational_transactions
    SET status = 'verified',
        verified_at = NOW(),
        verified_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_transaction_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. STORED PROCEDURE FOR OWNER APPROVAL OF OPERATIONAL VOID REQUEST
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
    v_req_status VARCHAR(20);
    v_user_role VARCHAR;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_reviewer_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to approve_operational_transaction_void_request';
    END IF;

    -- Owner ONLY check
    v_user_role := public.get_current_user_role();
    IF v_user_role <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Only Owner can review and approve operational void requests';
    END IF;

    SELECT operational_transaction_id, status INTO v_ops_id, v_req_status
    FROM public.operational_transaction_void_requests
    WHERE id = p_void_request_id
    FOR UPDATE;

    IF v_req_status IS NULL OR v_req_status <> 'pending' THEN
        RAISE EXCEPTION 'Void request not found or already processed';
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

-- 8. PRIVATE STORAGE BUCKET (operational-proofs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operational-proofs', 'operational-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view operational proof storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view operational proof storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'operational-proofs');
DROP POLICY IF EXISTS "Owner/FinanceAdmin can upload operational proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can upload operational proof storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
DROP POLICY IF EXISTS "Owner/FinanceAdmin can update operational proof storage objects" ON storage.objects;
CREATE POLICY "Owner/FinanceAdmin can update operational proof storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'operational-proofs' AND public.get_current_user_role() IN ('owner', 'finance_admin'));
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Core 8: Security Hardening, Search Path Locking & Release Readiness
-- ============================================================================

-- 1. HARDENING SECURITY DEFINER SEARCH_PATH ON ALL STORED PROCEDURES
CREATE OR REPLACE FUNCTION public.change_student_status(
    p_student_id UUID,
    p_new_status_id UUID,
    p_reason TEXT,
    p_changed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_actor_id UUID;
    v_old_status_id UUID;
    v_new_status_code VARCHAR(20);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_changed_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to change_student_status';
    END IF;

    SELECT status_id INTO v_old_status_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_old_status_id IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF v_old_status_id = p_new_status_id THEN
        RETURN TRUE;
    END IF;

    SELECT code INTO v_new_status_code
    FROM public.student_statuses
    WHERE id = p_new_status_id;

    IF v_new_status_code IS NULL THEN
        RAISE EXCEPTION 'Target student status not found';
    END IF;

    -- Update Student Record
    UPDATE public.students
    SET status_id = p_new_status_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_student_id;

    -- Audit Log Record
    INSERT INTO public.student_status_histories (
        student_id,
        previous_status_id,
        new_status_id,
        reason,
        created_by
    ) VALUES (
        p_student_id,
        v_old_status_id,
        p_new_status_id,
        p_reason,
        v_actor_id
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


CREATE OR REPLACE FUNCTION public.create_registration_with_snapshots(
    p_student_id UUID,
    p_academic_period_id UUID,
    p_registration_type_id UUID,
    p_notes TEXT,
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_registration_id UUID;
    v_reg_number VARCHAR(50);
    v_actor_id UUID;
    v_student_study_program_id UUID;
    v_student_service_scheme_id UUID;
    v_tariff RECORD;
    v_total_sks INTEGER := 0;
    v_fee_estimate BIGINT := 0;
    v_line_amount BIGINT;
    v_line_qty INTEGER;
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_registration_with_snapshots';
    END IF;

    -- Get student study program and service scheme context
    SELECT study_program_id, service_scheme_id
    INTO v_student_study_program_id, v_student_service_scheme_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_student_study_program_id IS NULL THEN
        RAISE EXCEPTION 'Student not found or missing study program context';
    END IF;

    v_reg_number := public.generate_registration_number();

    -- Insert Registration Header with Context Snapshot
    INSERT INTO public.registrations (
        registration_number,
        student_id,
        academic_period_id,
        registration_type_id,
        study_program_id,
        service_scheme_id,
        total_sks,
        fee_estimate_amount,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_reg_number,
        p_student_id,
        p_academic_period_id,
        p_registration_type_id,
        v_student_study_program_id,
        v_student_service_scheme_id,
        0,
        0,
        'draft',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_registration_id;

    -- Copy Applicable Tariff Snapshots from Master Data
    FOR v_tariff IN
        SELECT id, name, calculation_type, unit_amount, default_sks
        FROM public.fee_structures
        WHERE study_program_id = v_student_study_program_id
          AND service_scheme_id = v_student_service_scheme_id
          AND is_active = true
    LOOP
        v_line_qty := COALESCE(v_tariff.default_sks, 1);
        v_line_amount := v_tariff.unit_amount * v_line_qty;

        INSERT INTO public.registration_fee_snapshots (
            registration_id,
            fee_structure_id,
            fee_name_snapshot,
            calculation_type,
            quantity,
            unit_amount,
            total_amount,
            created_by
        ) VALUES (
            v_registration_id,
            v_tariff.id,
            v_tariff.name,
            v_tariff.calculation_type,
            v_line_qty,
            v_tariff.unit_amount,
            v_line_amount,
            v_actor_id
        );

        IF v_tariff.calculation_type = 'per_sks' THEN
            v_total_sks := v_total_sks + v_line_qty;
        END IF;

        v_fee_estimate := v_fee_estimate + v_line_amount;
    END LOOP;

    -- Update Registration Header Totals
    UPDATE public.registrations
    SET total_sks = v_total_sks,
        fee_estimate_amount = v_fee_estimate
    WHERE id = v_registration_id;

    RETURN v_registration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 2. HARDENING LIP STATUS CONSISTENCY TRIGGER
CREATE OR REPLACE FUNCTION public.check_lip_status_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_already_verified BIGINT;
BEGIN
    SET search_path = public, pg_temp;

    IF NEW.status = 'paid_to_ut' AND (OLD.status IS NULL OR OLD.status <> 'paid_to_ut') THEN
        SELECT COALESCE(SUM(ri.amount), 0) INTO v_already_verified
        FROM public.ut_remittance_items ri
        JOIN public.ut_remittances r ON ri.remittance_id = r.id
        WHERE ri.lip_document_id = NEW.id
          AND r.status = 'verified';

        IF v_already_verified < NEW.official_amount THEN
            RAISE EXCEPTION 'Consistency error: Cannot manually set LIP status to paid_to_ut without sufficient verified UT remittances (Paid: Rp %, Official: Rp %)',
                v_already_verified, NEW.official_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_lip_status_consistency ON public.lip_documents;
CREATE TRIGGER trg_lip_status_consistency
BEFORE UPDATE ON public.lip_documents
FOR EACH ROW EXECUTE FUNCTION public.check_lip_status_consistency();

-- 3. ENSURE ALL STORAGE BUCKETS ARE PRIVATE
UPDATE storage.buckets SET public = false WHERE id IN ('lip-documents', 'payment-proofs', 'ut-remittance-proofs', 'operational-proofs');
-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- Phase 6C.1: User Management & Audit Logs Table & RPC Creation Function
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
-- Only Owner and Viewer can view audit logs
DROP POLICY IF EXISTS "Owner can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Owner and Auditor can view audit logs" ON public.audit_logs;
CREATE POLICY "Owner and Auditor can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code IN ('owner', 'viewer')
        )
    );

-- Authenticated users can insert audit logs for authorized actions
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = actor_user_id);

-- 4. SECURE ATOMIC USER CREATION FUNCTION
CREATE OR REPLACE FUNCTION public.create_internal_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_role_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Check caller is owner
    SELECT r.code INTO v_caller_role
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid();

    IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
        RAISE EXCEPTION 'Hanya role Owner yang diizinkan membuat pengguna.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % tidak ditemukan.', p_role_code;
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', p_email, v_encrypted_pw, NOW(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_full_name),
            NOW(), NOW(), 'authenticated', 'authenticated'
        );

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
        ) VALUES (
            v_user_id, v_user_id, format('{"sub":"%s","email":"%s"}', v_user_id, p_email)::jsonb,
            'email', NOW(), NOW(), NOW(), p_email
        ) ON CONFLICT DO NOTHING;
    ELSE
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (id, full_name, is_active)
    VALUES (v_user_id, p_full_name, TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = TRUE;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RETURN v_user_id;
END;
$$;
-- ============================================================================
-- SIM-SALUT Pangkalpinang Master Seed Data
-- Safe Master Seed Data ONLY (No real personal data, no fake production ledgers)
-- ============================================================================

-- 1. Roles
INSERT INTO public.roles (code, name, description) VALUES
('owner', 'Owner / Pimpinan', 'Penerima laporan penuh, pengelola pengguna, dan pengambil keputusan sensitif'),
('academic_admin', 'Admin Akademik', 'Pengelola data mahasiswa, registrasi semester, LIP, dan prodi'),
('finance_admin', 'Admin Keuangan / Kasir', 'Pencatat pembayaran mahasiswa, setoran UT, kas operasional, dan bukti bayar'),
('viewer', 'Viewer / Auditor', 'Akses lihat data dan laporan tanpa hak ubah/hapus')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Academic Periods
INSERT INTO public.academic_periods (code, name, term, is_active) VALUES
('20251', '2025/2026 Ganjil', 'Ganjil', FALSE),
('20252', '2025/2026 Genap', 'Genap', FALSE),
('20261', '2026/2027 Ganjil', 'Ganjil', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3. Faculties
INSERT INTO public.faculties (code, name) VALUES
('FKIP', 'Fakultas Keguruan dan Ilmu Pendidikan'),
('FE', 'Fakultas Ekonomi dan Bisnis'),
('FHISIP', 'Fakultas Hukum, Ilmu Sosial dan Ilmu Politik'),
('FST', 'Fakultas Sains dan Teknologi'),
('SV', 'Sekolah Vokasi')
ON CONFLICT (code) DO NOTHING;

-- 4. Study Levels
INSERT INTO public.study_levels (code, name) VALUES
('D3', 'Diploma III'),
('D4', 'Diploma IV'),
('S1', 'Sarjana (S1)'),
('S2', 'Magister (S2)'),
('S3', 'Doktor (S3)')
ON CONFLICT (code) DO NOTHING;

-- 5. Study Programs (All Official Programs from SALUT Mega Cendekia Flyer)
INSERT INTO public.study_programs (code, name, faculty_id, study_level_id) VALUES
-- FST (Fakultas Sains dan Teknologi) - S1
('252', 'Sistem Informasi', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('253', 'Matematika', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('254', 'Statistika', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('255', 'Biologi', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('256', 'Agribisnis Bidang Minat Pertanian', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('257', 'Agribisnis Bidang Minat Peternakan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('258', 'Agribisnis Bidang Minat Perikanan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('259', 'Teknologi Pangan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('260', 'Perencanaan Wilayah & Kota', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('261', 'Sains Data', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- FHISIP (Fakultas Hukum, Ilmu Sosial dan Ilmu Politik) - S1
('311', 'Ilmu Hukum', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('312', 'Administrasi Negara / Publik', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('313', 'Administrasi Bisnis', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('314', 'Ilmu Pemerintahan', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('315', 'Ilmu Komunikasi', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('316', 'Ilmu Perpustakaan', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('317', 'Sosiologi', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('318', 'Sastra Inggris Penerjemah', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('319', 'Perpajakan (S1)', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- FKIP (Fakultas Keguruan dan Ilmu Pendidikan) - S1
('118', 'Pendidikan Guru Sekolah Dasar (PGSD)', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('119', 'Pendidikan Guru Anak Usia Dini (PGPAUD)', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('120', 'Pendidikan Agama Islam', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('121', 'Pendidikan Bahasa Indonesia', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('122', 'Pendidikan Bahasa Inggris', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('123', 'Pendidikan Matematika', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('124', 'Pendidikan Biologi', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('125', 'Pendidikan Fisika', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('126', 'Pendidikan Kimia', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('127', 'Pancasila & Kewarganegaraan', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('128', 'Pendidikan Ekonomi', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('129', 'Teknologi Pendidikan', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- FEB (Fakultas Ekonomi dan Bisnis) - S1
('54', 'Manajemen', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('83', 'Akuntansi', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('55', 'Ekonomi Pembangunan', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('56', 'Ekonomi Syariah', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('57', 'Pariwisata', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('58', 'Kewirausahaan', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('59', 'Akuntansi Keuangan Publik', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- SV (Sekolah Vokasi) - D3 & D4
('411', 'D-IV Kearsipan', (SELECT id FROM public.faculties WHERE code = 'SV'), (SELECT id FROM public.study_levels WHERE code = 'D4')),
('412', 'D-III Perpajakan', (SELECT id FROM public.faculties WHERE code = 'SV'), (SELECT id FROM public.study_levels WHERE code = 'D3'))
ON CONFLICT (code) DO NOTHING;

-- 6. Service Schemes
INSERT INTO public.service_schemes (code, name, category, description) VALUES
('SIPAS_NON_TTM', 'SIPAS Non-TTM', 'SIPAS', 'Sistem Paket Semester tanpa Tutorial Tatap Muka wajib'),
('SIPAS_TTM', 'SIPAS TTM', 'SIPAS', 'Sistem Paket Semester dengan Tutorial Tatap Muka'),
('SIPAS_SEMI', 'SIPAS Semi', 'SIPAS', 'Sistem Paket Semester kombinasi TTM dan Online'),
('SIPAS_FULL', 'SIPAS Penuh', 'SIPAS', 'Sistem Paket Semester Penuh Tatap Muka'),
('NON_SIPAS', 'Non-SIPAS / Per SKS', 'Non-SIPAS', 'Skema pendaftaran mata kuliah per SKS bebas')
ON CONFLICT (code) DO NOTHING;

-- 7. Fee Types
INSERT INTO public.fee_types (code, name, category, is_per_sks, description) VALUES
('TUITION_PACKAGE', 'Uang Kuliah Paket Semester', 'UT_OFFICIAL', FALSE, 'Biaya resmi UT skema paket per semester'),
('COURSE_PER_SKS', 'Biaya Mata Kuliah Per SKS', 'UT_OFFICIAL', TRUE, 'Biaya registrasi mata kuliah reguler per SKS'),
('COURSE_REPEAT', 'Biaya Mata Kuliah Ulang', 'UT_OFFICIAL', TRUE, 'Biaya registrasi mengulang mata kuliah per SKS'),
('ADMISION', 'Biaya Admisi Pendaftaran Baru', 'UT_OFFICIAL', FALSE, 'Biaya pendaftaran awal mahasiswa baru UT'),
('SALUT_SERVICE', 'Biaya Layanan & Komisi SALUT', 'SALUT_INTERNAL', FALSE, 'Biaya administrasi dan pendampingan layanan SALUT')
ON CONFLICT (code) DO NOTHING;

-- 8. Payment Methods
INSERT INTO public.payment_methods (code, name, requires_reference) VALUES
('CASH', 'Tunai / Kasir SALUT', FALSE),
('BANK_TRANSFER', 'Transfer Bank SALUT', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 9. Student Statuses
INSERT INTO public.student_statuses (code, name) VALUES
('CALON', 'Calon Mahasiswa'),
('AKTIF', 'Mahasiswa Aktif'),
('CUTI', 'Cuti Akademik'),
('NONAKTIF', 'Non-Aktif'),
('DO', 'Drop Out (DO)'),
('LULUS', 'Lulus / Alumni')
ON CONFLICT (code) DO NOTHING;

-- 10. Cash Accounts
INSERT INTO public.cash_accounts (code, name, account_number, bank_name) VALUES
('KAS_TUNAI', 'Kas Tunai SALUT Pangkalpinang', NULL, NULL),
('BANK_BCA', 'Rekening Bank BCA SALUT', '8870123456', 'Bank Central Asia'),
('BANK_BRI', 'Rekening Bank BRI SALUT', '001201002345501', 'Bank Rakyat Indonesia')
ON CONFLICT (code) DO NOTHING;

-- 11. Operational Categories
INSERT INTO public.operational_categories (code, name, transaction_type) VALUES
('OP_OPERATIONAL', 'Beban Operasional Kantor', 'expense'),
('OP_ELECTRICITY', 'Listrik & Internet', 'expense'),
('OP_SALARY', 'Gaji & Honorarium Staf', 'expense'),
('OP_OTHER_INCOME', 'Pemasukan Non-Akademik Lainnya', 'income')
ON CONFLICT (code) DO NOTHING;

-- 12. App Settings Initial Default
INSERT INTO public.app_settings (key, value, description) VALUES
('salut_info', '{"name": "SALUT Pangkalpinang", "city": "Pangkalpinang", "phone": "0812-3456-7890", "address": "Jl. Utama No. 12, Pangkalpinang"}', 'Informasi identitas resmi SALUT'),
('default_salut_fee', '{"amount": 400000, "currency": "IDR"}', 'Nominal estimasi awal biaya layanan SALUT per registrasi')
ON CONFLICT (key) DO NOTHING;
