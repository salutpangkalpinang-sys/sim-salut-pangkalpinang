# Dokumentasi Implementasi SIM-SALUT Pangkalpinang

Dokumen ini mencatat perkembangan teknis, arsitektur, migrasi database, dan status kriteria selesai (*Definition of Done*) dari pengerjaan proyek SIM-SALUT.

---

## Progress Checkpoint

- [x] **Checkpoint 1 — Foundation** (Selesai pada 13 Agustus 2026)
- [x] **Checkpoint 2 — Database Mahasiswa & Calon Mahasiswa** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 3 — Registrasi Semester & Snapshot Tarif** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 4 — Upload LIP & Invoice Tagihan** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 5 — Pembayaran Mahasiswa, Verifikasi, Void & Bukti Pembayaran** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 6 — Setoran / Pembayaran SALUT ke UT** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 7A — Kas & Transaksi Operasional** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 7B — Dashboard KPI Final, Laporan & CSV Export Engine** (Selesai pada 14 Agustus 2026)
- [x] **Checkpoint 8 — Final Hardening, Security QA & Regression** (Selesai pada 14 Agustus 2026)

---

## Checkpoint 8: Final Hardening & QA Summary

### 1. Database & Search Path Security (`20260814000007_checkpoint8_final_hardening.sql`)
- Menambahkan `SET search_path = public, pg_temp;` pada seluruh stored procedure PostgreSQL (`SECURITY DEFINER`) legacy untuk mencegah eksploitasi search path.
- Mempertegas perlindungan `ON DELETE RESTRICT` pada tabel ledger transaksi terverifikasi.

### 2. Magic-Byte Server-Side File Signature Validation
- Mengintegrasikan utilitas `validateFileMagicBytes()` pada handler server actions (LIP, Pembayaran Mahasiswa, Setoran UT, dan Kas Operasional).
- Berkas berekstensi/MIME palsu (misalnya `.exe` yang diubah namanya menjadi `.pdf`) ditolak di server-side sebelum diunggah ke storage.

