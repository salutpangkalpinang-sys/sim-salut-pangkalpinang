import * as XLSX from "xlsx";
import {
  ImportMode,
  ImportPreviewResult,
  ImportRowValidation,
  MasterDataResolved,
  NormalizedStudentImportData,
} from "@/types/student-import";
import { maskNik } from "@/lib/audit/redaction";

// Helper to escape formula injection characters
export function escapeFormulaInjection(val: string): string {
  if (!val) return "";
  const trimmed = String(val).trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

// Normalizes field value as string while preserving leading zeroes
export function normalizeStringValue(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  return str;
}

export function parseStudentImportBuffer(
  buffer: Buffer,
  filename: string,
  mode: ImportMode,
  masterData: MasterDataResolved
): ImportPreviewResult {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext !== "csv" && ext !== "xlsx") {
    throw new Error(
      `Format file '.${ext}' tidak didukung. Harap gunakan file berformat .csv atau .xlsx.`
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  } catch (err: any) {
    throw new Error(`Gagal membaca berkas spreadsheet: ${err?.message || "File corrupt/invalid"}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Berkas spreadsheet kosong atau tidak memiliki sheet.");
  }

  const worksheet = workbook.Sheets[sheetName];
  // Parse rows as raw text objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: "",
  });

  if (rawRows.length === 0) {
    throw new Error("File spreadsheet tidak berisi data baris (kosong).");
  }

  if (rawRows.length > 1000) {
    throw new Error("Maksimum 1.000 baris per proses import.");
  }

  const validatedRows: ImportRowValidation[] = [];

  // Maps for duplicate detection within the file itself
  const fileNimCounts = new Map<string, number[]>();
  const fileNikCounts = new Map<string, number[]>();

  // Pass 1: Collect NIM & NIK for file-level duplicate detection
  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Row 1 is header
    const nim = normalizeStringValue(row.nim || row.NIM);
    const nik = normalizeStringValue(row.nik || row.NIK);

    if (nim) {
      const existing = fileNimCounts.get(nim) || [];
      existing.push(rowNum);
      fileNimCounts.set(nim, existing);
    }

    if (nik) {
      const existing = fileNikCounts.get(nik) || [];
      existing.push(rowNum);
      fileNikCounts.set(nik, existing);
    }
  });

  // Pass 2: Row-by-row validation
  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract fields (support uppercase / lowercase column names)
    const fullName = normalizeStringValue(row.nama_lengkap || row.Nama || row["Nama Lengkap"]);
    const nim = normalizeStringValue(row.nim || row.NIM) || null;
    const nik = normalizeStringValue(row.nik || row.NIK) || null;
    const placeOfBirth = normalizeStringValue(row.tempat_lahir || row["Tempat Lahir"]) || null;
    const dateOfBirth = normalizeStringValue(row.tanggal_lahir || row["Tanggal Lahir"]) || null;
    const genderRaw = normalizeStringValue(row.jenis_kelamin || row["Jenis Kelamin"]).toUpperCase();
    const whatsapp = normalizeStringValue(row.whatsapp || row.No_WA || row.WhatsApp) || null;
    const email = normalizeStringValue(row.email || row.Email) || null;
    const address = normalizeStringValue(row.alamat || row.Alamat) || null;
    const city = normalizeStringValue(row.kota || row.Kota) || null;
    const entryYearRaw = normalizeStringValue(row.tahun_masuk || row["Tahun Masuk"]);
    const facultyStr = normalizeStringValue(row.fakultas || row.Fakultas);
    const studyProgramStr = normalizeStringValue(row.program_studi || row["Program Studi"] || row.Prodi);
    const serviceSchemeStr = normalizeStringValue(row.skema_layanan || row["Skema Layanan"]);
    const statusStr = normalizeStringValue(row.status || row.Status);
    const statusEffectiveDate = normalizeStringValue(row.tanggal_efektif_status || row["Tanggal Efektif Status"]) || null;
    const notes = normalizeStringValue(row.catatan_internal || row["Catatan Internal"]) || null;

    // 0. Formula Cell Guard (Reject raw spreadsheet formulas)
    const rawCells = [
      String(row.nama_lengkap || row.Nama || ""),
      String(row.nim || row.NIM || ""),
      String(row.nik || row.NIK || ""),
      String(row.whatsapp || row.No_WA || ""),
    ];
    if (rawCells.some((c) => c.trim().startsWith("="))) {
      errors.push("Formula pada sel spreadsheet ('=...') tidak diizinkan. Harap gunakan format Text biasa.");
    }

    // 1. Full Name Validation
    if (!fullName) {
      errors.push("Nama lengkap wajib diisi.");
    } else if (fullName.length < 2) {
      errors.push("Nama lengkap minimal 2 karakter.");
    }

    // 2. Mode-specific NIM Validation
    if (mode === "mahasiswa" && !nim) {
      errors.push("NIM wajib diisi untuk import data Mahasiswa.");
    } else if (nim && nim.length === 8 && /^\d+$/.test(nim)) {
      warnings.push("Perhatian: NIM terdiri dari 8 digit. Pastikan format sel di Excel adalah Text jika ada angka 0 di awal.");
    }

    // 2b. NIK Length & Format Check
    if (nik) {
      if (!/^\d{16}$/.test(nik)) {
        errors.push("NIK harus 16 digit angka. NIK/NIM harus diformat sebagai Text pada file Excel agar angka nol di awal tidak hilang.");
      }
    }

    // 3. File Duplicate Check
    if (nim && (fileNimCounts.get(nim)?.length || 0) > 1) {
      errors.push(`NIM '${nim}' terduplikasi dalam file import (Baris: ${fileNimCounts.get(nim)?.join(", ")}).`);
    }

    if (nik && (fileNikCounts.get(nik)?.length || 0) > 1) {
      errors.push(`NIK '${nik}' terduplikasi dalam file import (Baris: ${fileNikCounts.get(nik)?.join(", ")}).`);
    }

    // 4. Date of Birth Validation
    if (dateOfBirth) {
      const birthTime = new Date(dateOfBirth).getTime();
      if (isNaN(birthTime)) {
        errors.push("Format tanggal lahir tidak valid (Gunakan YYYY-MM-DD).");
      } else if (birthTime > Date.now()) {
        errors.push("Tanggal lahir tidak boleh di masa depan.");
      }
    }

    // 5. Gender Validation
    let gender: "L" | "P" | null = null;
    if (genderRaw) {
      if (genderRaw.startsWith("L") || genderRaw === "LAKI-LAKI" || genderRaw === "PRIA") {
        gender = "L";
      } else if (genderRaw.startsWith("P") || genderRaw === "PEREMPUAN" || genderRaw === "WANITA") {
        gender = "P";
      } else {
        errors.push("Jenis kelamin harus 'L' (Laki-laki) atau 'P' (Perempuan).");
      }
    }

    // 6. Email Validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Format alamat email tidak valid.");
    }

    // 7. Entry Year Validation
    let entryYear: number | null = null;
    if (entryYearRaw) {
      const yr = parseInt(entryYearRaw, 10);
      if (isNaN(yr) || yr < 1980 || yr > 2100) {
        errors.push("Tahun masuk harus berupa angka tahun valid (contoh: 2025).");
      } else {
        entryYear = yr;
      }
    }

    // 8. Master Data Matching — Faculty
    let matchedFaculty: { id: string; code: string; name: string } | undefined = undefined;
    if (facultyStr) {
      const fNorm = facultyStr.toLowerCase();
      matchedFaculty = masterData.faculties.find(
        (f) => f.code.toLowerCase() === fNorm || f.name.toLowerCase() === fNorm
      );
      if (!matchedFaculty) {
        errors.push(`Fakultas '${facultyStr}' tidak ditemukan pada master data.`);
      }
    }

    // 9. Master Data Matching — Study Program
    let matchedProdi: { id: string; code: string; name: string; faculty_id?: string } | undefined = undefined;
    if (studyProgramStr) {
      const pNorm = studyProgramStr.toLowerCase();
      matchedProdi = masterData.studyPrograms.find(
        (p) => p.code.toLowerCase() === pNorm || p.name.toLowerCase() === pNorm
      );

      if (!matchedProdi) {
        errors.push(`Program studi '${studyProgramStr}' tidak ditemukan pada master data.`);
      } else if (matchedFaculty && matchedProdi.faculty_id && matchedProdi.faculty_id !== matchedFaculty.id) {
        errors.push(`Program studi '${studyProgramStr}' tidak sesuai dengan Fakultas '${facultyStr}'.`);
      }
    } else {
      errors.push("Program studi wajib diisi.");
    }

    // 10. Master Data Matching — Service Scheme
    let matchedScheme: { id: string; code: string; name: string } | undefined = undefined;
    if (serviceSchemeStr) {
      const sNorm = serviceSchemeStr.toLowerCase();
      matchedScheme = masterData.serviceSchemes.find(
        (s) => s.code.toLowerCase() === sNorm || s.name.toLowerCase() === sNorm
      );
      if (!matchedScheme) {
        errors.push(`Skema layanan '${serviceSchemeStr}' tidak ditemukan pada master data.`);
      }
    }

    // 11. Master Data Matching — Status
    let matchedStatus: { id: string; code: string; name: string } | undefined = undefined;
    if (statusStr) {
      const stNorm = statusStr.toLowerCase();
      matchedStatus = masterData.studentStatuses.find(
        (st) => st.code.toLowerCase() === stNorm || st.name.toLowerCase() === stNorm
      );
      if (!matchedStatus) {
        errors.push(`Status mahasiswa '${statusStr}' tidak ditemukan pada master data.`);
      }
    } else {
      // Default fallback by mode
      const defaultCode = mode === "calon" ? "calon" : "aktif";
      matchedStatus = masterData.studentStatuses.find(
        (st) => st.code.toLowerCase() === defaultCode
      );
    }

    const isValid = errors.length === 0;

    const normalizedData: NormalizedStudentImportData | null = isValid
      ? {
          fullName,
          nim,
          nik,
          placeOfBirth,
          dateOfBirth,
          gender,
          whatsapp,
          email,
          address,
          city,
          entryYear,
          facultyId: matchedFaculty?.id || null,
          studyProgramId: matchedProdi?.id || null,
          serviceSchemeId: matchedScheme?.id || null,
          statusId: matchedStatus?.id || null,
          statusEffectiveDate: statusEffectiveDate || new Date().toISOString().split("T")[0],
          notes,
          studyProgramName: matchedProdi?.name,
          serviceSchemeName: matchedScheme?.name,
          statusName: matchedStatus?.name,
        }
      : null;

    validatedRows.push({
      rowNumber: rowNum,
      raw: {
        nama_lengkap: fullName,
        nim: nim || "",
        nik: nik || "",
        tempat_lahir: placeOfBirth || "",
        tanggal_lahir: dateOfBirth || "",
        jenis_kelamin: genderRaw,
        whatsapp: whatsapp || "",
        email: email || "",
        alamat: address || "",
        kota: city || "",
        tahun_masuk: entryYearRaw,
        fakultas: facultyStr,
        program_studi: studyProgramStr,
        skema_layanan: serviceSchemeStr,
        status: statusStr,
        tanggal_efektif_status: statusEffectiveDate || "",
        catatan_internal: notes || "",
      },
      isValid,
      errors,
      warnings,
      maskedNik: nik ? maskNik(nik) : null,
      normalizedData,
    });
  });

  const validRowsCount = validatedRows.filter((r) => r.isValid).length;
  const errorRowsCount = validatedRows.length - validRowsCount;

  return {
    totalRows: validatedRows.length,
    validRowsCount,
    errorRowsCount,
    rows: validatedRows,
    mode,
    filename,
  };
}
