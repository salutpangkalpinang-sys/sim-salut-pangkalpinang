-- Migration: Seed Program-Specific UT Official Fee Rates from Official 2026/2027 Brochure

INSERT INTO public.fee_rates (
  fee_type_id,
  study_program_id,
  name,
  calculation_type,
  unit_amount,
  source,
  verification_status,
  is_active
)
SELECT 
  ft.id as fee_type_id,
  sp.id as study_program_id,
  vals.rate_name,
  vals.calc_type,
  vals.unit_amt,
  'Rincian Biaya Resmi UT 2026 Brosur Owner',
  'VERIFIED',
  TRUE
FROM (
  VALUES
    -- FEB
    ('83', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Akuntansi)', 'PER_SKS', 38000),
    ('59', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Akuntansi Keuangan Publik)', 'PER_SKS', 51000),
    ('55', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ekonomi Pembangunan)', 'PER_SKS', 36000),
    ('56', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ekonomi Syariah)', 'PER_SKS', 51000),
    ('54', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Manajemen)', 'PER_SKS', 36000),
    ('57', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (PJJ Pariwisata)', 'PER_SKS', 80000),
    ('57', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (PJJ Pariwisata)', 'FIXED', 1900000),
    ('57', 'UKT_SIPAS_SEMI', 'UKT 4 - SIPAS Semi (PJJ Pariwisata)', 'FIXED', 2600000),
    ('57', 'UKT_SIPAS_PENUH', 'UKT 5 - SIPAS Penuh (PJJ Pariwisata)', 'FIXED', 3200000),
    ('57', 'UKT_SIPAS_PLUS', 'UKT 6 - SIPAS Plus (PJJ Pariwisata)', 'FIXED', 3400000),
    ('58', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Kewirausahaan)', 'PER_SKS', 120000),
    ('58', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (Kewirausahaan)', 'FIXED', 2600000),
    ('58', 'UKT_SIPAS_SEMI', 'UKT 4 - SIPAS Semi (Kewirausahaan)', 'FIXED', 2975000),
    ('58', 'UKT_SIPAS_PENUH', 'UKT 5 - SIPAS Penuh (Kewirausahaan)', 'FIXED', 3200000),
    ('58', 'UKT_SIPAS_PLUS', 'UKT 6 - SIPAS Plus (Kewirausahaan)', 'FIXED', 3300000),

    -- FHISIP
    ('313', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ilmu Administrasi Bisnis)', 'PER_SKS', 36000),
    ('312', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Administrasi Publik)', 'PER_SKS', 36000),
    ('311', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ilmu Hukum)', 'PER_SKS', 40000),
    ('315', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ilmu Komunikasi)', 'PER_SKS', 36000),
    ('314', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ilmu Pemerintahan)', 'PER_SKS', 36000),
    ('316', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Ilmu Perpustakaan)', 'PER_SKS', 38000),
    ('318', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Sastra Inggris)', 'PER_SKS', 41000),
    ('317', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Sosiologi)', 'PER_SKS', 36000),
    ('319', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Perpajakan S1)', 'PER_SKS', 75000),
    ('319', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (Perpajakan S1)', 'FIXED', 1800000),

    -- FST
    ('255', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Biologi)', 'PER_SKS', 50000),
    ('253', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Matematika)', 'PER_SKS', 36000),
    ('254', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Statistika)', 'PER_SKS', 36000),
    ('256', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Agribisnis Pertanian)', 'PER_SKS', 50000),
    ('257', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Agribisnis Peternakan)', 'PER_SKS', 50000),
    ('258', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Agribisnis Perikanan)', 'PER_SKS', 50000),
    ('259', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Teknologi Pangan)', 'PER_SKS', 50000),
    ('260', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (PWK)', 'PER_SKS', 54000),
    ('260', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (PWK)', 'FIXED', 1750000),
    ('260', 'UKT_SIPAS_PLUS', 'UKT 6 - SIPAS Plus (PWK)', 'FIXED', 2400000),
    ('252', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Sistem Informasi)', 'PER_SKS', 78000),
    ('252', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (Sistem Informasi)', 'FIXED', 1800000),
    ('261', 'NON_SIPAS_PER_SKS', 'Biaya Uang Kuliah Non-SIPAS (Sains Data)', 'PER_SKS', 85000),
    ('261', 'UKT_SIPAS_NON_TTM', 'UKT 3 - SIPAS Non-TTM (Sains Data)', 'FIXED', 1900000)
) AS vals(prodi_code, fee_type_code, rate_name, calc_type, unit_amt)
JOIN public.study_programs sp ON sp.code = vals.prodi_code
JOIN public.fee_types ft ON ft.code = vals.fee_type_code
ON CONFLICT DO NOTHING;
