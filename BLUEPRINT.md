# Blueprint: SIM-SALUT Pangkalpinang

## 1. Overview

SIM-SALUT Pangkalpinang adalah aplikasi web internal untuk mengelola data mahasiswa, registrasi semester, LIP, tagihan internal SALUT, pembayaran mahasiswa, setoran ke UT, pemasukan/pengeluaran operasional, laporan, serta audit aktivitas pengguna.

Masalah utama yang diselesaikan:
- Data mahasiswa tersebar di banyak file Excel per angkatan.
- Pencatatan pembayaran berawal dari catatan kertas lalu dipindahkan ke spreadsheet.
- Pembayaran bertahap, sisa tagihan, dan kewajiban ke UT sulit dilacak.
- Perubahan tarif dan histori registrasi rawan menimpa data lama.
- Pimpinan sulit memperoleh gambaran keuangan yang dapat diaudit.

Target user:
- Owner/Pimpinan
- Admin Akademik
- Admin Keuangan/Kasir
- Viewer/Auditor

Aplikasi bersifat internal pada MVP. Mahasiswa belum memiliki akun.

---

## 2. Prinsip Utama Sistem

1. Semua nominal uang disimpan sebagai integer Rupiah.
2. LIP terverifikasi menjadi sumber resmi kewajiban kepada UT.
3. Master tarif hanya untuk estimasi dan validasi awal.
4. Tarif pada registrasi harus disimpan sebagai snapshot.
5. Pembayaran terverifikasi tidak boleh dihapus permanen.
6. Koreksi transaksi dilakukan melalui void/pembatalan/adjustment resmi.
7. Saldo dan sisa tagihan harus dapat dihitung ulang dari sumber transaksi.
8. Pembayaran mahasiswa ke SALUT dipisahkan dari setoran SALUT ke UT.
9. Seluruh tabel yang terekspos melalui Supabase memakai RLS.
10. Otorisasi diverifikasi di server, bukan hanya melalui UI.
11. Dokumen sensitif disimpan dalam private storage.
12. Audit log untuk aksi penting tidak dapat diubah oleh admin biasa.
13. UI menggunakan Bahasa Indonesia.
14. Zona waktu bisnis Asia/Jakarta.

---

## 3. MVP Core Capabilities

### MVP Core 1 — Database Mahasiswa

Mencakup:
- Authentication
- Role & permission
- Master akademik
- Calon mahasiswa
- Mahasiswa
- Pencarian dan filter
- Status mahasiswa
- Riwayat status

Tujuan:
Menggantikan database mahasiswa yang tersebar di Excel.

### MVP Core 2 — Registrasi sampai Pembayaran

Alur utama:

Mahasiswa
→ Registrasi Semester
→ Snapshot Tarif
→ LIP
→ Tagihan SALUT
→ Pembayaran Mahasiswa
→ Verifikasi
→ Setoran UT

Tujuan:
Membuat seluruh proses tagihan dan pembayaran dapat dilacak.

### MVP Core 3 — Kontrol Keuangan

Mencakup:
- Dashboard keuangan
- Piutang mahasiswa
- Kewajiban UT
- Setoran UT
- Pendapatan biaya layanan SALUT
- Kas & operasional
- Audit log
- Laporan dan export CSV

Tujuan:
Memberikan satu sumber informasi operasional dan keuangan yang dapat diaudit.

---

## 4. Role dan Hak Akses

### Owner / Pimpinan

Dapat:
- Melihat seluruh dashboard.
- Melihat seluruh data dan laporan.
- Melihat ringkasan keuangan.
- Mengelola pengguna dan hak akses.
- Mengakses audit log.
- Menyetujui tindakan sensitif.

### Admin Akademik

Dapat:
- Mengelola calon mahasiswa.
- Mengelola mahasiswa.
- Mengelola registrasi.
- Mengelola master akademik sesuai izin.
- Mengelola LIP sesuai izin.

