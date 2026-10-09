// File: scripts/test-concurrency-correction.js
// Uji konkurensi 2 koneksi nyata khusus database lokal SIM-SALUT
const { Client } = require('pg');

async function runConcurrencyTest() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  // 1. Proteksi ketat: Tolak target remote / non-local
  const parsed = new URL(connectionString);
  const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  if (!isLocal) {
    console.error('FATAL: Skrip pengujian konkurensi HANYA diizinkan untuk database lokal (localhost/127.0.0.1). Target remote ditolak.');
    process.exit(1);
  }

  const clientSetup = new Client({ connectionString });
  await clientSetup.connect();
  console.log(`Terkoneksi ke database lokal: ${parsed.hostname}:${parsed.port || 54322}`);

  // Fixture IDs khusus pengujian konkurensi
  const ownerUid = 'c1000000-0000-0000-0000-000000000001';
  const studentId = 'c2000000-0000-0000-0000-000000000001';
  const regId = 'c3000000-0000-0000-0000-000000000001';
  const lipDocId = 'c4000000-0000-0000-0000-000000000001';
  const invId = 'c5000000-0000-0000-0000-000000000001';
  const recId = 'c6000000-0000-0000-0000-000000000001';
  const payId = 'c7000000-0000-0000-0000-000000000001';
  const sharedKey = 'c8000000-0000-0000-0000-000000000001';

  try {
    // 2. Setup identitas RBAC nyata dan data baseline
    await clientSetup.query(`
      DO $$
      DECLARE
        v_role_owner_id UUID;
        v_status_id UUID;
        v_period_id UUID;
        v_type_id UUID;
        v_prog_id UUID;
        v_scheme_id UUID;
        v_method_id UUID;
        v_acc_id UUID;
      BEGIN
        SELECT id INTO v_role_owner_id FROM public.roles WHERE code = 'owner';
        SELECT id INTO v_status_id FROM public.student_statuses LIMIT 1;
        SELECT id INTO v_period_id FROM public.academic_periods LIMIT 1;
        SELECT id INTO v_type_id   FROM public.registration_types LIMIT 1;
        SELECT id INTO v_prog_id   FROM public.study_programs LIMIT 1;
        SELECT id INTO v_scheme_id FROM public.service_schemes LIMIT 1;
        SELECT id INTO v_method_id FROM public.payment_methods LIMIT 1;
        SELECT id INTO v_acc_id    FROM public.cash_accounts LIMIT 1;

        -- Identitas Owner
        INSERT INTO auth.users (id, email, raw_user_meta_data, role, aud)
        VALUES ('${ownerUid}'::uuid, 'owner_concurrent@test.local', '{"full_name":"Owner Concurrency"}', 'authenticated', 'authenticated')
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

        INSERT INTO public.profiles (id, full_name, is_active)
        VALUES ('${ownerUid}'::uuid, 'Owner Concurrency', TRUE)
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

        DELETE FROM public.user_roles WHERE user_id = '${ownerUid}'::uuid;
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES ('${ownerUid}'::uuid, v_role_owner_id);

        -- Mahasiswa & Registrasi
        INSERT INTO public.students (id, nim, full_name, status_id)
        VALUES ('${studentId}'::uuid, '053099999', 'Mahasiswa Concurrency', v_status_id)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.registrations (id, student_id, academic_period_id, registration_type_id, study_program_id, service_scheme_id, credits, status)
        VALUES ('${regId}'::uuid, '${studentId}'::uuid, v_period_id, v_type_id, v_prog_id, v_scheme_id, 18, 'active')
        ON CONFLICT (id) DO NOTHING;

        -- LIP Dokumen Keliru Awal (SPP 1.700.000 + Ongkir 117.600 = 1.817.600)
        INSERT INTO public.lip_documents (id, registration_id, lip_number, version, tuition_amount, book_amount, shipping_amount, other_ut_amount, official_amount, storage_path, original_file_name, mime_type, file_size, status)
        VALUES ('${lipDocId}'::uuid, '${regId}'::uuid, 'LIP-CONCUR-01', 1, 1700000, 0, 117600, 0, 1817600, '/lip/c.pdf', 'c.pdf', 'application/pdf', 100, 'verified')
        ON CONFLICT (id) DO NOTHING;

        -- Invoice
        INSERT INTO public.invoices (id, registration_id, lip_document_id, invoice_number, status, billing_phase, official_lip_amount, variance_amount)
        VALUES ('${invId}'::uuid, '${regId}'::uuid, '${lipDocId}'::uuid, 'INV-CONCUR-01', 'partial', 'lip_reconciled', 1817600, 517600)
        ON CONFLICT (id) DO NOTHING;

        -- Invoice Items Awal
        INSERT INTO public.invoice_items (id, invoice_id, item_type, description, quantity, unit_amount, amount, source_type, approval_status)
        VALUES
          (gen_random_uuid(), '${invId}'::uuid, 'ut_liability', 'SPP/UKT', 1, 1300000, 1300000, 'registration', 'approved'),
          (gen_random_uuid(), '${invId}'::uuid, 'service_fee', 'Komisi SALUT', 1, 400000, 400000, 'registration', 'approved'),
          (gen_random_uuid(), '${invId}'::uuid, 'ut_liability', 'Kekurangan Awal', 1, 517600, 517600, 'lip_reconciliation', 'approved')
        ON CONFLICT DO NOTHING;

        -- Rekonsiliasi Keliru Awal
        INSERT INTO public.invoice_reconciliations (id, invoice_id, registration_id, lip_document_id, idempotency_key, estimated_ut_amount, official_lip_amount, variance_amount, service_fee_snapshot, verified_paid_at_reconcile, shortage_created, credit_created, reconciled_by, status)
        VALUES ('${recId}'::uuid, '${invId}'::uuid, '${regId}'::uuid, '${lipDocId}'::uuid, gen_random_uuid(), 1300000, 1817600, 517600, 400000, 1700000, 517600, 0, '${ownerUid}'::uuid, 'active')
        ON CONFLICT (id) DO NOTHING;

        -- Pembayaran Terverifikasi Rp 1.700.000
        INSERT INTO public.student_payments (id, transaction_number, student_id, amount, payment_method_id, cash_account_id, status, verified_by, verified_at)
        VALUES ('${payId}'::uuid, 'PAY-CONCUR-01', '${studentId}'::uuid, 1700000, v_method_id, v_acc_id, 'verified', '${ownerUid}'::uuid, NOW())
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.payment_allocations (id, payment_id, invoice_id, amount)
        VALUES (gen_random_uuid(), '${payId}'::uuid, '${invId}'::uuid, 1700000)
        ON CONFLICT DO NOTHING;
      END $$;
    `);

    // 3. Hubungkan Client 1 dan Client 2
    const client1 = new Client({ connectionString });
    const client2 = new Client({ connectionString });

    await client1.connect();
    await client2.connect();

    // Set JWT claims dan role authenticated untuk kedua client
    const setAuthQuery = `
      SET ROLE authenticated;
      SET "request.jwt.claim.sub" TO '${ownerUid}';
    `;
    await client1.query(setAuthQuery);
    await client2.query(setAuthQuery);

    // Assertion Wajib: Periksa auth.uid(), role, dan is_active pada kedua koneksi
    const verifyIdentity = async (client, clientName) => {
      const res = await client.query(`
        SELECT 
          auth.uid() as current_uid,
          public.get_current_user_role() as current_role,
          public.is_current_user_active() as is_active;
      `);
      const row = res.rows[0];
      if (row.current_uid !== ownerUid || !['owner', 'admin'].includes(row.current_role) || row.is_active !== true) {
        throw new Error(`ASSERTION GAGAL pada ${clientName}: uid=${row.current_uid}, role=${row.current_role}, is_active=${row.is_active}`);
      }
      console.log(`[PASS] Identitas ${clientName} terverifikasi: role=${row.current_role}, active=${row.is_active}`);
    };

    await verifyIdentity(client1, 'Client 1');
    await verifyIdentity(client2, 'Client 2');

    console.log('Memulai 2 panggilan simultan dengan key yang sama...');

    // 4. Eksekusi panggilan simultan
    const callRpc = (client) => client.query(`
      SELECT public.correct_reconciled_lip(
        $1::uuid, 1300000, 0, 117600, 0,
        'Koreksi nominal LIP konkurensi: SPP keliru Rp 1.700.000 -> Rp 1.300.000',
        $2::uuid,
        $3::uuid
      ) as result;
    `, [lipDocId, sharedKey, recId]);

    const [res1, res2] = await Promise.allSettled([callRpc(client1), callRpc(client2)]);

    await client1.end();
    await client2.end();

    console.log('Client 1 status:', res1.status, res1.status === 'fulfilled' ? res1.value.rows[0].result : res1.reason.message);
    console.log('Client 2 status:', res2.status, res2.status === 'fulfilled' ? res2.value.rows[0].result : res2.reason.message);

    // Keduanya harus berhasil (satu new mutation, satu idempotent return)
    if (res1.status !== 'fulfilled' || res2.status !== 'fulfilled') {
      console.error('FATAL: Salah satu atau kedua client gagal/rejected.');
      process.exit(1);
    }

    const r1 = res1.value.rows[0].result;
    const r2 = res2.value.rows[0].result;

    const oneNewOneIdempotent = (r1.idempotent === false && r2.idempotent === true) ||
                                (r1.idempotent === true && r2.idempotent === false);

    if (!oneNewOneIdempotent) {
      console.error('FATAL: Tidak memenuhi syarat atomik (harus tepat satu mutasi baru dan satu respons idempoten):', { r1, r2 });
      process.exit(1);
    }
    console.log('[PASS] Verifikasi atomik: Tepat 1 mutasi baru dieksekusi dan 1 respons idempoten dikembalikan.');

    // 5. Validasi Angka Akhir & Integritas Data pada Database
    const checkRes = await clientSetup.query(`
      SELECT 
        (SELECT total_billed FROM public.get_invoice_canonical_totals('${invId}'::uuid)) as total_billed,
        (SELECT total_service_fee FROM public.get_invoice_canonical_totals('${invId}'::uuid)) as total_service_fee,
        (SELECT total_ut_liability FROM public.get_invoice_canonical_totals('${invId}'::uuid)) as total_ut_liability,
        (SELECT total_discount FROM public.get_invoice_canonical_totals('${invId}'::uuid)) as total_discount,
        (SELECT COUNT(*)::int FROM public.invoice_reconciliations WHERE invoice_id = '${invId}'::uuid AND status = 'active') as active_rec_count,
        (SELECT COUNT(*)::int FROM public.invoice_items WHERE invoice_id = '${invId}'::uuid AND item_type = 'discount' AND source_type = 'lip_reconciliation') as reversal_item_count,
        (SELECT COUNT(*)::int FROM public.invoice_items WHERE invoice_id = '${invId}'::uuid AND item_type = 'ut_liability' AND description LIKE '%(Terkoreksi)%') as new_shortage_item_count,
        (SELECT COALESCE(SUM(amount), 0)::bigint FROM public.payment_allocations WHERE invoice_id = '${invId}'::uuid) as total_paid_allocated,
        (SELECT COUNT(*)::int FROM public.audit_logs WHERE action = 'reconciliation_corrected' AND entity_type = 'invoice_reconciliation') as audit_count;
    `);

    const checks = checkRes.rows[0];
    console.log('Pemeriksaan Database Pasca-Koreksi:', checks);

    let failed = false;
    if (Number(checks.total_billed) !== 1817600) {
      console.error(`ERROR: total_billed diharapkan 1817600, aktual ${checks.total_billed}`);
      failed = true;
    }
    if (Number(checks.total_service_fee) !== 400000) {
      console.error(`ERROR: total_service_fee diharapkan 400000 (Komisi SALUT murni), aktual ${checks.total_service_fee}`);
      failed = true;
    }
    if (Number(checks.total_ut_liability) !== 1935200) {
      console.error(`ERROR: total_ut_liability bruto diharapkan 1935200, aktual ${checks.total_ut_liability}`);
      failed = true;
    }
    const netUtLiability = Number(checks.total_ut_liability) - Number(checks.total_discount);
    if (netUtLiability !== 1417600) {
      console.error(`ERROR: kewajiban UT bersih diharapkan 1417600, aktual ${netUtLiability}`);
      failed = true;
    }
    if (Number(checks.active_rec_count) !== 1) {
      console.error(`ERROR: active_rec_count diharapkan 1, aktual ${checks.active_rec_count}`);
      failed = true;
    }
    if (Number(checks.reversal_item_count) !== 1) {
      console.error(`ERROR: reversal_item_count diharapkan 1, aktual ${checks.reversal_item_count}`);
      failed = true;
    }
    if (Number(checks.new_shortage_item_count) !== 1) {
      console.error(`ERROR: new_shortage_item_count diharapkan 1, aktual ${checks.new_shortage_item_count}`);
      failed = true;
    }
    if (Number(checks.total_paid_allocated) !== 1700000) {
      console.error(`ERROR: total_paid_allocated diharapkan 1700000, aktual ${checks.total_paid_allocated}`);
      failed = true;
    }

    if (failed) {
      process.exit(1);
    }

    console.log('[PASS] Seluruh invariant database terbukti valid: Komisi SALUT Rp400.000, Kewajiban UT Bersih Rp1.417.600, Total Rp1.817.600, Pembayaran Rp1.700.000 utuh, Sisa Rp117.600.');

  } finally {
    // 6. Cleanup Fixture Uji Konkurensi Secara Terkontrol
    console.log('Membersihkan fixture lokal pengujian konkurensi...');
    await clientSetup.query(`
      DELETE FROM public.audit_logs WHERE entity_id IN (
        SELECT id FROM public.invoice_reconciliations WHERE invoice_id = '${invId}'::uuid
      );
      DELETE FROM public.payment_allocations WHERE invoice_id = '${invId}'::uuid;
      DELETE FROM public.student_payments WHERE id = '${payId}'::uuid;
      DELETE FROM public.invoice_items WHERE invoice_id = '${invId}'::uuid;
      DELETE FROM public.invoice_reconciliations WHERE invoice_id = '${invId}'::uuid;
      DELETE FROM public.invoices WHERE id = '${invId}'::uuid;
      DELETE FROM public.lip_documents WHERE id = '${lipDocId}'::uuid;
      DELETE FROM public.registrations WHERE id = '${regId}'::uuid;
      DELETE FROM public.students WHERE id = '${studentId}'::uuid;
      DELETE FROM public.user_roles WHERE user_id = '${ownerUid}'::uuid;
      DELETE FROM public.profiles WHERE id = '${ownerUid}'::uuid;
      DELETE FROM auth.users WHERE id = '${ownerUid}'::uuid;
    `);
    console.log('Fixture lokal berhasil dibersihkan.');
    await clientSetup.end();
  }
}

if (require.main === module) {
  runConcurrencyTest().catch((err) => {
    console.error('FATAL Unhandled Error:', err);
    process.exit(1);
  });
}
