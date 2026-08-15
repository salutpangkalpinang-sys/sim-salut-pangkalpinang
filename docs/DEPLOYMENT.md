# Panduan Deployment & Operasional Produksi SIM-SALUT Pangkalpinang

Dokumen ini berisi panduan teknis deployment produksi, manajemen environment variables, strategi migrasi database Supabase, konfigurasi Vercel, otorisasi awal Owner, pengujian smoke test produksi, dan prosedur penanganan insiden / rollback.

---

## 1. Production Architecture

- **Web Frontend & App Router**: Next.js 15.5 deployed on Vercel Serverless Architecture (Node.js runtime v20+).
- **Database Backend**: Supabase PostgreSQL with Row Level Security (RLS) & Atomic Stored Procedures (`SECURITY DEFINER`).
- **Authentication**: Supabase Auth (`@supabase/ssr` cookies session model).
- **Private Storage**: Supabase Storage Buckets (`lip-documents`, `payment-proofs`, `ut-remittance-proofs`, `operational-proofs`). Access via Server-Side Time-limited Signed URLs.
- **Business Timezone**: `Asia/Jakarta` (WIB).

---

## 2. Production Environment Variables Inventory

Variabel lingkungan yang digunakan oleh kode aplikasi. **DILARANG MENULISKAN NILAI SECRET SEBENARNYA PADA REPOSITORY ATAU DOKUMENTASI LOKAL.**

| Variable Name | Scope | Description | Confidentiality |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Project Reference URL Supabase Produksi | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Anonymous Public API Key Supabase | Public |
| `DEV_ADMIN_EMAIL` | Server-Only | Default email identifier untuk dev fallback (Optional) | Configuration |
| `NEXT_PUBLIC_APP_URL` | Client & Server | Production Base URL (misal: `https://sim-salut.ac.id`) | Public |
| `APP_TIMEZONE` | Server-Only | Zona waktu standar aplikasi (`Asia/Jakarta`) | Configuration |

> [!CAUTION]
> Jangan menaruh key rahasia ke variabel dengan prefix `NEXT_PUBLIC_`. Gunakan prefix `NEXT_PUBLIC_` HANYA untuk URL dan Anon Key publik Supabase.

---

## 3. Database Migration Deployment Process

1. **Prinsip Nol Reset Produksi**:
   Dilarang keras menjalankan `supabase db reset` pada lingkungan produksi!
2. **Urutan Chronological Migration (15 Migration Files)**:
   - `20260813000001_checkpoint1_foundation.sql`
   - `20260814000001_checkpoint2_students.sql`
   - `20260814000002_checkpoint3_registrations.sql`
   - `20260814000003_checkpoint4_lip_invoices.sql`
   - `20260814000004_checkpoint5_payments.sql`
   - `20260814000005_checkpoint6_ut_remittances.sql`
   - `20260814000006_checkpoint7a_operational.sql`
   - `20260814000007_checkpoint8_final_hardening.sql`
   - `20260814000008_core1_master_data_and_students.sql`
   - `20260814000009_core2_registrations_and_tariff_snapshots.sql`
   - `20260815000010_core3_lip_documents_and_invoices.sql`
   - `20260815000011_core4_student_payments_allocations_and_void.sql`
   - `20260815000012_core5_ut_remittances_and_concurrency.sql`
   - `20260815000013_core6_operational_cash_transactions_and_categories.sql`
   - `20260815000014_core8_security_hardening_and_final_qa.sql`

3. **Penerapan Migrasi**:
   Gunakan Supabase CLI via `supabase db push` dengan project produksi terpilih.
4. **Seed Master Data Only**:
   Jalankan `supabase/seed.sql` untuk mengisi data master acuan resmi (roles, fakultas, prodi, skema layanan, jenis biaya, metode pembayaran, status mahasiswa, rekening kas, dan kategori operasional). Seed ini tidak mengandung data dummy mahasiswa maupun transaksi finansial palsu.

---

## 4. Storage Production Setup

Empat bucket private wajib ada di Supabase Storage Produksi:
1. `lip-documents` (Public: `FALSE`, RLS Policies: Active)
2. `payment-proofs` (Public: `FALSE`, RLS Policies: Active)
3. `ut-remittance-proofs` (Public: `FALSE`, RLS Policies: Active)
4. `operational-proofs` (Public: `FALSE`, RLS Policies: Active)

---

## 5. Web Deployment Process (Vercel)

1. **Sambungkan Repository Git**: Hubungkan repository SIM-SALUT ke project Vercel.
2. **Framework Preset**: Next.js (Automatic Detection).
3. **Environment Variables**: Set `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` pada Vercel Production Environment Settings.
4. **Deploy Target**: Branch `main` / `master`.

---

## 6. Initial Owner Account Creation

1. Daftarkan akun Owner pertama melalui Supabase Auth Dashboard secara administratif.
2. Pada tabel `public.user_roles`, daftarkan `user_id` ke role `owner` pada tabel `public.roles`.
3. Akun Owner siap digunakan untuk login awal.

---

## 7. Non-Destructive Smoke Test Checklist

- [x] Pre-deployment automated tests (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`) PASS.
- [x] HTTPS URL terakses dengan SSL valid.
- [x] Halaman `/login` terbuka tanpa error console.
- [x] Login akun Owner berhasil.
- [x] Dashboard & Modul menampilkan Empty/Zero State jika database produksi baru.
- [x] Otorisasi RBAC dan RLS aktif mencegah akses tanpa hak.

---

## 8. Rollback Procedures

### Web Rollback (Vercel)
Di Vercel Project Dashboard -> Deployments -> Pilih deployment sebelumnya -> Klik **Promote to Production**.

### Database Rollback Strategy
Gunakan migrasi *forward-fix* baru (misal `20260816000001_fix_issue.sql`) tanpa melakukan reset destruktif pada database produksi.
