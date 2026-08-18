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

// Helper to parse Excel numeric date codes (e.g. 34812 -> 1995-04-23)
export function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === "") return "";
  const str = String(val).trim();
  if (
    typeof val === "number" ||
    (!isNaN(Number(str)) &&
      Number(str) > 10000 &&
      Number(str) < 80000 &&
      !str.includes("-") &&
      !str.includes("/"))
  ) {
    try {
      const parsed = XLSX.SSF.parse_date_code(Number(str));
      if (parsed) {
        const yyyy = parsed.y;
        const mm = String(parsed.m).padStart(2, "0");
        const dd = String(parsed.d).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
  }
  return str;
}

// Clean string for header matching
function cleanHeaderKey(key: any): string {
  return String(key || "")
    .toLowerCase()
    .trim()
    .replace(/[\ufeff\r]/g, "")
    .replace(/[._\-/\s]+/g, " ");
}

const FIELD_ALIASES: Record<string, string[]> = {
  fullName: [
    "nama_lengkap", "nama lengkap", "nama", "nama mahasiswa", "fullname",
    "name", "namalengkap", "nama_mhs", "nama mhs", "mhs"
  ],
  nim: [
    "nim", "no nim", "no_nim", "no.nim", "no. nim", "nim mahasiswa",
    "nim_mhs", "nomor induk mahasiswa", "n.i.m"
  ],
  nik: [
    "nik", "no nik", "no_nik", "no.nik", "no. nik", "nik (ktp)", "nik ktp",
    "no ktp", "no. ktp", "ktp", "nik/ktp", "nik mahasiswa", "nomor induk kependudukan"
  ],
  placeOfBirth: [
    "tempat_lahir", "tempat lahir", "tmp_lahir", "tmp lahir", "tmp. lahir",
    "tempat lahir mahasiswa", "tmpt lahir", "tempat", "tmp"
  ],
  dateOfBirth: [
    "tanggal_lahir", "tanggal lahir", "tgl_lahir", "tgl lahir", "tgl. lahir",
    "tgllahir", "tanggal lahir (yyyy-mm-dd)", "tgl lahir (yyyy-mm-dd)"
  ],
  gender: [
    "jenis_kelamin", "jenis kelamin", "jk", "j_k", "gender", "sex", "kelamin"
  ],
  whatsapp: [
    "whatsapp", "no_wa", "no wa", "no. wa", "wa", "no hp", "no. hp", "hp",
    "telepon", "no telepon", "no. telp", "no_hp", "no_telp", "phone", "mobile"
  ],
  email: [
    "email", "e-mail", "alamat email", "mail"
  ],
  address: [
    "alamat", "alamat domisili", "alamat rumah", "address", "street"
  ],
  city: [
    "kota", "kota/kabupaten", "kabupaten", "kab/kota", "kabupaten/kota", "city"
  ],
  entryYear: [
    "tahun_masuk", "tahun masuk", "thn_masuk", "thn masuk", "thn. masuk",
    "angkatan", "thn_angkatan", "year"
  ],
  faculty: [
    "fakultas", "fak", "faculty"
  ],
  studyProgram: [
    "program_studi", "program studi", "prodi", "jurusan", "progstudi",
    "nama prodi", "nama program studi"
  ],
  serviceScheme: [
    "skema_layanan", "skema layanan", "skema", "skema ut", "layanan"
  ],
  status: [
    "status", "status mahasiswa", "status mhs"
  ],
  statusEffectiveDate: [
    "tanggal_efektif_status", "tanggal efektif status", "tgl efektif status",
    "tgl efektif", "tgl. efektif"
  ],
  notes: [
    "catatan_internal", "catatan internal", "catatan", "keterangan", "remark", "notes"
  ]
};

function matchCanonicalField(cleanedHeader: string): string | null {
  if (!cleanedHeader) return null;
  // 1. Direct match on exact alias list
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(cleanedHeader)) {
      return field;
    }
  }
  // 2. Partial / Substring matching for resilient fallback
  if (cleanedHeader.includes("nama") && !cleanedHeader.includes("prodi") && !cleanedHeader.includes("studi")) return "fullName";
  if (cleanedHeader.includes("nim")) return "nim";
  if (cleanedHeader.includes("nik") || cleanedHeader.includes("ktp")) return "nik";
  if (cleanedHeader.includes("prodi") || cleanedHeader.includes("jurusan") || cleanedHeader.includes("program studi")) return "studyProgram";
  if (cleanedHeader.includes("skema")) return "serviceScheme";
  if (cleanedHeader.includes("fakultas")) return "faculty";
  if (cleanedHeader.includes("status")) return "status";
  if (cleanedHeader.includes("wa") || cleanedHeader.includes("hp") || cleanedHeader.includes("telepon") || cleanedHeader.includes("phone")) return "whatsapp";
  if (cleanedHeader.includes("email")) return "email";
  if (cleanedHeader.includes("alamat")) return "address";
  if (cleanedHeader.includes("kota") || cleanedHeader.includes("kabupaten")) return "city";
  if (cleanedHeader.includes("angkatan") || cleanedHeader.includes("tahun")) return "entryYear";
  if (cleanedHeader.includes("tgl lahir") || cleanedHeader.includes("tanggal lahir")) return "dateOfBirth";
  if (cleanedHeader.includes("tmp lahir") || cleanedHeader.includes("tempat lahir")) return "placeOfBirth";
  if (cleanedHeader.includes("jk") || cleanedHeader.includes("kelamin") || cleanedHeader.includes("gender")) return "gender";
  if (cleanedHeader.includes("catatan") || cleanedHeader.includes("keterangan")) return "notes";

  return null;
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
    const readOpts: XLSX.ParsingOptions = { type: "buffer", raw: true };
    if (ext === "csv") {
      const csvStr = buffer.toString("utf-8");
      const firstLine = csvStr.split(/\r?\n/)[0] || "";
      const semiCount = (firstLine.match(/;/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;

      if (semiCount > commaCount && semiCount > tabCount) {
        readOpts.FS = ";";
      } else if (tabCount > commaCount && tabCount > semiCount) {
        readOpts.FS = "\t";
      }
    }
    workbook = XLSX.read(buffer, readOpts);
  } catch (err: any) {
    throw new Error(`Gagal membaca berkas spreadsheet: ${err?.message || "File corrupt/invalid"}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Berkas spreadsheet kosong atau tidak memiliki sheet.");
  }

  const worksheet = workbook.Sheets[sheetName];

  // Read entire worksheet as 2D array (Array of Arrays)
  const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!aoa || aoa.length === 0) {
    throw new Error("File spreadsheet tidak berisi data baris (kosong).");
  }

  // Find the header row index (scanning first 15 rows)
  let headerRowIdx = -1;
  let maxScore = -1;

  for (let r = 0; r < Math.min(15, aoa.length); r++) {
    const row = aoa[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    row.forEach((cell) => {
      const cleaned = cleanHeaderKey(cell);
      if (cleaned && matchCanonicalField(cleaned)) {
        score++;
      }
    });

    if (score > maxScore && score > 0) {
      maxScore = score;
      headerRowIdx = r;
    }
  }

  // Fallback to row 0 if no clear header detected
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const headerCells = aoa[headerRowIdx] || [];
  const colIndexToCanonicalMap: (string | null)[] = headerCells.map((cell: any) => {
    const cleaned = cleanHeaderKey(cell);
    return matchCanonicalField(cleaned);
  });

  // Extract raw rows
  const rawRows: Record<string, any>[] = [];
  const rawRowsExcelLineNumbers: number[] = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const rowData = aoa[r];
    if (!Array.isArray(rowData)) continue;

    // Check if row is completely empty
    const isAllEmpty = rowData.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
    if (isAllEmpty) continue;

    const rowObj: Record<string, any> = {};
    headerCells.forEach((hCell: any, colIdx: number) => {
      const headerStr = String(hCell || "").trim();
      const val = rowData[colIdx] !== undefined ? rowData[colIdx] : "";
      if (headerStr) {
        rowObj[headerStr] = val;
      }
      const canonical = colIndexToCanonicalMap[colIdx];
      if (canonical && !(canonical in rowObj)) {
        rowObj[canonical] = val;
      }
    });

    rawRows.push(rowObj);
    rawRowsExcelLineNumbers.push(r + 1); // 1-indexed row number in spreadsheet
  }

  if (rawRows.length === 0) {
    throw new Error("File spreadsheet tidak berisi data baris setelah header.");
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
    const rowNum = rawRowsExcelLineNumbers[idx];
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
    const rowNum = rawRowsExcelLineNumbers[idx];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract fields (support flexible alias matching + direct column names)
    const fullName = normalizeStringValue(row.fullName || row.nama_lengkap || row.Nama || row["Nama Lengkap"]);
    const nim = normalizeStringValue(row.nim || row.NIM) || null;
    const nik = normalizeStringValue(row.nik || row.NIK) || null;
    const placeOfBirth = normalizeStringValue(row.placeOfBirth || row.tempat_lahir || row["Tempat Lahir"]) || null;
    const dateOfBirth = parseExcelDate(row.dateOfBirth || row.tanggal_lahir || row["Tanggal Lahir"]) || null;
    const genderRaw = normalizeStringValue(row.gender || row.jenis_kelamin || row["Jenis Kelamin"]).toUpperCase();
    const whatsapp = normalizeStringValue(row.whatsapp || row.No_WA || row.WhatsApp) || null;
    const email = normalizeStringValue(row.email || row.Email) || null;
    const address = normalizeStringValue(row.address || row.alamat || row.Alamat) || null;
    const city = normalizeStringValue(row.city || row.kota || row.Kota) || null;
    const entryYearRaw = normalizeStringValue(row.entryYear || row.tahun_masuk || row["Tahun Masuk"]);
    const facultyStr = normalizeStringValue(row.faculty || row.fakultas || row.Fakultas);
    const studyProgramStr = normalizeStringValue(row.studyProgram || row.program_studi || row["Program Studi"] || row.Prodi);
    const serviceSchemeStr = normalizeStringValue(row.serviceScheme || row.skema_layanan || row["Skema Layanan"]);
    const statusStr = normalizeStringValue(row.status || row.Status);
    const statusEffectiveDate = parseExcelDate(row.statusEffectiveDate || row.tanggal_efektif_status || row["Tanggal Efektif Status"]) || null;
    const notes = normalizeStringValue(row.notes || row.catatan_internal || row["Catatan Internal"]) || null;

    // 0. Formula Cell Guard (Reject raw spreadsheet formulas)
    const rawCells = [
      String(row.fullName || row.nama_lengkap || row.Nama || ""),
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

    // 7. Entry Year Validation (Supports 4-digit 2026 or 5-digit UT Masa 20261 / 20262)
    let entryYear: number | null = null;
    if (entryYearRaw) {
      const yr = parseInt(entryYearRaw, 10);
      const is4DigitValid = !isNaN(yr) && yr >= 1980 && yr <= 2100;
      const is5DigitValid = !isNaN(yr) && yr >= 19801 && yr <= 21002;

      if (!is4DigitValid && !is5DigitValid) {
        errors.push("Tahun masuk / angkatan harus berupa angka tahun 4 digit (contoh: 2026) atau 5 digit masa UT (contoh: 20261 / 20262).");
      } else {
        entryYear = yr;
      }
    }

// Clean match helper: removes punctuation, hyphens, underscores, extra spaces
function cleanMatchKey(str: string): string {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[._\-/\s]+/g, " ");
}

// Strip common prefix noise like 'ilmu ', 'pendidikan ', 's1 ', 'd3 ', 'd4 ' for flexible prodi matching
function normalizeProdiMatch(str: string): string {
  let cleaned = cleanMatchKey(str);
  cleaned = cleaned.replace(/^(s1|d3|d4|diploma 3|diploma 4|sarjana|ilmu)\s+/, "");
  return cleaned;
}

    // 8. Master Data Matching — Faculty
    let matchedFaculty: { id: string; code: string; name: string } | undefined = undefined;
    if (facultyStr) {
      const fClean = cleanMatchKey(facultyStr);
      matchedFaculty = masterData.faculties.find((f) => {
        const codeClean = cleanMatchKey(f.code);
        const nameClean = cleanMatchKey(f.name);
        return codeClean === fClean || nameClean === fClean || fClean.includes(codeClean);
      });
      if (!matchedFaculty) {
        errors.push(`Fakultas '${facultyStr}' tidak ditemukan pada master data.`);
      }
    }

    // 9. Master Data Matching — Study Program
    let matchedProdi: { id: string; code: string; name: string; faculty_id?: string } | undefined = undefined;
    if (studyProgramStr) {
      const pClean = cleanMatchKey(studyProgramStr);
      const pNorm = normalizeProdiMatch(studyProgramStr);

      matchedProdi = masterData.studyPrograms.find((p) => {
        const codeClean = cleanMatchKey(p.code);
        const nameClean = cleanMatchKey(p.name);
        const nameNorm = normalizeProdiMatch(p.name);
        return (
          codeClean === pClean ||
          nameClean === pClean ||
          nameNorm === pNorm ||
          nameClean.includes(pClean) ||
          pClean.includes(nameClean) ||
          nameNorm.includes(pNorm) ||
          pNorm.includes(nameNorm)
        );
      });

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
      const sClean = cleanMatchKey(serviceSchemeStr);
      matchedScheme = masterData.serviceSchemes.find((s) => {
        const codeClean = cleanMatchKey(s.code);
        const nameClean = cleanMatchKey(s.name);
        return (
          codeClean === sClean ||
          nameClean === sClean ||
          codeClean.replace(/_/g, " ") === sClean ||
          nameClean.replace(/[^a-z0-9]/g, "") === sClean.replace(/[^a-z0-9]/g, "")
        );
      });

      // Flexible alias fallbacks for common user variations
      if (!matchedScheme) {
        if (sClean.includes("non ttm") || sClean.includes("nonttm")) {
          matchedScheme = masterData.serviceSchemes.find((s) => s.code.toUpperCase().includes("NON_TTM"));
        } else if (sClean.includes("semi")) {
          matchedScheme = masterData.serviceSchemes.find((s) => s.code.toUpperCase().includes("SEMI"));
        } else if (sClean.includes("full") || sClean.includes("penuh")) {
          matchedScheme = masterData.serviceSchemes.find((s) => s.code.toUpperCase().includes("FULL"));
        } else if (sClean.includes("ttm")) {
          matchedScheme = masterData.serviceSchemes.find((s) => s.code.toUpperCase() === "SIPAS_TTM");
        } else if (sClean.includes("non sipas") || sClean.includes("sks")) {
          matchedScheme = masterData.serviceSchemes.find((s) => s.code.toUpperCase() === "NON_SIPAS");
        }
      }

      if (!matchedScheme) {
        errors.push(`Skema layanan '${serviceSchemeStr}' tidak ditemukan pada master data.`);
      }
    }

    // 11. Master Data Matching — Status
    let matchedStatus: { id: string; code: string; name: string } | undefined = undefined;
    if (statusStr) {
      const stClean = cleanMatchKey(statusStr);
      matchedStatus = masterData.studentStatuses.find((st) => {
        const codeClean = cleanMatchKey(st.code);
        const nameClean = cleanMatchKey(st.name);
        return codeClean === stClean || nameClean === stClean;
      });

      // Flexible alias fallbacks for status (e.g. MABA, CAMABA, MAHASISWA BARU -> CALON)
      if (!matchedStatus) {
        if (["maba", "camaba", "mahasiswa baru", "baru", "calon", "calon mahasiswa"].includes(stClean) || stClean.includes("calon") || stClean.includes("maba")) {
          matchedStatus = masterData.studentStatuses.find((st) => st.code.toLowerCase() === "calon");
        } else if (["aktif", "mahasiswa aktif", "mhs aktif"].includes(stClean) || stClean.includes("aktif")) {
          matchedStatus = masterData.studentStatuses.find((st) => st.code.toLowerCase() === "aktif");
        } else if (["cuti", "cuti akademik"].includes(stClean) || stClean.includes("cuti")) {
          matchedStatus = masterData.studentStatuses.find((st) => st.code.toLowerCase() === "cuti");
        } else if (["lulus", "alumni"].includes(stClean) || stClean.includes("lulus")) {
          matchedStatus = masterData.studentStatuses.find((st) => st.code.toLowerCase() === "lulus");
        } else if (["drop out", "do", "do/dikeluarkan"].includes(stClean)) {
          matchedStatus = masterData.studentStatuses.find((st) => st.code.toLowerCase() === "do");
        }
      }

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