Tidak dapat:
- Menghapus pembayaran terverifikasi.
- Mengubah transaksi keuangan sensitif tanpa alur resmi.

### Admin Keuangan / Kasir

Dapat:
- Mencatat pembayaran mahasiswa.
- Mengunggah bukti pembayaran.
- Memverifikasi pembayaran sesuai izin.
- Mencatat setoran ke UT.
- Mencatat kas dan transaksi operasional.
- Mencetak atau mengunduh bukti pembayaran.

### Viewer / Auditor

Dapat:
- Melihat data dan laporan sesuai ruang lingkup.

Tidak dapat:
- Membuat data.
- Mengubah data.
- Menghapus data.

---

## 5. Asumsi Awal

### A1 — Single Organization

MVP hanya digunakan oleh SALUT Pangkalpinang.

### A2 — User Internal

Tidak ada public sign-up. Pengguna dibuat atau diundang oleh administrator.

### A3 — Registrasi Sebagai Pusat Transaksi

Sebagian besar proses akademik dan keuangan terkait pada `registration`.

### A4 — Tarif Selalu Di-snapshot

Perubahan master tarif tidak mengubah histori registrasi lama.

### A5 — Verified Payment Immutable

Setelah pembayaran terverifikasi:
- nominal tidak diedit;
- transaksi tidak dihapus;
- koreksi melalui alur void/cancellation/adjustment.

### A6 — Integer Rupiah

Contoh penyimpanan:
`400000`

Bukan:
`400000.00`

### A7 — Private Documents

LIP, bukti transfer, dan dokumen mahasiswa disimpan dalam bucket private.

---

## 6. Keputusan Blocking

Keputusan berikut harus dikonfirmasi sebelum implementasi modul keuangan penuh.

### B1 — Versi LIP

Rekomendasi:
Satu registrasi dapat memiliki beberapa versi LIP, tetapi hanya satu LIP aktif/terverifikasi.

### B2 — Payment Allocation

Rekomendasi:
Database mendukung satu pembayaran dialokasikan ke beberapa invoice, tetapi UI MVP dapat dimulai dengan satu tagihan per transaksi.

### B3 — Kelebihan Bayar

Rekomendasi:
Kelebihan bayar tetap tercatat dan dapat:
- menjadi kredit mahasiswa; atau
- direfund melalui transaksi resmi.

### B4 — Approval Owner

Rekomendasi approval Owner diperlukan untuk:
- void pembayaran terverifikasi;
- void setoran UT terverifikasi;
- adjustment/potongan setelah invoice diterbitkan;
- perubahan role pengguna.

### B5 — NIK

Rekomendasi:
NIK opsional. Jika diisi harus unik.

### B6 — Migrasi Data Lama

Rekomendasi:
Gunakan strategi cut-off untuk launch awal, kemudian histori lama diimpor bertahap melalui proses preview dan validasi.

### B7 — Biaya Layanan SALUT

Nilai awal Rp400.000 tidak boleh di-hard-code.

Struktur tarif harus dapat berbeda berdasarkan:
- periode;
- jenis registrasi;
- program studi;
- skema layanan;
- kebijakan lain di masa depan.

---

## 7. Tech Stack

Gunakan stack berikut kecuali repository sudah memiliki stack setara:

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui atau komponen accessible setara
- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- Zod
- Vercel

---

## 8. Application Architecture

```text
Browser
  ↓
Next.js UI
  ↓
Server Components / Server Actions / Route Handlers
  ↓
Server-side Authorization + Zod Validation
  ↓
Supabase
  ├── Auth
  ├── PostgreSQL
  ├── Row Level Security
  └── Private Storage
```

Security layers:

```text
UI permission
  ↓
Server authorization
  ↓
Database RLS
```

Menyembunyikan tombol di UI bukan mekanisme keamanan.

---

