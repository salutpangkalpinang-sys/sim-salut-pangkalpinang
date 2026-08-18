-- ============================================================================
-- SIM-SALUT Pangkalpinang Master Seed Data
-- Safe Master Seed Data ONLY (No real personal data, no fake production ledgers)
-- ============================================================================

-- 1. Roles
INSERT INTO public.roles (code, name, description) VALUES
('owner', 'Owner / Pimpinan', 'Penerima laporan penuh, pengelola pengguna, dan pengambil keputusan sensitif'),
('academic_admin', 'Admin Akademik', 'Pengelola data mahasiswa, registrasi semester, LIP, dan prodi'),
('finance_admin', 'Admin Keuangan / Kasir', 'Pencatat pembayaran mahasiswa, setoran UT, kas operasional, dan bukti bayar'),
('viewer', 'Viewer / Auditor', 'Akses lihat data dan laporan tanpa hak ubah/hapus')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Academic Periods
INSERT INTO public.academic_periods (code, name, term, is_active) VALUES
('20251', '2025/2026 Ganjil', 'Ganjil', FALSE),
('20252', '2025/2026 Genap', 'Genap', FALSE),
('20261', '2026/2027 Ganjil', 'Ganjil', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3. Faculties
INSERT INTO public.faculties (code, name) VALUES
('FKIP', 'Fakultas Keguruan dan Ilmu Pendidikan'),
('FE', 'Fakultas Ekonomi dan Bisnis'),
('FHISIP', 'Fakultas Hukum, Ilmu Sosial dan Ilmu Politik'),
('FST', 'Fakultas Sains dan Teknologi')
ON CONFLICT (code) DO NOTHING;

-- 4. Study Levels
INSERT INTO public.study_levels (code, name) VALUES
('D3', 'Diploma III'),
('D4', 'Diploma IV'),
('S1', 'Sarjana (S1)'),
('S2', 'Magister (S2)'),
('S3', 'Doktor (S3)')
ON CONFLICT (code) DO NOTHING;

-- 5. Study Programs (All Official Programs from SALUT Mega Cendekia Flyer)
INSERT INTO public.study_programs (code, name, faculty_id, study_level_id) VALUES
-- FST (Fakultas Sains dan Teknologi) - S1
('252', 'Sistem Informasi', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('253', 'Matematika', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('254', 'Statistika', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('255', 'Biologi', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('256', 'Agribisnis Bidang Minat Pertanian', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('257', 'Agribisnis Bidang Minat Peternakan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('258', 'Agribisnis Bidang Minat Perikanan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('259', 'Teknologi Pangan', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('260', 'Perencanaan Wilayah & Kota', (SELECT id FROM public.faculties WHERE code = 'FST'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- FHISIP (Fakultas Hukum, Ilmu Sosial dan Ilmu Politik) - S1 & D4
('311', 'Ilmu Hukum', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('312', 'Administrasi Negara', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('313', 'Administrasi Bisnis', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('314', 'Ilmu Pemerintahan', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('315', 'Ilmu Komunikasi', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('316', 'Ilmu Perpustakaan', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('317', 'Sosiologi', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('318', 'Sastra Inggris Penerjemah', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('411', 'D-IV Kearsipan', (SELECT id FROM public.faculties WHERE code = 'FHISIP'), (SELECT id FROM public.study_levels WHERE code = 'D4')),

-- FKIP (Fakultas Keguruan dan Ilmu Pendidikan) - S1
('118', 'Pendidikan Guru Sekolah Dasar (PGSD)', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('119', 'Pendidikan Guru Anak Usia Dini (PGPAUD)', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('120', 'Pendidikan Agama Islam', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('121', 'Pendidikan Bahasa Indonesia', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('122', 'Pendidikan Bahasa Inggris', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('123', 'Pendidikan Matematika', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('124', 'Pendidikan Biologi', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('125', 'Pendidikan Fisika', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('126', 'Pendidikan Kimia', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('127', 'Pancasila & Kewarganegaraan', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('128', 'Pendidikan Ekonomi', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('129', 'Teknologi Pendidikan', (SELECT id FROM public.faculties WHERE code = 'FKIP'), (SELECT id FROM public.study_levels WHERE code = 'S1')),

-- FEB (Fakultas Ekonomi dan Bisnis) - S1 & D3
('54', 'Manajemen', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('83', 'Akuntansi', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('55', 'Ekonomi Pembangunan', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('56', 'Ekonomi Syariah', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('57', 'Pariwisata', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'S1')),
('412', 'D-III Perpajakan', (SELECT id FROM public.faculties WHERE code = 'FE'), (SELECT id FROM public.study_levels WHERE code = 'D3'))
ON CONFLICT (code) DO NOTHING;

-- 6. Service Schemes
INSERT INTO public.service_schemes (code, name, category, description) VALUES
('SIPAS_NON_TTM', 'SIPAS Non-TTM', 'SIPAS', 'Sistem Paket Semester tanpa Tutorial Tatap Muka wajib'),
('SIPAS_TTM', 'SIPAS TTM', 'SIPAS', 'Sistem Paket Semester dengan Tutorial Tatap Muka'),
('SIPAS_SEMI', 'SIPAS Semi', 'SIPAS', 'Sistem Paket Semester kombinasi TTM dan Online'),
('SIPAS_FULL', 'SIPAS Penuh', 'SIPAS', 'Sistem Paket Semester Penuh Tatap Muka'),
('NON_SIPAS', 'Non-SIPAS / Per SKS', 'Non-SIPAS', 'Skema pendaftaran mata kuliah per SKS bebas')
ON CONFLICT (code) DO NOTHING;

-- 7. Fee Types
INSERT INTO public.fee_types (code, name, category, is_per_sks, description) VALUES
('TUITION_PACKAGE', 'Uang Kuliah Paket Semester', 'UT_OFFICIAL', FALSE, 'Biaya resmi UT skema paket per semester'),
('COURSE_PER_SKS', 'Biaya Mata Kuliah Per SKS', 'UT_OFFICIAL', TRUE, 'Biaya registrasi mata kuliah reguler per SKS'),
('COURSE_REPEAT', 'Biaya Mata Kuliah Ulang', 'UT_OFFICIAL', TRUE, 'Biaya registrasi mengulang mata kuliah per SKS'),
('ADMISION', 'Biaya Admisi Pendaftaran Baru', 'UT_OFFICIAL', FALSE, 'Biaya pendaftaran awal mahasiswa baru UT'),
('SALUT_SERVICE', 'Biaya Layanan & Komisi SALUT', 'SALUT_INTERNAL', FALSE, 'Biaya administrasi dan pendampingan layanan SALUT')
ON CONFLICT (code) DO NOTHING;

-- 8. Payment Methods
INSERT INTO public.payment_methods (code, name, requires_reference) VALUES
('CASH', 'Tunai / Kasir SALUT', FALSE),
('BANK_TRANSFER', 'Transfer Bank SALUT', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 9. Student Statuses
INSERT INTO public.student_statuses (code, name) VALUES
('CALON', 'Calon Mahasiswa'),
('AKTIF', 'Mahasiswa Aktif'),
('CUTI', 'Cuti Akademik'),
('NONAKTIF', 'Non-Aktif'),
('DO', 'Drop Out (DO)'),
('LULUS', 'Lulus / Alumni')
ON CONFLICT (code) DO NOTHING;

-- 10. Cash Accounts
INSERT INTO public.cash_accounts (code, name, account_number, bank_name) VALUES
('KAS_TUNAI', 'Kas Tunai SALUT Pangkalpinang', NULL, NULL),
('BANK_BCA', 'Rekening Bank BCA SALUT', '8870123456', 'Bank Central Asia'),
('BANK_BRI', 'Rekening Bank BRI SALUT', '001201002345501', 'Bank Rakyat Indonesia')
ON CONFLICT (code) DO NOTHING;

-- 11. Operational Categories
INSERT INTO public.operational_categories (code, name, transaction_type) VALUES
('OP_OPERATIONAL', 'Beban Operasional Kantor', 'expense'),
('OP_ELECTRICITY', 'Listrik & Internet', 'expense'),
('OP_SALARY', 'Gaji & Honorarium Staf', 'expense'),
('OP_OTHER_INCOME', 'Pemasukan Non-Akademik Lainnya', 'income')
ON CONFLICT (code) DO NOTHING;

-- 12. App Settings Initial Default
INSERT INTO public.app_settings (key, value, description) VALUES
('salut_info', '{"name": "SALUT Pangkalpinang", "city": "Pangkalpinang", "phone": "0812-3456-7890", "address": "Jl. Utama No. 12, Pangkalpinang"}', 'Informasi identitas resmi SALUT'),
('default_salut_fee', '{"amount": 400000, "currency": "IDR"}', 'Nominal estimasi awal biaya layanan SALUT per registrasi')
ON CONFLICT (key) DO NOTHING;
