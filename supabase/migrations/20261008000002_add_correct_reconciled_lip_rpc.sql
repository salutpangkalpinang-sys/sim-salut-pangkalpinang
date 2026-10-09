-- Migration: 20261008000002_add_correct_reconciled_lip_rpc.sql
-- Description: Prosedur resmi koreksi dokumen LIP & rekonsiliasi aktif yang keliru input
-- Mekanisme: Audit-tracked supersede & reversal adjustment, row locking, idempotency guard (post-lock),
--            RBAC check, out-of-scope rejection, expected reconciliation check, LIP paid_to_ut guard

-- ============================================================================
-- SCHEMA ADDITIONS: Tambahkan kolom pendukung koreksi ke invoice_reconciliations
-- ============================================================================

-- Pastikan ekstensi pgcrypto tersedia untuk fungsi digest
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Payload hash: ikat idempotency_key ke parameter koreksi spesifik
ALTER TABLE public.invoice_reconciliations
    ADD COLUMN IF NOT EXISTS correction_payload_hash TEXT NULL;

-- Referensi ke rekonsiliasi lama yang di-supersede (chain audit)
ALTER TABLE public.invoice_reconciliations
    ADD COLUMN IF NOT EXISTS supersedes_reconciliation_id UUID NULL
        REFERENCES public.invoice_reconciliations(id) ON DELETE RESTRICT;

-- Index untuk lookup supersede chain
CREATE INDEX IF NOT EXISTS idx_rec_supersedes
    ON public.invoice_reconciliations (supersedes_reconciliation_id)
    WHERE supersedes_reconciliation_id IS NOT NULL;


