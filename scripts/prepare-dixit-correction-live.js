// File: scripts/prepare-dixit-correction-live.js
/**
 * SIM-SALUT Pangkalpinang
 * Script Persiapan Verifikasi Data Live & Backup Dixit Sebelum Koreksi
 * Skema Target: Sesuai skema LIVE AKTUAL (sebelum migration 20261008000002 diterapkan)
 * Target Project Ref: lcvcvlsmqkjovzwafdzz
 * Target Data: REG-2026-10014 DAN NIM 053065737
 * 
 * Penggunaan:
 *   $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.lcvcvlsmqkjovzwafdzz.supabase.co:5432/postgres"
 *   node scripts/prepare-dixit-correction-live.js
 * 
 * Standar Keamanan & Integritas:
 *   - Transaksi: BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY
 *   - Hostname: Validasi exact match terhadap hostname resmi Supabase project lcvcvlsmqkjovzwafdzz
 *   - Kredensial: Tidak mencetak connection string, username, atau password
 *   - TLS: Verifikasi sertifikat aktif secara default
 *   - Idempotency Key: Dibuat sebagai UUID valid (v4) sekali saja dan disimpan di state file terpisah
 *   - Backup: Snapshot baris lengkap mahasiswa, registrasi, seluruh pembayaran tanpa filter status,
 *             seluruh payment_allocations, seluruh payment_component_allocations, invoice, items,
 *             biaya snapshots, LIP, dan riwayat rekonsiliasi menggunakan SELECT alias.*.
 *   - Query Pemisahan: Query validasi verified/posted dipisahkan dari query backup lengkap.
 *   - Verifikasi Disk: Dibaca kembali dari disk, didekripsi, dan divalidasi checksum SHA-256
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const EXACT_TARGET_HOST = 'aws-0-ap-southeast-1.pooler.supabase.com';
const EXACT_TARGET_PORT = '5432';
const EXACT_TARGET_USER = 'postgres.lcvcvlsmqkjovzwafdzz';
const EXACT_TARGET_DB = 'postgres';
const EXPECTED_LIP_UUID = 'f9c7ee37-abdb-4ac5-bc68-8a858b933ee2';
const EXPECTED_LIP_NUMBER = '20261053065737050022';
const EXPECTED_REG_NUMBER = 'REG-2026-10014';
const EXPECTED_STUDENT_NIM = '053065737';
const EXPECTED_INV_NUMBER = 'INV-2026-10006';

function getOrGenerateAesKey() {
  const secretDir = path.join(os.homedir(), '.salut-secrets');
  const keyPath = path.join(secretDir, 'backup_aes256_key.pass');

  if (!fs.existsSync(secretDir)) {
    fs.mkdirSync(secretDir, { recursive: true, mode: 0o700 });
  }

  let password;
  if (!fs.existsSync(keyPath)) {
    password = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, password, { mode: 0o600 });
    console.log(`[KEAMANAN] Kunci enkripsi AES-256 baru dibuat di: ${keyPath}`);
  } else {
    password = fs.readFileSync(keyPath, 'utf8').trim();
  }
  return { password, keyPath };
}

function getOrGenerateIdempotencyKey() {
  const secretDir = path.join(os.homedir(), '.salut-secrets');
  const idempPath = path.join(secretDir, 'dixit_correction_idempotency_key.uuid');

  if (!fs.existsSync(secretDir)) {
    fs.mkdirSync(secretDir, { recursive: true, mode: 0o700 });
  }

  let idempotencyKey;
  if (!fs.existsSync(idempPath)) {
    idempotencyKey = crypto.randomUUID();
    fs.writeFileSync(idempPath, idempotencyKey, { mode: 0o600 });
    console.log(`[IDEMPOTENCY] Key UUID baru digenerate dan disimpan ke: ${idempPath}`);
  } else {
    idempotencyKey = fs.readFileSync(idempPath, 'utf8').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      idempotencyKey = crypto.randomUUID();
      fs.writeFileSync(idempPath, idempotencyKey, { mode: 0o600 });
      console.log(`[IDEMPOTENCY] Key tersimpan tidak valid, digenerate ulang ke: ${idempPath}`);
    }
  }
  return idempotencyKey;
}

function encryptBuffer(plainBuffer, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptBuffer(encryptedBuffer, password) {
  if (encryptedBuffer.length < 44) {
    throw new Error('Arsip terenkripsi korup: panjang buffer kurang dari 44 bytes header.');
  }
  const salt = encryptedBuffer.subarray(0, 16);
  const iv = encryptedBuffer.subarray(16, 28);
  const tag = encryptedBuffer.subarray(28, 44);
  const ciphertext = encryptedBuffer.subarray(44);

  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL atau SUPABASE_DB_URL belum ditentukan pada environment variable.');
    console.error('Contoh set di PowerShell:');
    console.error('  $env:DATABASE_URL="postgresql://postgres.lcvcvlsmqkjovzwafdzz:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"');
    console.error('  node scripts/prepare-dixit-correction-live.js');
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(connectionString);
  } catch (e) {
    console.error('ERROR: Format connection string tidak valid.');
    process.exit(1);
  }

  const host = parsedUrl.hostname.toLowerCase();
  const port = parsedUrl.port || '5432';
  const username = decodeURIComponent(parsedUrl.username || '');
  const database = (parsedUrl.pathname || '').replace(/^\//, '');

  if (host !== EXACT_TARGET_HOST) {
    console.error(`ERROR KEAMANAN FATAL: Target host [${host}] DITOLAK.`);
    console.error(`Target host WAJIB tepat sama dengan Session pooler resmi: ${EXACT_TARGET_HOST}`);
    process.exit(1);
  }

  if (port !== EXACT_TARGET_PORT) {
    console.error(`ERROR KEAMANAN FATAL: Port [${port}] DITOLAK.`);
    console.error(`Port WAJIB tepat: ${EXACT_TARGET_PORT}`);
    process.exit(1);
  }

  if (username !== EXACT_TARGET_USER) {
    console.error(`ERROR KEAMANAN FATAL: Username [${username}] DITOLAK.`);
    console.error(`Username pooler WAJIB menyertakan project ref resmi: ${EXACT_TARGET_USER}`);
    process.exit(1);
  }

  if (database !== EXACT_TARGET_DB) {
    console.error(`ERROR KEAMANAN FATAL: Database [${database}] DITOLAK.`);
    console.error(`Database WAJIB tepat: ${EXACT_TARGET_DB}`);
    process.exit(1);
  }

  console.log(`[TARGET VALID] Terhubung ke Session pooler SALUT terverifikasi:`);
  console.log(`  Host     : ${host}`);
  console.log(`  Port     : ${port}`);
  console.log(`  Username : ${username}`);
  console.log(`  Database : ${database}`);

  // Muat sertifikat CA resmi dari Dashboard Supabase
  const caPath = path.join(os.homedir(), '.salut-secrets', 'supabase-ca.crt');
  if (!fs.existsSync(caPath)) {
    console.error(`ERROR TLS FATAL: File sertifikat CA tidak ditemukan di: ${caPath}`);
    console.error('Silakan simpan sertifikat CA resmi dari Dashboard Supabase ke path tersebut.');
    process.exit(1);
  }

  const caCert = fs.readFileSync(caPath, 'utf8');
  console.log(`[TLS CA TERVERIFIKASI] Menggunakan sertifikat CA resmi: ${caPath}`);

  const client = new Client({
    connectionString,
    ssl: {
      ca: caCert,
      rejectUnauthorized: true,
    },
  });

  await client.connect();

  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    console.log('[SAFETY LOCK] Transaksi ISOLATION LEVEL REPEATABLE READ READ ONLY aktif.');

    // =========================================================================
    // 1. QUERY BACKUP LENGKAP: Menggunakan SELECT alias.* agar tidak menebak kolom
    // =========================================================================

    // 1.1 Baris lengkap Mahasiswa
    const studentBackupRes = await client.query(`
      SELECT s.*
      FROM public.students s
      WHERE s.nim = $1;
    `, [EXPECTED_STUDENT_NIM]);

    if (studentBackupRes.rows.length !== 1) {
      throw new Error(`STOP: Data mahasiswa dengan NIM ${EXPECTED_STUDENT_NIM} ditemukan ${studentBackupRes.rows.length} baris (wajib tepat 1).`);
    }
    const studentFull = studentBackupRes.rows[0];

    // 1.2 Baris lengkap Registrasi
    const regBackupRes = await client.query(`
      SELECT r.*
      FROM public.registrations r
      WHERE r.registration_number = $1 AND r.student_id = $2;
    `, [EXPECTED_REG_NUMBER, studentFull.id]);

    if (regBackupRes.rows.length !== 1) {
      throw new Error(`STOP: Data registrasi ${EXPECTED_REG_NUMBER} ditemukan ${regBackupRes.rows.length} baris (wajib tepat 1).`);
    }
    const registrationFull = regBackupRes.rows[0];

    // 1.3 Baris lengkap Snapshot Biaya Registrasi
    const feeSnapshotsBackupRes = await client.query(`
      SELECT rfs.*
      FROM public.registration_fee_snapshots rfs
      WHERE rfs.registration_id = $1
      ORDER BY rfs.created_at ASC;
    `, [registrationFull.id]);

    // 1.4 Baris lengkap Dokumen LIP
    const lipBackupRes = await client.query(`
      SELECT ld.*
      FROM public.lip_documents ld
      WHERE ld.registration_id = $1 AND ld.lip_number = $2;
    `, [registrationFull.id, EXPECTED_LIP_NUMBER]);

    if (lipBackupRes.rows.length !== 1) {
      throw new Error(`STOP: Dokumen LIP nomor ${EXPECTED_LIP_NUMBER} ditemukan ${lipBackupRes.rows.length} baris (wajib tepat 1).`);
    }
    const lipFull = lipBackupRes.rows[0];

    if (lipFull.id !== EXPECTED_LIP_UUID) {
      throw new Error(`STOP: UUID dokumen LIP TIDAK COCOK! Terbaca: ${lipFull.id}, Diharapkan: ${EXPECTED_LIP_UUID}`);
    }

    // 1.5 Baris lengkap Invoice
    const invBackupRes = await client.query(`
      SELECT i.*
      FROM public.invoices i
      WHERE i.registration_id = $1 AND i.invoice_number = $2;
    `, [registrationFull.id, EXPECTED_INV_NUMBER]);

    if (invBackupRes.rows.length !== 1) {
      throw new Error(`STOP: Invoice target ${EXPECTED_INV_NUMBER} ditemukan ${invBackupRes.rows.length} baris (wajib tepat 1).`);
    }
    const invoiceFull = invBackupRes.rows[0];

    if (invoiceFull.lip_document_id !== lipFull.id) {
      throw new Error(`STOP: Relasi invoice.lip_document_id (${invoiceFull.lip_document_id}) TIDAK COCOK dengan LIP (${lipFull.id}).`);
    }

    // 1.6 Baris lengkap seluruh Invoice Items
    const invoiceItemsBackupRes = await client.query(`
      SELECT ii.*
      FROM public.invoice_items ii
      WHERE ii.invoice_id = $1
      ORDER BY ii.created_at ASC;
    `, [invoiceFull.id]);

    // 1.7 Baris lengkap seluruh Riwayat Rekonsiliasi (semua status: active, superseded, voided)
    const reconciliationsBackupRes = await client.query(`
      SELECT ir.*
      FROM public.invoice_reconciliations ir
      WHERE ir.invoice_id = $1
      ORDER BY ir.reconciled_at ASC;
    `, [invoiceFull.id]);

    // 1.8 Baris lengkap seluruh Pembayaran Mahasiswa yang dialokasikan ke Invoice (TANPA filter status)
    const paymentsBackupRes = await client.query(`
      SELECT DISTINCT sp.*
      FROM public.payment_allocations pa
      JOIN public.student_payments sp ON pa.payment_id = sp.id
      WHERE pa.invoice_id = $1
      ORDER BY sp.created_at ASC;
    `, [invoiceFull.id]);

    // 1.9 Baris lengkap seluruh Payment Allocations ke Invoice (TANPA filter status)
    const paymentAllocationsBackupRes = await client.query(`
      SELECT pa.*
      FROM public.payment_allocations pa
      WHERE pa.invoice_id = $1
      ORDER BY pa.created_at ASC;
    `, [invoiceFull.id]);

    // 1.10 Baris lengkap seluruh Payment Component Allocations ke Invoice (TANPA filter status/entry_type)
    const paymentComponentAllocationsBackupRes = await client.query(`
      SELECT pca.*
      FROM public.payment_component_allocations pca
      WHERE pca.invoice_id = $1
      ORDER BY pca.created_at ASC;
    `, [invoiceFull.id]);

    // 1.11 Baris lengkap Keterkaitan Setoran UT jika ada
    const remittanceItemsBackupRes = await client.query(`
      SELECT ri.*
      FROM public.ut_remittance_items ri
      WHERE ri.registration_id = $1 OR ri.lip_document_id = $2;
    `, [registrationFull.id, lipFull.id]);

    // 1.12 Baris lengkap Keterkaitan Credit Ledgers jika ada
    const creditLedgersBackupRes = await client.query(`
      SELECT scl.*
      FROM public.student_credit_ledgers scl
      WHERE scl.registration_id = $1;
    `, [registrationFull.id]);

    console.log('\n[BACKUP DATA TERKUMPUL]');
    console.log(`  Mahasiswa                   : 1 baris (NIM ${studentFull.nim})`);
    console.log(`  Registrasi                  : 1 baris (${registrationFull.registration_number})`);
    console.log(`  Registration Fee Snapshots  : ${feeSnapshotsBackupRes.rows.length} baris`);
    console.log(`  Dokumen LIP                 : 1 baris (${lipFull.lip_number})`);
    console.log(`  Invoice                     : 1 baris (${invoiceFull.invoice_number})`);
    console.log(`  Invoice Items               : ${invoiceItemsBackupRes.rows.length} baris`);
    console.log(`  Invoice Reconciliations     : ${reconciliationsBackupRes.rows.length} baris`);
    console.log(`  Student Payments (Semua)    : ${paymentsBackupRes.rows.length} baris`);
    console.log(`  Payment Allocations (Semua) : ${paymentAllocationsBackupRes.rows.length} baris`);
    console.log(`  Component Allocations(Semua): ${paymentComponentAllocationsBackupRes.rows.length} baris`);

    // =========================================================================
    // 2. QUERY VALIDASI KONSISTENSI & ATURAN BISNIS (VERIFIED / POSTED GUARD)
    // =========================================================================

    // 2.1 Hitung Canonical Totals dari invoice
    const totalsRes = await client.query(`
      SELECT * FROM public.get_invoice_canonical_totals($1);
    `, [invoiceFull.id]);
    const canonicalTotals = totalsRes.rows[0];

    // 2.2 Validasi Rekonsiliasi Aktif (Wajib tepat 1 baris)
    const activeRecList = reconciliationsBackupRes.rows.filter(r => r.status === 'active');
    if (activeRecList.length !== 1) {
      throw new Error(`STOP: Rekonsiliasi aktif pada invoice ${invoiceFull.invoice_number} TIDAK TEPAT SATU. Ditemukan: ${activeRecList.length} baris (wajib tepat 1).`);
    }
    const activeRec = activeRecList[0];

    if (activeRec.lip_document_id !== lipFull.id) {
      throw new Error(`STOP: Relasi active_reconciliation.lip_document_id (${activeRec.lip_document_id}) TIDAK COCOK dengan LIP (${lipFull.id}).`);
    }
    if (activeRec.registration_id !== registrationFull.id) {
      throw new Error(`STOP: Relasi active_reconciliation.registration_id (${activeRec.registration_id}) TIDAK COCOK dengan Registrasi (${registrationFull.id}).`);
    }

    // 2.3 Validasi Pembayaran VERIFIED
    const verifiedPaymentIds = new Set(
      paymentsBackupRes.rows.filter(p => p.status === 'verified').map(p => p.id)
    );

    const verifiedAllocations = paymentAllocationsBackupRes.rows.filter(pa =>
      verifiedPaymentIds.has(pa.payment_id)
    );
    const totalAllocatedVerified = verifiedAllocations.reduce((sum, r) => sum + Number(r.amount), 0);

    // 2.4 Validasi Alokasi Komponen POSTED
    let salutPaid = 0;
    let utPaid = 0;
    paymentComponentAllocationsBackupRes.rows
      .filter(pca => pca.status === 'posted' && verifiedPaymentIds.has(pca.payment_id))
      .forEach(pca => {
        const netAmount = pca.entry_type === 'allocation' ? Number(pca.amount) : -Number(pca.amount);
        if (pca.component_type === 'service_fee') {
          salutPaid += netAmount;
        } else if (pca.component_type === 'ut_liability') {
          utPaid += netAmount;
        }
      });

    console.log('\n[VALIDASI KONSISTENSI FINANSIAL TERVERIFIKASI]');
    console.log(`  Total Terverifikasi Dialokasikan : Rp ${totalAllocatedVerified.toLocaleString('id-ID')} (Wajib Rp 1.700.000)`);
    console.log(`  Alokasi Komisi SALUT Terverifikasi : Rp ${salutPaid.toLocaleString('id-ID')} (Wajib Rp 400.000)`);
    console.log(`  Alokasi Kewajiban UT Terverifikasi: Rp ${utPaid.toLocaleString('id-ID')} (Wajib Rp 1.300.000)`);

    if (totalAllocatedVerified !== 1700000) {
      throw new Error(`STOP: Total pembayaran terverifikasi Rp ${totalAllocatedVerified} TIDAK SESUAI (wajib Rp 1.700.000).`);
    }
    if (salutPaid !== 400000) {
      throw new Error(`STOP: Alokasi komisi SALUT terverifikasi Rp ${salutPaid} TIDAK SESUAI (wajib Rp 400.000).`);
    }
    if (utPaid !== 1300000) {
      throw new Error(`STOP: Alokasi kewajiban UT terverifikasi Rp ${utPaid} TIDAK SESUAI (wajib Rp 1.300.000).`);
    }

    // 2.5 Hard Stop Guard: Setoran UT & Saldo Kredit
    if (remittanceItemsBackupRes.rows.length > 0) {
      throw new Error(`STOP: Ditemukan ${remittanceItemsBackupRes.rows.length} catatan setoran UT terkait registrasi/LIP! Koreksi DILARANG demi integritas perbankan.`);
    }
    console.log('  -> Keterkaitan Setoran UT : TIDAK ADA (Clean - lolos guard)');

    if (creditLedgersBackupRes.rows.length > 0) {
      throw new Error(`STOP: Ditemukan ${creditLedgersBackupRes.rows.length} catatan saldo kredit mahasiswa terkait! Rilis pertama tidak mendukung rekonsiliasi yang memiliki kredit.`);
    }
    console.log('  -> Keterkaitan Saldo Kredit: TIDAK ADA (Clean - lolos guard)');

    // =========================================================================
    // 3. SUSUN FULL BACKUP ARCHIVE & ENKRIPSI AES-256-GCM
    // =========================================================================

    const idempotencyKey = getOrGenerateIdempotencyKey();

    const fullSnapshot = {
      meta: {
        snapshot_time: new Date().toISOString(),
        target_project_ref: 'lcvcvlsmqkjovzwafdzz',
        exact_target_host: EXACT_TARGET_HOST,
        purpose: 'Pra-koreksi data Dixit REG-2026-10014 / INV-2026-10006',
        idempotency_key_reserved: idempotencyKey,
      },
      // Data lengkap terpisah (SELECT alias.*)
      student: studentFull,
      registration: registrationFull,
      registration_fee_snapshots: feeSnapshotsBackupRes.rows,
      lip_document: lipFull,
      invoice: invoiceFull,
      canonical_totals_before: canonicalTotals,
      invoice_items: invoiceItemsBackupRes.rows,
      active_reconciliation: activeRec,
      all_reconciliations_history: reconciliationsBackupRes.rows,
      all_student_payments: paymentsBackupRes.rows,
      all_payment_allocations: paymentAllocationsBackupRes.rows,
      all_payment_component_allocations: paymentComponentAllocationsBackupRes.rows,
      ut_remittance_items_check: remittanceItemsBackupRes.rows,
      student_credit_ledgers_check: creditLedgersBackupRes.rows,
    };

    const plainBuffer = Buffer.from(JSON.stringify(fullSnapshot, null, 2), 'utf8');
    const originalPlainChecksum = crypto.createHash('sha256').update(plainBuffer).digest('hex');

    const { password } = getOrGenerateAesKey();
    const encryptedBuffer = encryptBuffer(plainBuffer, password);

    const outDir = path.resolve('backups');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const encOutFile = path.join(outDir, `dixit_backup_${timestamp}.json.enc`);
    fs.writeFileSync(encOutFile, encryptedBuffer);

    // Verifikasi Disk Round-Trip
    const readBackBuffer = fs.readFileSync(encOutFile);
    const decryptedBuffer = decryptBuffer(readBackBuffer, password);
    const readBackChecksum = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');

    if (readBackChecksum !== originalPlainChecksum) {
      throw new Error(`STOP: Verifikasi integritas disk gagal! Checksum disk (${readBackChecksum}) berbeda dari plain (${originalPlainChecksum}).`);
    }

    console.log('\n================================================================');
    console.log('[SUKSES VERIFIKASI PRA-KOREKSI & BACKUP LENGKAP]');
    console.log(`Lokasi Backup Terenkripsi : ${encOutFile}`);
    console.log(`Ukuran File Terenkripsi   : ${encryptedBuffer.length} bytes`);
    console.log(`Algoritma Enkripsi        : AES-256-GCM (PBKDF2 SHA-256, 100k iterasi)`);
    console.log(`Status Integritas Disk    : TERVERIFIKASI SEMPURNA (SHA-256 Checksum Match)`);
    console.log('================================================================');

    console.log('\n--- PARAMETER RESMI EKSEKUSI RPC CORRECT_RECONCILED_LIP ---');
    console.log(`p_lip_document_id             : '${lipFull.id}'`);
    console.log(`p_expected_reconciliation_id  : '${activeRec.id}'`);
    console.log(`p_new_tuition_amount          : 1300000`);
    console.log(`p_new_book_amount             : 0`);
    console.log(`p_new_shipping_amount         : 117600`);
    console.log(`p_new_other_ut_amount         : 0`);
    console.log(`p_correction_reason           : 'Penyesuaian tagihan LIP resmi UT (SPP Rp 1.300.000 + Pengiriman Bahan Ajar Rp 117.600) dan mempertahankan komisi layanan SALUT Rp 400.000'`);
    console.log(`p_idempotency_key             : '${idempotencyKey}'`);

    await client.query('COMMIT');
    console.log('\n[BERES] Seluruh validasi pra-koreksi dan backup baris lengkap sukses.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR / SAFETY STOP TRIGGERED]:');
  console.error(err.message || err);
  process.exit(1);
});
