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
    type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
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
CREATE POLICY "Authenticated users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view academic_periods" ON public.academic_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view faculties" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view study_levels" ON public.study_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view study_programs" ON public.study_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view service_schemes" ON public.service_schemes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view fee_types" ON public.fee_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view fee_rates" ON public.fee_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view student_statuses" ON public.student_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view cash_accounts" ON public.cash_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view operational_categories" ON public.operational_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Write policies (Only Owner and Academic Admin can mutate master data)
CREATE POLICY "Owner/AcademicAdmin can manage master data" ON public.study_programs FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner/AcademicAdmin can manage fee_rates" ON public.fee_rates FOR ALL TO authenticated
USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

CREATE POLICY "Owner can manage user roles" ON public.user_roles FOR ALL TO authenticated
USING (public.get_current_user_role() = 'owner');

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);
