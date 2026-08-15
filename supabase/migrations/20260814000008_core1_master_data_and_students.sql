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
CREATE POLICY "Authenticated users can read master data" ON public.academic_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read faculties" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read study levels" ON public.study_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read study programs" ON public.study_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read service schemes" ON public.service_schemes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read student statuses" ON public.student_statuses FOR SELECT TO authenticated USING (true);

-- Master data WRITE for Owner & Academic Admin
CREATE POLICY "Owner/AcademicAdmin can manage academic_periods" ON public.academic_periods FOR ALL TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
CREATE POLICY "Owner/AcademicAdmin can manage study_programs" ON public.study_programs FOR ALL TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

-- Students READ for all authenticated users (Owner, Academic Admin, Finance Admin, Viewer)
CREATE POLICY "Authenticated users can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view status history" ON public.student_status_history FOR SELECT TO authenticated USING (true);

-- Students WRITE for Owner & Academic Admin ONLY (Finance Admin and Viewer DENIED)
CREATE POLICY "Owner/AcademicAdmin can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
CREATE POLICY "Owner/AcademicAdmin can update students" ON public.students FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
CREATE POLICY "Owner/AcademicAdmin can insert status history" ON public.student_status_history FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