## 9. Struktur Folder

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── calon-mahasiswa/
│   │   ├── mahasiswa/
│   │   ├── registrasi/
│   │   ├── lip-tagihan/
│   │   ├── pembayaran/
│   │   ├── setoran-ut/
│   │   ├── kas-operasional/
│   │   ├── laporan/
│   │   ├── master-data/
│   │   ├── pengguna/
│   │   ├── audit-log/
│   │   └── pengaturan/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   └── layout/
│
├── features/
│   ├── students/
│   ├── registrations/
│   ├── invoices/
│   ├── payments/
│   ├── remittances/
│   └── reporting/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── permissions/
│   ├── validation/
│   └── utils/
│
└── types/

supabase/
├── migrations/
└── seed.sql

docs/
├── DATABASE.md
└── IMPLEMENTATION.md
```

`BLUEPRINT.md` diletakkan di root project.

---

## 10. Master Data

Tabel master minimum:

- `academic_periods`
- `faculties`
- `study_levels`
- `study_programs`
- `service_schemes`
- `fee_types`
- `fee_rates`
- `payment_methods`
- `student_statuses`
- `cash_accounts`
- `operational_categories`
- `app_settings`

Master tarif harus mendukung:
- tarif per semester;
- tarif per SKS;
- periode berlaku;
- tanggal mulai dan berakhir;
- status aktif;
- sumber tarif;
- status verifikasi;
- histori tarif;
- kombinasi prodi/skema yang berbeda.

---

## 11. Identity & Authorization Tables

### `profiles`

Data profil pengguna yang berkaitan dengan `auth.users`.

Field minimum:
- id
- full_name
- is_active
- created_at
- updated_at

### `roles`

Contoh:
- owner
- academic_admin
- finance_admin
- viewer

### `user_roles`

Mapping antara user dan role.

---

## 12. Students

### `students`

Field minimum:
- id
- nim
- nik
- full_name
- birth_place
- birth_date
- gender
- whatsapp
- email
- address
- city
- entry_year
- faculty_id
- study_level_id
- study_program_id
- service_scheme_id
- status_id
- status_effective_at
- internal_notes
- created_at
- updated_at
- created_by
- updated_by

Constraint:
- NIM unik jika tersedia.
- NIK unik jika tersedia.

Pencarian:
- nama
- NIM
- NIK
- WhatsApp

Filter:
- fakultas
- prodi
- angkatan
- skema
- status

### `student_status_history`

Field minimum:
- id
- student_id
- previous_status_id
- new_status_id
- effective_at
- reason
- changed_by
- created_at

---

## 13. Registrations

### `registrations`

Field minimum:
- id
- registration_number
- student_id
- academic_period_id
- registration_type
- study_program_id
- service_scheme_id
- credits
- status
- created_by
- created_at
- updated_at

Program studi dan skema disimpan kembali di registration sebagai histori saat registrasi dibuat.

---

## 14. Registration Fee Snapshot

### `registration_fee_snapshots`

Field minimum:
- id
- registration_id
- source_fee_rate_id
- fee_type_id
- fee_name_snapshot
- calculation_type
- quantity
- unit_amount
- total_amount
- source
- created_at

Contoh:

```text
Biaya Layanan SALUT
quantity = 1
unit_amount = 400000
total_amount = 400000
```

Perubahan master tarif tidak mengubah snapshot lama.

---

## 15. LIP

### `lip_documents`

Field minimum:
- id
- registration_id
- lip_number
- version
- official_amount
- tuition_amount
- book_amount
- shipping_amount
- other_ut_amount
- issued_at
- due_at
- storage_path
- status
- verified_by
- verified_at
- created_at

Status:
- belum_ada
- draft
- menunggu_verifikasi
- terverifikasi
- dibayar_ke_ut
- dibatalkan

LIP terverifikasi menjadi sumber nilai kewajiban resmi kepada UT.

---

## 16. Invoice Mahasiswa

Rumus dasar:

```text
Total Tagihan Mahasiswa
=
Total LIP Resmi UT
+ Biaya Layanan SALUT
+ Biaya Tambahan Internal
- Potongan Disetujui
```

### `invoices`

Field minimum:
- id
- invoice_number
- registration_id
- lip_document_id
- due_at
- status
- issued_at
- created_by
- created_at

Status:
- draft
- belum_bayar
- sebagian
- lunas
- lewat_jatuh_tempo
- dibatalkan

### `invoice_items`

Field minimum:
- id
- invoice_id
- item_type
- description
- quantity
- unit_amount
- amount
- source
- created_at

Sisa tagihan tidak boleh menjadi angka editable manual.

---

## 17. Student Payments

### `student_payments`

Field minimum:
- id
- transaction_number
- student_id
- paid_at
- amount
- payment_method_id
- cash_account_id
- reference_number
- proof_storage_path
- status
- received_by
- verified_by
- verified_at
- notes
- created_at

Status:
- draft
- menunggu_verifikasi
- terverifikasi
- ditolak
- void_requested
- dibatalkan

Validasi:
- nominal > 0;
- deteksi duplikasi transaksi yang jelas;
- nominal verified tidak dapat diedit langsung.

### `payment_allocations`

Field minimum:
- id
- payment_id
- invoice_id
- amount
- created_at

Status invoice dihitung dari total tagihan dibanding total payment allocation terverifikasi.

---

## 18. Setoran ke UT

Pembayaran mahasiswa kepada SALUT dan pembayaran SALUT kepada UT adalah transaksi berbeda.

### `ut_remittances`

Field minimum:
- id
- remittance_number
- paid_at
- amount
- cash_account_id
- reference_number
- proof_storage_path
- status
- created_by
- verified_by
- verified_at
- created_at

### `ut_remittance_items`

Field minimum:
- id
- remittance_id
- registration_id
- lip_document_id
- amount
- created_at

Satu setoran UT dapat mencakup beberapa LIP.

---

## 19. Kas dan Operasional

### `cash_accounts`

Contoh:
- Kas Tunai
- Rekening Bank SALUT

### `operational_transactions`

Field minimum:
- id
- transaction_number
- transaction_type
- category_id
- cash_account_id
- transaction_date
- amount
- description
- proof_storage_path
- status
- created_by
- verified_by
- verified_at
- created_at

Pembayaran mahasiswa tidak digabungkan dengan transaksi operasional.

---

## 20. Attachments

Jika digunakan tabel generik:

### `attachments`

Field minimum:
- id
- entity_type
- entity_id
- file_name
- storage_path
- mime_type
- file_size
- uploaded_by
- created_at

Ketentuan:
- private bucket;
- signed URL singkat;
- validasi ukuran;
- validasi tipe file;
- sanitasi nama file.

---

## 21. Audit Log

### `audit_logs`

Field minimum:
- id
- actor_user_id
- action
- entity_type
- entity_id
- old_data
- new_data
- reason
- metadata
- created_at

Aksi penting:
- login penting;
- perubahan role;
- perubahan tarif;
- verifikasi pembayaran;
- pembatalan;
- koreksi;
- setoran UT;
- perubahan status penting.

Admin biasa tidak boleh update/delete audit log.

---

## 22. Dashboard

Dashboard minimum:

- Total mahasiswa aktif
- Calon mahasiswa
- Registrasi semester berjalan
- Total tagihan
- Total pembayaran terverifikasi
- Piutang mahasiswa
- Kewajiban kepada UT
- Setoran ke UT
- Kewajiban UT belum disetor
- Pendapatan biaya layanan SALUT
- Pembayaran terbaru
- Tagihan jatuh tempo
- LIP menunggu verifikasi

Nilai dashboard berasal dari query auditable.

### Penerimaan Mahasiswa

```text
SUM(student_payments.amount)
WHERE status = 'terverifikasi'
```

### Piutang

```text
Total invoice valid
-
verified payment allocation
```

### Kewajiban UT Belum Disetor

```text
Total kewajiban LIP terverifikasi
-
total ut remittance terverifikasi
```

Pendapatan SALUT tidak sama dengan seluruh uang masuk.

---

## 23. Laporan Minimum

- Mahasiswa per angkatan
- Mahasiswa per prodi
- Mahasiswa per skema
- Mahasiswa per status
- Registrasi per periode
- Tagihan mahasiswa
- Piutang dan tunggakan
- Pembayaran mahasiswa
- Setoran UT
- Kewajiban UT belum disetor
- Pendapatan biaya layanan SALUT
- Pemasukan operasional
- Pengeluaran operasional
- Ringkasan arus kas sederhana
- Riwayat transaksi per mahasiswa

Semua laporan:
- filter periode;
- export minimal CSV.

Tidak membuat laporan laba-rugi formal sebelum aturan akuntansi dikonfirmasi.

---

## 24. Import Data Lama

Rancangan flow:

1. Upload file.
2. Pilih sheet.
3. Mapping kolom.
4. Preview.
5. Validasi.
6. Deteksi NIM/NIK duplikat.
7. Tampilkan accepted/rejected rows.
8. Konfirmasi import.
9. Simpan import log.

Import otomatis tanpa preview tidak diperbolehkan.

---

## 25. UI / Navigation

Navigasi awal:

- Dashboard
- Calon Mahasiswa
- Mahasiswa
- Registrasi
- LIP & Tagihan
- Pembayaran Mahasiswa
- Setoran UT
- Kas & Operasional
- Laporan
- Master Data
- Pengguna & Hak Akses
- Audit Log
- Pengaturan

Setiap tabel utama harus memiliki:
- search;
- filter;
- sort;
- pagination;
- loading state;
- empty state;
- error state.

Form panjang dibagi menjadi section atau step yang logis.

Desktop admin menjadi prioritas, tetapi tetap mobile responsive.

---

## 26. Security Requirements

- RLS aktif pada seluruh tabel yang terekspos.
- Default deny.
- Policy berdasarkan role.
- Authorization divalidasi di server.
- MFA untuk Owner/Admin jika sesuai dengan flow yang dipilih.
- Service-role key tidak pernah masuk client.
- File sensitif dalam private bucket.
- Gunakan signed URL.
- NIK di-mask pada list.
- Tidak percaya MIME type dari browser saja.
- Ledger/transaksi verified tidak boleh hard delete.
- Audit log immutable bagi admin biasa.

---

## 27. Checkpoint Pembangunan

### Checkpoint 1 — Foundation

- [ ] Inspect repository
- [ ] Identifikasi package manager dan stack existing
- [ ] Setup Next.js/Supabase foundation
- [ ] Environment configuration
- [ ] Authentication
- [ ] Profiles
- [ ] Roles
- [ ] Permission helpers
- [ ] Base RLS
- [ ] Dashboard shell
- [ ] Sidebar/navigation
- [ ] Migration master akademik
- [ ] Seed master aman
- [ ] Lint
- [ ] Type-check
- [ ] Test
- [ ] Production build

STOP setelah Checkpoint 1.

### Checkpoint 2 — Mahasiswa

- [ ] Calon mahasiswa
- [ ] Mahasiswa
- [ ] Search/filter
- [ ] Validation NIM/NIK
- [ ] Status mahasiswa
- [ ] Status history
- [ ] RLS
- [ ] Audit

### Checkpoint 3 — Registrasi & Tarif

- [ ] Academic period
- [ ] Fee rates
- [ ] Registrasi semester
- [ ] Snapshot tarif
- [ ] Validation
- [ ] Audit

### Checkpoint 4 — LIP & Invoice

- [ ] Upload LIP
- [ ] Private storage
- [ ] LIP verification
- [ ] Invoice
- [ ] Invoice items
- [ ] Total tagihan
- [ ] Remaining balance

### Checkpoint 5 — Pembayaran

- [ ] Input pembayaran
- [ ] Payment allocation
- [ ] Verification
- [ ] Partial payment
- [ ] Overpayment
- [ ] Void workflow
- [ ] Receipt

### Checkpoint 6 — Setoran UT

- [ ] UT remittance
- [ ] Allocation ke LIP
- [ ] Verification
- [ ] Outstanding UT liability

### Checkpoint 7 — Dashboard & Laporan

- [ ] KPI dashboard
- [ ] Piutang
- [ ] Kewajiban UT
- [ ] Pendapatan SALUT
- [ ] Riwayat transaksi mahasiswa
- [ ] CSV export

### Checkpoint 8 — Hardening

- [ ] Full RLS review
- [ ] Storage permission test
- [ ] Role matrix test
- [ ] Financial calculation test
- [ ] Audit log test
- [ ] Responsive test
- [ ] Lint
- [ ] Type-check
- [ ] Automated tests
- [ ] Production build

---

## 28. Environment Variables

Tanpa secret value:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=
APP_TIMEZONE=Asia/Jakarta
```

