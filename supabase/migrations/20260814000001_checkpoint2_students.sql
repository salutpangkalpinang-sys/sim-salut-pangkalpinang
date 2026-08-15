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
