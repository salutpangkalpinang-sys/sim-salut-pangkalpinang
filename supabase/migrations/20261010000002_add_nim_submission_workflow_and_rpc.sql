-- Migration: 20261010000002_add_nim_submission_workflow_and_rpc.sql
-- Description: Implement minimal candidate NIM submission workflow and atomic NIM assignment RPC
-- Features:
--   1. Table: nim_submissions (tracks external UT submission recorded by operators)
--   2. Constraints: One active submission per student (status = 'submitted')
--   3. RPC: record_nim_submission (validates net salut paid >= required salut fee, checks role, inserts submission)
--   4. RPC: assign_official_nim (validates uniqueness, updates student in-place, changes status CALON -> AKTIF, inserts status history & audit log atomically)
--   5. Grants & RLS policies

BEGIN;

-- ============================================================================
-- 1. TABLE: nim_submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.nim_submissions (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'submitted' NOT NULL CHECK (status IN ('submitted', 'completed', 'cancelled')),
    submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100) NULL,
    notes TEXT NULL,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Partial unique index: Only one active ('submitted') submission allowed per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_nim_submissions_active_student
    ON public.nim_submissions (student_id)
    WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_nim_submissions_student ON public.nim_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_nim_submissions_invoice ON public.nim_submissions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_nim_submissions_reg ON public.nim_submissions (registration_id);

-- RLS & Grants
ALTER TABLE public.nim_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view nim_submissions" ON public.nim_submissions;
CREATE POLICY "Authenticated users can view nim_submissions"
    ON public.nim_submissions FOR SELECT
    TO authenticated
    USING (true);

-- Direct mutation revoked, must use SECURITY DEFINER RPCs
REVOKE INSERT, UPDATE, DELETE ON public.nim_submissions FROM authenticated;
GRANT SELECT ON public.nim_submissions TO authenticated;