Catatan:
- Penamaan public key dapat disesuaikan dengan SDK Supabase yang digunakan repository.
- `SUPABASE_SERVICE_ROLE_KEY` hanya server-side.
- Jangan commit `.env` yang berisi secret.

---

## 29. Definition of Done — Checkpoint 1

Checkpoint 1 hanya dianggap selesai apabila:

- [ ] Login bekerja.
- [ ] Protected route bekerja.
- [ ] Role dapat dikenali server.
- [ ] Menu mengikuti permission.
- [ ] Authorization dicek server-side.
- [ ] RLS aktif.
- [ ] Master tables berhasil dimigrasikan.
- [ ] Tidak ada secret yang masuk browser.
- [ ] Tidak ada dummy financial data pada production flow.
- [ ] Lint lulus.
- [ ] Type-check lulus.
- [ ] Test terkait lulus.
- [ ] Production build lulus.

---

## 30. Di Luar MVP Fase Pertama

Belum dibangun:

- OCR LIP otomatis
- Portal mahasiswa
- Login mahasiswa
- WhatsApp API
- Payment gateway
- Aplikasi mobile native
- Integrasi API UT
- Akuntansi formal / laporan laba-rugi formal

Struktur aplikasi tidak boleh menghalangi fitur tersebut di masa depan.

