export type ImportMode = "calon" | "mahasiswa";

export interface ImportRowRaw {
  nama_lengkap?: string;
  nim?: string;
  nik?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  whatsapp?: string;
  email?: string;
  alamat?: string;
  kota?: string;
  tahun_masuk?: string | number;
  fakultas?: string;
  jenjang?: string;
  program_studi?: string;
  skema_layanan?: string;
  status?: string;
  tanggal_efektif_status?: string;
  catatan_internal?: string;
}

export interface NormalizedStudentImportData {
  fullName: string;
  nim: string | null;
  nik: string | null;
  placeOfBirth: string | null;
  dateOfBirth: string | null;
  gender: "L" | "P" | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  entryYear: number | null;
  facultyId: string | null;
  studyProgramId: string | null;
  serviceSchemeId: string | null;
  statusId: string | null;
  statusEffectiveDate: string | null;
  notes: string | null;
  // Display metadata
  studyProgramName?: string;
  serviceSchemeName?: string;
  statusName?: string;
}

export interface ImportRowValidation {
  rowNumber: number;
  raw: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  maskedNik: string | null;
  normalizedData: NormalizedStudentImportData | null;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  rows: ImportRowValidation[];
  mode: ImportMode;
  filename: string;
}

export interface ImportCommitResult {
  totalAttempted: number;
  successCount: number;
  failedCount: number;
  failedRows: { rowNumber: number; name: string; reason: string }[];
}

export interface MasterDataResolved {
  faculties: { id: string; code: string; name: string }[];
  studyPrograms: { id: string; code: string; name: string; faculty_id?: string }[];
  serviceSchemes: { id: string; code: string; name: string }[];
  studentStatuses: { id: string; code: string; name: string }[];
}