-- ============================================================================
-- 2. RPC: record_nim_submission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_nim_submission(
    p_student_id UUID,
    p_registration_id UUID,
    p_invoice_id UUID,
    p_submission_date DATE,
    p_reference_number VARCHAR,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_student RECORD;
    v_inv RECORD;
    v_salut_total BIGINT := 0;
    v_salut_paid BIGINT := 0;
    v_active_sub_id UUID;
    v_new_submission_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak berwenang mencatat pengajuan NIM calon mahasiswa.', COALESCE(v_actor_role, 'NULL');
    END IF;

    IF public.is_current_user_active() IS NOT TRUE THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    -- Lock student
    SELECT id, nim, status_id INTO v_student
    FROM public.students
    WHERE id = p_student_id
    FOR UPDATE;

    IF v_student.id IS NULL THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: Calon mahasiswa tidak ditemukan.';
    END IF;

    IF v_student.nim IS NOT NULL AND TRIM(v_student.nim) <> '' THEN
        RAISE EXCEPTION 'ALREADY_HAS_NIM: Mahasiswa sudah memiliki NIM resmi (%).', v_student.nim;
    END IF;

    -- Check if student already has active submission
    SELECT id INTO v_active_sub_id
    FROM public.nim_submissions
    WHERE student_id = p_student_id AND status = 'submitted'
    LIMIT 1;

    IF v_active_sub_id IS NOT NULL THEN
        RAISE EXCEPTION 'ALREADY_SUBMITTED: Calon mahasiswa sudah memiliki catatan pengajuan NIM yang aktif.';
    END IF;

    -- Lock and validate invoice & registration
    SELECT inv.id, inv.registration_id, inv.status INTO v_inv
    FROM public.invoices inv
    JOIN public.registrations reg ON reg.id = inv.registration_id
    WHERE inv.id = p_invoice_id 
      AND inv.registration_id = p_registration_id
      AND reg.student_id = p_student_id
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice tidak ditemukan untuk registrasi yang dipilih.';
    END IF;

    IF v_inv.status = 'cancelled' THEN
        RAISE EXCEPTION 'INVOICE_CANCELLED: Invoice yang dipilih telah dibatalkan.';
    END IF;

    -- Compute canonical required service fee for this invoice
    SELECT COALESCE(SUM(amount), 0)
    INTO v_salut_total
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id AND item_type = 'service_fee';

    IF v_salut_total <= 0 THEN
        RAISE EXCEPTION 'ZERO_SALUT_FEE: Komponen kewajiban SALUT pada invoice harus lebih besar dari 0.';
    END IF;

    -- Lock existing payment component allocations for this invoice to protect against concurrent reversals
    PERFORM id 
    FROM public.payment_component_allocations 
    WHERE invoice_id = p_invoice_id 
      AND component_type = 'service_fee'
    FOR UPDATE;

    -- Compute canonical net posted allocations for service_fee (ignoring voided entries)
    SELECT COALESCE(SUM(
        CASE 
            WHEN entry_type = 'allocation' THEN amount 
            WHEN entry_type = 'reversal' THEN -amount 
            ELSE 0 
        END
    ), 0)
    INTO v_salut_paid
    FROM public.payment_component_allocations
    WHERE invoice_id = p_invoice_id 
      AND component_type = 'service_fee' 
      AND status = 'posted';

    IF v_salut_paid < v_salut_total THEN
        RAISE EXCEPTION 'CRITERIA_FAILED: Syarat finansial belum terpenuhi. Pembayaran komisi SALUT netto (Rp %) kurang dari kewajiban (Rp %).',
            v_salut_paid, v_salut_total;
    END IF;

    -- Insert nim_submissions
    INSERT INTO public.nim_submissions (
        student_id,
        registration_id,
        invoice_id,
        status,
        submission_date,
        reference_number,
        notes,
        submitted_by
    ) VALUES (
        p_student_id,
        p_registration_id,
        p_invoice_id,
        'submitted',
        COALESCE(p_submission_date, CURRENT_DATE),
        p_reference_number,
        p_notes,
        v_actor_id
    )
    RETURNING id INTO v_new_submission_id;

    -- Record atomic audit log
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        v_actor_id,
        'nim_submission_recorded',
        'students',
        p_student_id,
        jsonb_build_object(
            'submission_id', v_new_submission_id,
            'registration_id', p_registration_id,
            'invoice_id', p_invoice_id,
            'submission_date', COALESCE(p_submission_date, CURRENT_DATE),
            'reference_number', p_reference_number,
            'required_salut_fee', v_salut_total,
            'net_salut_paid', v_salut_paid,
            'notes', p_notes
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_new_submission_id,
        'required_salut_fee', v_salut_total,
        'net_salut_paid', v_salut_paid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ============================================================================
-- 3. RPC: assign_official_nim
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_official_nim(
    p_student_id UUID,
    p_nim VARCHAR,
    p_effective_date TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_student RECORD;
    v_clean_nim TEXT;
    v_duplicate_id UUID;
    v_calon_status_id UUID;
    v_aktif_status_id UUID;
    v_active_sub RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Permintaan tidak terotentikasi. auth.uid() wajib ada.';
    END IF;

    v_actor_role := public.get_current_user_role();
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin', 'academic_admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak berwenang menginput NIM resmi mahasiswa.', COALESCE(v_actor_role, 'NULL');
    END IF;

    IF public.is_current_user_active() IS NOT TRUE THEN
        RAISE EXCEPTION 'USER_INACTIVE: Pengguna tidak aktif atau akun telah dinonaktifkan.';
    END IF;

    v_clean_nim := TRIM(p_nim);
    IF v_clean_nim IS NULL OR v_clean_nim = '' THEN
        RAISE EXCEPTION 'INVALID_NIM: NIM resmi wajib diisi dan tidak boleh kosong.';
    END IF;

    -- Validate max length
    IF LENGTH(v_clean_nim) > 30 THEN
        RAISE EXCEPTION 'INVALID_NIM_LENGTH: Panjang NIM resmi maksimal 30 karakter (Diberikan: % karakter).', LENGTH(v_clean_nim);
    END IF;

    -- Validate alphanumeric
    IF v_clean_nim !~ '^[0-9A-Za-z]+$' THEN
        RAISE EXCEPTION 'INVALID_NIM_FORMAT: NIM hanya boleh berisi angka dan huruf tanpa spasi.';
    END IF;

    -- Lock student
    SELECT id, nim, status_id, full_name INTO v_student
    FROM public.students
    WHERE id = p_student_id
    FOR UPDATE;

    IF v_student.id IS NULL THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: Mahasiswa tidak ditemukan.';
    END IF;

    IF v_student.nim IS NOT NULL AND TRIM(v_student.nim) <> '' THEN
        RAISE EXCEPTION 'ALREADY_HAS_NIM: Mahasiswa sudah memiliki NIM resmi (%).', v_student.nim;
    END IF;

    -- Check uniqueness across all students (preserve leading zeros)
    SELECT id INTO v_duplicate_id
    FROM public.students
    WHERE nim = v_clean_nim AND id <> p_student_id
    LIMIT 1;

    IF v_duplicate_id IS NOT NULL THEN
        RAISE EXCEPTION 'NIM_DUPLICATE: NIM % sudah digunakan oleh mahasiswa lain.', v_clean_nim;
    END IF;

    -- Status lookup
    SELECT id INTO v_calon_status_id FROM public.student_statuses WHERE code = 'CALON';
    SELECT id INTO v_aktif_status_id FROM public.student_statuses WHERE code = 'AKTIF';

    IF v_aktif_status_id IS NULL THEN
        RAISE EXCEPTION 'STATUS_CONFIG_ERROR: Status AKTIF tidak ditemukan pada database master.';
    END IF;

    -- 1. Update students table IN-PLACE
    UPDATE public.students
    SET
        nim = v_clean_nim,
        status_id = v_aktif_status_id,
        status_effective_at = COALESCE(p_effective_date, NOW()),
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_student_id;

    -- 2. Record status history entry
    IF v_student.status_id <> v_aktif_status_id THEN
        INSERT INTO public.student_status_history (
            student_id,
            previous_status_id,
            new_status_id,
            effective_at,
            reason,
            changed_by
        ) VALUES (
            p_student_id,
            v_student.status_id,
            v_aktif_status_id,
            COALESCE(p_effective_date, NOW()),
            COALESCE(p_reason, 'Penerbitan NIM resmi UT: ' || v_clean_nim),
            v_actor_id
        );
    END IF;

    -- 3. Mark active submission as completed if exists
    UPDATE public.nim_submissions
    SET
        status = 'completed',
        updated_at = NOW()
    WHERE student_id = p_student_id AND status = 'submitted';

    -- 4. Record atomic audit log
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason
    ) VALUES (
        v_actor_id,
        'official_nim_assigned',
        'students',
        p_student_id,
        jsonb_build_object(
            'nim', v_student.nim,
            'status_id', v_student.status_id
        ),
        jsonb_build_object(
            'nim', v_clean_nim,
            'status_id', v_aktif_status_id,
            'effective_date', COALESCE(p_effective_date, NOW())
        ),
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'nim', v_clean_nim,
        'status', 'AKTIF'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Permissions
GRANT EXECUTE ON FUNCTION public.record_nim_submission(UUID, UUID, UUID, DATE, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_official_nim(UUID, VARCHAR, TIMESTAMPTZ, TEXT) TO authenticated;

COMMIT;
