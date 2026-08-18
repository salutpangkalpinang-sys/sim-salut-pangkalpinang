-- Migration to Update App Settings for SALUT Mega Cendekia

INSERT INTO public.app_settings (key, value, description) VALUES
(
  'salut_info', 
  '{
    "name": "SALUT Mega Cendekia",
    "official_name": "Sentra Layanan Universitas Terbuka Mega Cendekia",
    "address": "Jl. Utama No. 12, Pangkalpinang",
    "city": "Pangkalpinang",
    "province": "Kepulauan Bangka Belitung",
    "postal_code": "33111",
    "whatsapp": "081234567890",
    "email": "info@salut-megacendekia.ac.id",
    "leader_name": "Drs. H. Ahmad Subagyo, M.M."
  }', 
  'Informasi identitas resmi Sentra Layanan Universitas Terbuka Mega Cendekia'
),
(
  'receipt_info',
  '{
    "header_name": "SALUT MEGA CENDEKIA",
    "address": "Jl. Utama No. 12, Pangkalpinang, Bangka Belitung",
    "whatsapp": "081234567890",
    "email": "keuangan@salut-megacendekia.ac.id",
    "leader_name": "Drs. H. Ahmad Subagyo, M.M.",
    "footer": "1. Bukti pembayaran ini adalah dokumen sah pengganti kuitansi fisik.\\n2. Harap simpan bukti kuitansi ini untuk keperluan administrasi akademik."
  }',
  'Informasi kop & footer kuitansi resmi SALUT Mega Cendekia'
),
(
  'default_salut_fee',
  '{"amount": 250000, "currency": "IDR"}',
  'Nominal estimasi awal biaya layanan SALUT per registrasi'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