### 3. Deterministic Financial Reconciliation Fixture
- Pengujian otomatis komprehensif pada [`src/lib/validation/__tests__/checkpoint8-final-qa.test.ts`](file:///e:/Document%20Project%20Aplikasi/Salut/src/lib/validation/__tests__/checkpoint8-final-qa.test.ts) membuktikan seluruh kalkulasi indikator keuangan (Invoices Billed, Student Receipts, Receivables, UT Liability, UT Remittances, Service Fees Billed, Operational Income/Expense, dan Net Cash Movement) 100% presisi dan konsisten.

### 4. QA Report Documentation
- Laporan QA resmi disajikan pada dokumen [`docs/QA_REPORT.md`](file:///e:/Document%20Project%20Aplikasi/Salut/docs/QA_REPORT.md) dengan status rekomendasi akhir **GO FOR DEPLOYMENT**.

---

## Dashboard Metric Definitions

Setiap KPI pada Dashboard dan Laporan SIM-SALUT memiliki definisi, sumber tabel, dan filter status yang transparan dan dapat diaudit:

### 1. Mahasiswa Aktif
- **Formula**: `COUNT(students)` di mana `student_statuses.code = 'aktif'`.
- **Source Tables**: `public.students` JOIN `public.student_statuses`.
- **Included Statuses**: Status mahasiswa `'aktif'`.
- **Excluded Statuses**: Calon, Cuti, Lulus, Non-aktif, Drop Out.

### 2. Calon Mahasiswa
- **Formula**: `COUNT(students)` di mana `student_statuses.code = 'calon'`.
- **Source Tables**: `public.students` JOIN `public.student_statuses`.
- **Included Statuses**: Status mahasiswa `'calon'`.

### 3. Registrasi Semester
- **Formula**: `COUNT(registrations)` pada periode akademik terpilih.
- **Source Tables**: `public.registrations`.
- **Included Statuses**: Draft, Submitted, Verified.
- **Excluded Statuses**: `cancelled`.

### 4. Total Tagihan
- **Formula**: `SUM(ut_liability + service_fee + internal_fee - approved_discount)` per invoice aktif.
- **Source Tables**: `public.invoices` JOIN `public.invoice_items`.
- **Included Statuses**: Invoice non-cancelled, Approved discounts.
- **Excluded Statuses**: Cancelled invoices, Pending/unapproved discounts.

### 5. Penerimaan Mahasiswa
- **Formula**: `SUM(student_payments.amount)` untuk seluruh pembayaran mahasiswa terverifikasi.
- **Source Tables**: `public.student_payments`.
- **Included Statuses**: Payment status `'verified'`.
- **Excluded Statuses**: Draft, Pending, Rejected, Voided.
- **Keterangan**: Memakai nominal pembayaran penuh (termasuk unallocated overpayment yang merupakan kas nyata masuk ke SALUT).

### 6. Piutang Mahasiswa
- **Formula**: `SUM(MAX(derived_invoice_total - verified_payment_allocations, 0))` untuk tagihan aktif.
- **Source Tables**: `public.invoices`, `public.invoice_items`, `public.payment_allocations`, `public.student_payments`.
- **Included Statuses**: Invoice non-cancelled, Payment allocations from `verified` payments.
- **Excluded Statuses**: Cancelled invoices, Pending/rejected/voided payments.

### 7. Kewajiban UT
- **Formula**: `SUM(lip_documents.official_amount)`.
- **Source Tables**: `public.lip_documents`.
- **Included Statuses**: LIP status `'verified'` dan `'paid_to_ut'`.
- **Excluded Statuses**: Draft, Pending verification, Cancelled.

### 8. Setoran ke UT
- **Formula**: `SUM(ut_remittance_items.amount)` dengan parent setoran terverifikasi.
- **Source Tables**: `public.ut_remittance_items` JOIN `public.ut_remittances`.
- **Included Statuses**: UT Remittance status `'verified'`.
- **Excluded Statuses**: Draft, Pending verification, Rejected, Voided.

### 9. Kewajiban UT Belum Disetor (Outstanding UT)
- **Formula**: `SUM(MAX(official_amount - verified_ut_paid, 0))` per LIP resmi.
- **Source Tables**: `public.lip_documents`, `public.ut_remittance_items`, `public.ut_remittances`.
- **Included Statuses**: LIP status `'verified'` atau `'paid_to_ut'`, UT Remittance status `'verified'`.

### 10. Biaya Layanan SALUT Ditagihkan
- **Formula**: `SUM(amount)` dari `invoice_items` dengan `item_type = 'service_fee'` pada tagihan aktif.
- **Source Tables**: `public.invoice_items` JOIN `public.invoices`.
- **Included Statuses**: Service fee items pada invoice non-cancelled.
- **Qualifier**: *"Nilai biaya layanan pada tagihan aktif, bukan berarti seluruhnya sudah diterima sebagai kas."* Dilarang diklaim sebagai cash received.

### 11. Pemasukan Operasional
- **Formula**: `SUM(operational_transactions.amount)` di mana `transaction_type = 'income'`.
- **Source Tables**: `public.operational_transactions`.
- **Included Statuses**: Status `'verified'`.

### 12. Pengeluaran Operasional
- **Formula**: `SUM(operational_transactions.amount)` di mana `transaction_type = 'expense'`.
- **Source Tables**: `public.operational_transactions`.
- **Included Statuses**: Status `'verified'`.

### 13. Arus Kas Bersih (Net Cash Movement)
- **Formula**: `(Penerimaan Mahasiswa Terverifikasi + Pemasukan Operasional Terverifikasi) - (Setoran UT Terverifikasi + Pengeluaran Operasional Terverifikasi)`.
- **Source Tables**: Derived dari 4 komponen kas terverifikasi di atas.
- **Qualifier**: *"Pergerakan kas bersih pada periode terpilih. Bukan laba/rugi."* Dilarang diklaim atau dilabeli sebagai profit/laba.
