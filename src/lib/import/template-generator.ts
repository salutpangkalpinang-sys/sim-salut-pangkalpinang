export const IMPORT_TEMPLATE_HEADER = [
  "nama_lengkap",
  "nim",
  "nik",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "whatsapp",
  "email",
  "alamat",
  "kota",
  "tahun_masuk",
  "fakultas",
  "jenjang",
  "program_studi",
  "skema_layanan",
  "status",
  "tanggal_efektif_status",
  "catatan_internal",
].join(",");

export const SAMPLE_TEMPLATE_ROWS = [
  'Budi Santoso,041234567,3671012304950001,Pangkalpinang,1995-04-23,L,081234567890,budi@example.com,"Jl. Utama No. 12",Pangkalpinang,2025,FKIP,S1,Manajemen,SIPAS,Calon Mahasiswa,2025-01-15,"Registrasi baru gelombang 1"',
  'Siti Rahma,041234568,3671012304950002,Pangkalpinang,1996-08-12,P,081234567891,siti@example.com,"Jl. Jenderal Sudirman No. 45",Pangkalpinang,2025,FEB,S1,Akuntansi,Non-SIPAS,Calon Mahasiswa,2025-01-15,"Catatan registrasi"',
].join("\n");

export function generateCsvTemplate(): string {
  // UTF-8 BOM prefix for Excel compatibility
  return `\uFEFF${IMPORT_TEMPLATE_HEADER}\n${SAMPLE_TEMPLATE_ROWS}`;
}
