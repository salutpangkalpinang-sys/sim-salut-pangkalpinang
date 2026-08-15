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
