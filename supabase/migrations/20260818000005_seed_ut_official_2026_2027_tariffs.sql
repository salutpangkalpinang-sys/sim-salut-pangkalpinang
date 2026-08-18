-- Migration to Seed Official UT Pedoman 2026/2027 Master Fee Types and Rates

-- 1. Ensure Fee Types exist for all official UT 2026/2027 categories
INSERT INTO public.fee_types (code, name, category, is_per_sks, description) VALUES
('ADMISION', 'Biaya Admisi Pendaftaran Baru UT', 'UT_OFFICIAL', FALSE, 'Biaya pendaftaran awal mahasiswa baru UT'),
('RPL', 'Biaya Rekognisi Pembelajaran Lampau (RPL)', 'UT_OFFICIAL', FALSE, 'Biaya pengusulan alih kredit / RPL'),
('UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (Paket Semester)', 'UT_OFFICIAL', FALSE, 'Uang Kuliah Tunggal paket semester Non-TTM'),
('UKT_SIPAS_SEMI', 'UKT 4 - SIPAS Semi (Paket Semester)', 'UT_OFFICIAL', FALSE, 'Uang Kuliah Tunggal paket semester TTM Maks 3 MK'),
('UKT_SIPAS_PENUH', 'UKT 5 - SIPAS Penuh (Paket Semester)', 'UT_OFFICIAL', FALSE, 'Uang Kuliah Tunggal paket semester TTM Seluruh MK'),
('UKT_SIPAS_PLUS', 'UKT 6 - SIPAS Plus (Paket Semester)', 'UT_OFFICIAL', FALSE, 'Uang Kuliah Tunggal paket semester TTM & Pengembangan Diri'),
('NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Per SKS)', 'UT_OFFICIAL', TRUE, 'Uang Kuliah Variabel per SKS untuk skema Non-SIPAS'),
('TTM_ATPEM', 'Biaya TTM Atpem (Per MK)', 'UT_OFFICIAL', FALSE, 'Tutorial Tatap Muka Atas Permintaan per Mata Kuliah'),
('WISUDA', 'Biaya Wisuda', 'UT_OFFICIAL', FALSE, 'Biaya upacara dan pengurusan kelulusan wisuda UT'),
('LEGALISIR_IJAZAH', 'Biaya Legalisir & Salinan Ijazah (Per Set)', 'UT_OFFICIAL', FALSE, 'Biaya penerbitan salinan dan legalisir dokumen kelulusan'),
('TERJEMAHAN_IJAZAH', 'Biaya Terjemahan Ijazah & Transkrip (Bahasa Inggris)', 'UT_OFFICIAL', FALSE, 'Biaya terjemahan dokumen kelulusan Bahasa Inggris'),
('SALUT_SERVICE', 'Biaya Layanan & Pendampingan SALUT', 'SALUT_INTERNAL', FALSE, 'Biaya administrasi dan pendampingan resmi SALUT Mega Cendekia')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_per_sks = EXCLUDED.is_per_sks,
  description = EXCLUDED.description;

-- 2. Insert Standard Fee Rates with official unit amounts from Pedoman UT 2026/2027
INSERT INTO public.fee_rates (
  fee_type_id,
  name,
  calculation_type,
  unit_amount,
  source,
  verification_status,
  is_active
)
SELECT 
  ft.id,
  ft.name,
  CASE WHEN ft.is_per_sks THEN 'PER_SKS' ELSE 'FIXED' END,
  CASE 
    WHEN ft.code = 'ADMISION' THEN 100000
    WHEN ft.code = 'RPL' THEN 300000
    WHEN ft.code = 'UKT_SIPAS_NON_TTM' THEN 1300000
    WHEN ft.code = 'UKT_SIPAS_SEMI' THEN 1750000
    WHEN ft.code = 'UKT_SIPAS_PENUH' THEN 2200000
    WHEN ft.code = 'UKT_SIPAS_PLUS' THEN 2400000
    WHEN ft.code = 'NON_SIPAS_PER_SKS' THEN 40000
    WHEN ft.code = 'TTM_ATPEM' THEN 150000
    WHEN ft.code = 'WISUDA' THEN 750000
    WHEN ft.code = 'LEGALISIR_IJAZAH' THEN 50000
    WHEN ft.code = 'TERJEMAHAN_IJAZAH' THEN 150000
    WHEN ft.code = 'SALUT_SERVICE' THEN 250000
    ELSE 100000
  END,
  'SK Rektor UT Pedoman 2026/2027',
  'VERIFIED',
  TRUE
FROM public.fee_types ft
ON CONFLICT DO NOTHING;