CREATE OR REPLACE FUNCTION public.correct_reconciled_lip(
    p_lip_document_id UUID,
    p_new_tuition_amount BIGINT,
    p_new_book_amount BIGINT,
    p_new_shipping_amount BIGINT,
    p_new_other_ut_amount BIGINT,
    p_correction_reason TEXT,
    p_idempotency_key UUID,
    p_expected_reconciliation_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR(50);
    v_lip RECORD;
    v_rec RECORD;
    v_inv RECORD;
    v_reg RECORD;
    v_calculated_official BIGINT;
    v_new_variance BIGINT;
    v_reversal_item_id UUID;
    v_new_item_id UUID;
    v_new_rec_id UUID;
    v_existing_correction RECORD;
    v_verified_paid BIGINT := 0;
    v_canonical_totals RECORD;
    v_payload_hash TEXT;
BEGIN
    -- 1. AUTH & RBAC CHECK
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: auth.uid() wajib ada. Prosedur hanya dapat dijalankan oleh sesi terotentikasi.';
    END IF;

    -- Tolak role NULL / unauthorized secara eksplisit
    v_actor_role := public.get_current_user_role();
    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Role % tidak memiliki izin melakukan koreksi rekonsiliasi LIP.', COALESCE(v_actor_role, '<NULL>');
    END IF;

    -- Guard akun aktif dengan IS DISTINCT FROM TRUE
    IF public.is_current_user_active() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'USER_INACTIVE';
    END IF;

    -- 2. VALIDATION OF INPUTS (NULL and Domain Checks)
    IF p_lip_document_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT: p_lip_document_id tidak boleh NULL.';
    END IF;

    IF p_expected_reconciliation_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT: p_expected_reconciliation_id wajib diisi (tidak boleh NULL).';
    END IF;

    IF p_new_tuition_amount IS NULL OR p_new_book_amount IS NULL OR p_new_shipping_amount IS NULL OR p_new_other_ut_amount IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT: Seluruh komponen nominal kewajiban UT wajib diisi (tidak boleh NULL).';
    END IF;

    IF p_new_tuition_amount < 0 OR p_new_book_amount < 0 OR p_new_shipping_amount < 0 OR p_new_other_ut_amount < 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Komponen nominal kewajiban UT tidak boleh negatif.';
    END IF;

    v_calculated_official := p_new_tuition_amount + p_new_book_amount + p_new_shipping_amount + p_new_other_ut_amount;
    IF v_calculated_official <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Total kewajiban resmi UT hasil koreksi wajib lebih dari 0.';
    END IF;

    IF p_correction_reason IS NULL OR LENGTH(TRIM(p_correction_reason)) < 5 THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Alasan koreksi wajib diisi minimal 5 karakter sebagai rekam audit.';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED: p_idempotency_key wajib diisi.';
    END IF;

    -- Hitung payload hash mencakup LIP ID, rincian biaya individu, alasan, dan expected reconciliation ID
    v_payload_hash := encode(
        extensions.digest(
            p_lip_document_id::text || '|' ||
            p_new_tuition_amount::text || '|' ||
            p_new_book_amount::text || '|' ||
            p_new_shipping_amount::text || '|' ||
            p_new_other_ut_amount::text || '|' ||
            TRIM(p_correction_reason) || '|' ||
            p_expected_reconciliation_id::text,
            'sha256'
        ),
        'hex'
    );

    -- 3. PRE-LOCK IDEMPOTENCY GUARD (Cepat respon jika key sudah berhasil diproses)
    SELECT * INTO v_existing_correction
    FROM public.invoice_reconciliations
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_correction.id IS NOT NULL THEN
        IF v_existing_correction.lip_document_id <> p_lip_document_id OR
           v_existing_correction.correction_payload_hash IS DISTINCT FROM v_payload_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % sudah digunakan untuk target LIP atau parameter yang berbeda.', p_idempotency_key;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'reconciliation_id', v_existing_correction.id,
            'official_amount', v_existing_correction.official_lip_amount,
            'variance_amount', v_existing_correction.variance_amount,
            'message', 'Permintaan koreksi dengan idempotency key ini telah diproses sebelumnya.'
        );
    END IF;

    -- 4. ROW LOCKING (Urutan Ketat: LIP -> Registrasi -> Invoice)
    SELECT * INTO v_lip
    FROM public.lip_documents
    WHERE id = p_lip_document_id
    FOR UPDATE;

    IF v_lip.id IS NULL THEN
        RAISE EXCEPTION 'LIP_NOT_FOUND: Dokumen LIP dengan ID % tidak ditemukan.', p_lip_document_id;
    END IF;

    IF v_lip.status = 'paid_to_ut' THEN
        RAISE EXCEPTION 'INVALID_STATE: LIP telah dilunasi ke UT (status paid_to_ut) dan tidak dapat dikoreksi lagi melalui prosedur ini.';
    END IF;

    IF v_lip.status <> 'verified' THEN
        RAISE EXCEPTION 'INVALID_STATE: Hanya dokumen LIP berstatus verified yang dapat dikoreksi (Status saat ini: %).', v_lip.status;
    END IF;

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = v_lip.registration_id
    FOR UPDATE;

    SELECT * INTO v_inv
    FROM public.invoices
    WHERE registration_id = v_lip.registration_id AND status <> 'cancelled'
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND: Invoice aktif registrasi tidak ditemukan.';
    END IF;

    -- 5. POST-LOCK IDEMPOTENCY RE-CHECK (Menutup race window sebelum memeriksa rekonsiliasi lama)
    SELECT * INTO v_existing_correction
    FROM public.invoice_reconciliations
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_correction.id IS NOT NULL THEN
        IF v_existing_correction.lip_document_id <> p_lip_document_id OR
           v_existing_correction.correction_payload_hash IS DISTINCT FROM v_payload_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % sudah digunakan untuk target LIP atau parameter yang berbeda.', p_idempotency_key;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'reconciliation_id', v_existing_correction.id,
            'official_amount', v_existing_correction.official_lip_amount,
            'variance_amount', v_existing_correction.variance_amount,
            'message', 'Permintaan koreksi dengan idempotency key ini telah diproses sebelumnya (post-lock check).'
        );
    END IF;

    -- 6. LOCK REKONSILIASI AKTIF & EXPECTED RECONCILIATION CHECK
    SELECT * INTO v_rec
    FROM public.invoice_reconciliations
    WHERE invoice_id = v_inv.id AND lip_document_id = v_lip.id AND status = 'active'
    FOR UPDATE;

    IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND: Tidak ditemukan rekonsiliasi berstatus active untuk LIP ini.';
    END IF;

    IF v_rec.id <> p_expected_reconciliation_id THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT: Rekonsiliasi aktif saat ini (%) berbeda dari preview (%). Data mungkin telah berubah.',
            v_rec.id, p_expected_reconciliation_id;
    END IF;

    -- 7. HITUNG PERUBAHAN & BATASAN RILIS PERTAMA
    v_new_variance := v_calculated_official - v_rec.estimated_ut_amount;

    -- Batasan: Hanya koreksi shortage positif
    IF v_new_variance <= 0 THEN
        RAISE EXCEPTION 'OUT_OF_SCOPE: Koreksi menghasilkan variance Rp % (<= 0). Prosedur ini dibatasi untuk koreksi kekurangan biaya (shortage).', v_new_variance;
    END IF;

    -- Prasyarat: Belum disetor ke UT
    IF EXISTS (
        SELECT 1 FROM public.ut_remittance_items
        WHERE registration_id = v_reg.id
    ) THEN
        RAISE EXCEPTION 'REMITTANCE_RESTRICTION: Registrasi ini telah masuk ke dalam draft/eksekusi setoran UT. Koreksi dibatalkan untuk menjaga audit perbankan.';
    END IF;

    -- Batasan rilis pertama: Tolak jika rekonsiliasi lama atau registrasi memiliki keterkaitan kredit
    IF v_rec.credit_created > 0 OR EXISTS (
        SELECT 1 FROM public.student_credit_ledgers
        WHERE source_reconciliation_id = v_rec.id OR registration_id = v_reg.id
    ) THEN
        RAISE EXCEPTION 'CREDIT_RESTRICTION: Terdapat catatan kredit mahasiswa pada transaksi ini. Rilis pertama tidak mendukung mutasi dengan kredit.';
    END IF;

    -- 8. AUDIT-TRACKED RECONCILIATION SUPERSEDE
    UPDATE public.invoice_reconciliations
    SET status = 'superseded',
        voided_at = NOW(),
        voided_by = v_actor_id,
        void_reason = TRIM(p_correction_reason)
    WHERE id = v_rec.id;

    -- 9. REVERSE OLD RECONCILIATION INVOICE ITEMS
    IF v_rec.shortage_created > 0 THEN
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            description,
            quantity,
            unit_amount,
            amount,
            source_type,
            source_id,
            approval_status
        ) VALUES (
            v_inv.id,
            'discount',
            'Pembatalan/Reversal Penyesuaian Rekonsiliasi LIP Lama (Ref: ' || v_rec.id::text || ')',
            1,
            v_rec.shortage_created,
            v_rec.shortage_created,
            'lip_reconciliation',
            v_rec.id,
            'approved'
        ) RETURNING id INTO v_reversal_item_id;
    END IF;

    -- 10. TERBITKAN REKONSILIASI KOREKSI BARU (Saling Terhubung ke rekonsiliasi lama)
    INSERT INTO public.invoice_reconciliations (
        invoice_id,
        registration_id,
        lip_document_id,
        idempotency_key,
        correction_payload_hash,
        supersedes_reconciliation_id,
        estimated_ut_amount,
        official_lip_amount,
        variance_amount,
        service_fee_snapshot,
        verified_paid_at_reconcile,
        shortage_created,
        credit_created,
        reconciled_by,
        status
    ) VALUES (
        v_inv.id,
        v_reg.id,
        v_lip.id,
        p_idempotency_key,
        v_payload_hash,
        v_rec.id,
        v_rec.estimated_ut_amount,
        v_calculated_official,
        v_new_variance,
        v_rec.service_fee_snapshot,
        v_rec.verified_paid_at_reconcile,
        GREATEST(0, v_new_variance),
        0,
        v_actor_id,
        'active'
    ) RETURNING id INTO v_new_rec_id;

    -- 11. TERAPKAN SHORTAGE ITEM BARU
    IF v_new_variance > 0 THEN
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            description,
            quantity,
            unit_amount,
            amount,
            source_type,
            source_id
        ) VALUES (
            v_inv.id,
            'ut_liability',
            'Penyesuaian Kekurangan Biaya LIP Resmi UT (Terkoreksi)',
            1,
            v_new_variance,
            v_new_variance,
            'lip_reconciliation',
            v_new_rec_id
        ) RETURNING id INTO v_new_item_id;
    END IF;

    -- 12. PERBARUI DOKUMEN LIP DENGAN BUKTI SEBELUM/SESUDAH PADA CATATAN
    UPDATE public.lip_documents
    SET tuition_amount = p_new_tuition_amount,
        book_amount = p_new_book_amount,
        shipping_amount = p_new_shipping_amount,
        other_ut_amount = p_new_other_ut_amount,
        official_amount = v_calculated_official,
        notes = COALESCE(notes || E'\n', '') ||
                'Koreksi Rekonsiliasi (' || NOW()::text || ') oleh ' || v_actor_id::text || ': ' ||
                'Sebelum: UT Rp ' || v_lip.official_amount::text || ' (SPP Rp ' || v_lip.tuition_amount::text || ') -> ' ||
                'Sesudah: UT Rp ' || v_calculated_official::text || ' (SPP Rp ' || p_new_tuition_amount::text || '). ' ||
                'Alasan: ' || TRIM(p_correction_reason),
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = v_lip.id;

    -- 13. PERBARUI HEADER INVOICE
    UPDATE public.invoices
    SET official_lip_amount = v_calculated_official,
        variance_amount = v_new_variance,
        reconciled_at = NOW(),
        reconciled_by = v_actor_id,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = v_inv.id;

    -- 14. REKALKULASI STATUS DAN TOTAL KANONIKAL INVOICE
    PERFORM public.recalculate_invoice_status(v_inv.id);

    -- 15. CATAT AUDIT LOG ATOMIK (Actor auth.uid(), before/after, reason, metadata)
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        reason,
        metadata,
        created_at
    ) VALUES (
        v_actor_id,
        'reconciliation_corrected',
        'invoice_reconciliation',
        v_new_rec_id,
        jsonb_build_object(
            'superseded_reconciliation_id', v_rec.id,
            'old_official_lip_amount', v_rec.official_lip_amount,
            'old_tuition_amount', v_lip.tuition_amount,
            'old_variance_amount', v_rec.variance_amount,
            'old_shortage_created', v_rec.shortage_created,
            'lip_document_id', v_lip.id,
            'invoice_id', v_inv.id,
            'registration_id', v_reg.id
        ),
        jsonb_build_object(
            'new_reconciliation_id', v_new_rec_id,
            'new_official_lip_amount', v_calculated_official,
            'new_tuition_amount', p_new_tuition_amount,
            'new_book_amount', p_new_book_amount,
            'new_shipping_amount', p_new_shipping_amount,
            'new_other_ut_amount', p_new_other_ut_amount,
            'new_variance_amount', v_new_variance,
            'new_shortage_created', GREATEST(0, v_new_variance),
            'reversal_item_id', v_reversal_item_id,
            'new_shortage_item_id', v_new_item_id
        ),
        TRIM(p_correction_reason),
        jsonb_build_object(
            'actor_role', v_actor_role,
            'payload_hash', v_payload_hash,
            'idempotency_key', p_idempotency_key,
            'expected_reconciliation_id', p_expected_reconciliation_id,
            'lip_number', v_lip.lip_number,
            'invoice_number', v_inv.invoice_number
        ),
        NOW()
    );

    -- 16. RETURN FINANCIAL SUMMARY KANONIKAL
    SELECT * INTO v_canonical_totals FROM public.get_invoice_canonical_totals(v_inv.id);

    SELECT COALESCE(SUM(pa.amount), 0) INTO v_verified_paid
    FROM public.payment_allocations pa
    JOIN public.student_payments sp ON pa.payment_id = sp.id
    WHERE pa.invoice_id = v_inv.id AND sp.status = 'verified';

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'superseded_reconciliation_id', v_rec.id,
        'new_reconciliation_id', v_new_rec_id,
        'official_lip_amount', v_calculated_official,
        'variance_amount', v_new_variance,
        'total_billed', v_canonical_totals.total_billed,
        'total_service_fee', v_canonical_totals.total_service_fee,
        'total_ut_liability', v_canonical_totals.total_ut_liability,
        'total_paid', v_verified_paid,
        'balance_due', GREATEST(0, v_canonical_totals.total_billed - v_verified_paid)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- Revoke & Grant hak eksekusi
REVOKE EXECUTE ON FUNCTION public.correct_reconciled_lip FROM public, anon;
GRANT EXECUTE ON FUNCTION public.correct_reconciled_lip TO authenticated;