---

## 31. Instruksi Kerja untuk AI Coding Agent

Sebelum mengubah kode:

1. Baca `BLUEPRINT.md`.
2. Periksa repository.
3. Identifikasi package manager.
4. Periksa struktur file existing.
5. Periksa dependencies dan konfigurasi.
6. Periksa migration database existing.
7. Periksa authentication dan Supabase existing.
8. Ringkas kondisi repository.
9. Identifikasi gap terhadap blueprint.
10. Jangan menghapus atau menimpa perubahan existing tanpa memeriksa diff.
11. Jangan mengarang business rule.
12. Jangan memasukkan secret.
13. Jangan menonaktifkan TypeScript/lint/security checks.
14. Jangan menggunakan mock data pada halaman yang diklaim sudah terhubung ke database.

Setiap checkpoint:

1. Jelaskan file yang dibuat/diubah.
2. Buat migration yang aman.
3. Terapkan RLS bersamaan dengan tabel.
4. Gunakan seed hanya untuk master/demo aman.
5. Jalankan lint.
6. Jalankan type-check.
7. Jalankan test.
8. Jalankan production build.
9. Perbaiki error sebelum menyatakan selesai.
10. Update dokumentasi progress.

Kerjakan satu checkpoint pada satu waktu.

Setelah Checkpoint 1 selesai:
- laporkan implementasi;
- laporkan file yang berubah;
- laporkan migration;
- laporkan hasil lint/type-check/test/build;
- laporkan risiko atau pekerjaan tersisa;
- STOP sampai ada persetujuan untuk lanjut.
