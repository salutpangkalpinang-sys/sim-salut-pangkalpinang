// Comprehensive Tariff & Fee Engine for UT (Universitas Terbuka) Academic Year 2026/2027
// Based on SK Rektor No. 4478 & Official UT Pedoman Sistem Penyelenggaraan 2026/2027

export interface UtProgramTariff {
  sksRate: number;                  // Non-SIPAS Uang Kuliah per SKS (Tabel 3.4)
  sksReStudyRate: number;           // Biaya Mata Kuliah Ulang per SKS (Tabel 3.4)
  sipasNonTtmPackage: number;       // UKT 3 - SIPAS Non-TTM Paket (Tabel 3.3)
  sipasSemiPackage: number;         // UKT 4 - SIPAS Semi Paket (Tabel 3.3)
  sipasPenuhPackage: number;        // UKT 5 - SIPAS Penuh Paket (Tabel 3.3)
  sipasPlusPackage: number;         // UKT 6 - SIPAS Plus Paket (Tabel 3.3)
  praktikumReRegistrationFee: number; // Registrasi Ulang Praktik/Praktikum (Tabel 3.4)
  pkmPlpReRegistrationFee: number;    // Registrasi Ulang PKM/PLP (Tabel 3.4)
  studioReRegistrationFee: number;    // Registrasi Ulang Praktik Studio (Tabel 3.4)
}

/**
 * Returns exact official UT 2026/2027 fee structure per study program
 */
export function getOfficialUtTariff(studyProgramNameOrCode: string): UtProgramTariff {
  const query = (studyProgramNameOrCode || "").toUpperCase();

  // 1. Pariwisata (PJJ Pariwisata - 471)
  if (query.includes("PARIWISATA") || query.includes("471")) {
    return {
      sksRate: 80000,
      sksReStudyRate: 80000,
      sipasNonTtmPackage: 1900000,
      sipasSemiPackage: 2600000,
      sipasPenuhPackage: 3200000,
      sipasPlusPackage: 3400000,
      praktikumReRegistrationFee: 450000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 2. Sains Data (253)
  if (query.includes("SAINS DATA") || query.includes("253")) {
    return {
      sksRate: 85000,
      sksReStudyRate: 85000,
      sipasNonTtmPackage: 1900000,
      sipasSemiPackage: 2600000,
      sipasPenuhPackage: 3200000,
      sipasPlusPackage: 3400000,
      praktikumReRegistrationFee: 700000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 3. Kewirausahaan (472)
  if (query.includes("KEWIRAUSAHAAN") || query.includes("472")) {
    return {
      sksRate: 120000,
      sksReStudyRate: 120000,
      sipasNonTtmPackage: 2600000,
      sipasSemiPackage: 2975000,
      sipasPenuhPackage: 3200000,
      sipasPlusPackage: 3300000,
      praktikumReRegistrationFee: 0,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 4. Sistem Informasi (252)
  if (query.includes("SISTEM INFORMASI") || query.includes("252")) {
    return {
      sksRate: 78000,
      sksReStudyRate: 78000,
      sipasNonTtmPackage: 1800000,
      sipasSemiPackage: 2400000,
      sipasPenuhPackage: 3000000,
      sipasPlusPackage: 3200000,
      praktikumReRegistrationFee: 0,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 5. Perpajakan (S1 - 312)
  if (query.includes("PERPAJAKAN") || query.includes("312")) {
    return {
      sksRate: 75000,
      sksReStudyRate: 75000,
      sipasNonTtmPackage: 1800000,
      sipasSemiPackage: 2200000,
      sipasPenuhPackage: 2800000,
      sipasPlusPackage: 3000000,
      praktikumReRegistrationFee: 450000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 6. Teknologi Pendidikan (163)
  if (query.includes("TEKNOLOGI PENDIDIKAN") || query.includes("163")) {
    return {
      sksRate: 75000,
      sksReStudyRate: 75000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 350000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 7. Perencanaan Wilayah dan Kota (PWK - 279)
  if (query.includes("PERENCANAAN WILAYAH") || query.includes("PWK") || query.includes("279")) {
    return {
      sksRate: 54000,
      sksReStudyRate: 54000,
      sipasNonTtmPackage: 1750000,
      sipasSemiPackage: 2400000,
      sipasPenuhPackage: 3000000,
      sipasPlusPackage: 3200000,
      praktikumReRegistrationFee: 0,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 1500000,
    };
  }

  // 8. Akuntansi Keuangan Publik (483) & Ekonomi Syariah (458)
  if (query.includes("KEUANGAN PUBLIK") || query.includes("EKONOMI SYARIAH") || query.includes("483") || query.includes("458")) {
    return {
      sksRate: 51000,
      sksReStudyRate: 51000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 350000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 9. Biologi, Fisika, Kimia, Teknologi Pangan, Agribisnis (FKIP / FST Sains)
  if (query.includes("BIOLOGI") || query.includes("FISIKA") || query.includes("KIMIA") || query.includes("PANGAN") || query.includes("AGRIBISNIS")) {
    return {
      sksRate: 55000,
      sksReStudyRate: 55000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 700000,
      pkmPlpReRegistrationFee: 700000,
      studioReRegistrationFee: 0,
    };
  }

  // 10. Akuntansi S1 (83)
  if (query.includes("AKUNTANSI") || query.includes("83")) {
    return {
      sksRate: 38000,
      sksReStudyRate: 38000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 190000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 11. Ilmu Hukum (311)
  if (query.includes("HUKUM") || query.includes("311")) {
    return {
      sksRate: 40000,
      sksReStudyRate: 40000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 450000,
      pkmPlpReRegistrationFee: 0,
      studioReRegistrationFee: 0,
    };
  }

  // 12. Bahasa Indonesia, Bahasa Inggris, Matematika, FKIP Pendidikan Umum
  if (query.includes("MATEMATIKA") || query.includes("BAHASA") || query.includes("PPKN") || query.includes("PENDIDIKAN EKONOMI")) {
    return {
      sksRate: 41000,
      sksReStudyRate: 41000,
      sipasNonTtmPackage: 1300000,
      sipasSemiPackage: 1750000,
      sipasPenuhPackage: 2200000,
      sipasPlusPackage: 2400000,
      praktikumReRegistrationFee: 0,
      pkmPlpReRegistrationFee: 700000,
      studioReRegistrationFee: 0,
    };
  }

  // 13. PGSD / PGPAUD (118 / 122)
  if (query.includes("PGSD") || query.includes("PGPAUD") || query.includes("118") || query.includes("122")) {
    return {
      sksRate: 55000,
      sksReStudyRate: 55000,
      sipasNonTtmPackage: 1600000,
      sipasSemiPackage: 1700000,
      sipasPenuhPackage: 2700000,
      sipasPlusPackage: 2900000,
      praktikumReRegistrationFee: 0,
      pkmPlpReRegistrationFee: 700000,
      studioReRegistrationFee: 0,
    };
  }

  // 14. Ilmu Administrasi Negara / Publik (312), Ilmu Administrasi Bisnis (51), Ilmu Pemerintahan (71), Ilmu Komunikasi (72), Sosiologi (70), Ekonomi Pembangunan (53), Manajemen (54), Statistika (56)
  // Default resmi UT: SKS Rp 36.000, Non-TTM Rp 1.300.000, Semi Rp 1.750.000
  return {
    sksRate: 36000,
    sksReStudyRate: 36000,
    sipasNonTtmPackage: 1300000,
    sipasSemiPackage: 1750000,
    sipasPenuhPackage: 2200000,
    sipasPlusPackage: 2400000,
    praktikumReRegistrationFee: 0,
    pkmPlpReRegistrationFee: 0,
    studioReRegistrationFee: 0,
  };
}

/**
 * Official UT 2026/2027 General Academic & Administrative Fees (Tabel 3.6 & Syarat Ketentuan UT)
 */
export const UT_OFFICIAL_GENERAL_FEES = {
  ADMISION: { name: "Biaya Admisi Pendaftaran Baru UT", amount: 100000, unit: "Per Pendaftaran" },
  RPL: { name: "Biaya Rekognisi Pembelajaran Lampau (RPL)", amount: 300000, unit: "Per Pengusulan" },
  WISUDA: { name: "Biaya Wisuda", amount: 750000, unit: "Per Mahasiswa" },
  LEGALISIR: { name: "Biaya Penerbitan Salinan & Legalisir Ijazah/Transkrip", amount: 50000, unit: "Per Set (@ 10 Lembar)" },
  TERJEMAHAN_SATUAN: { name: "Biaya Terjemahan Ijazah & Transkrip (Satuan)", amount: 150000, unit: "Per Satuan" },
  TERJEMAHAN_PAKET: { name: "Biaya Terjemahan Ijazah & Transkrip (Paket + SKPI & Ongkir)", amount: 250000, unit: "Per Paket" },
  SALINAN_DOKUMEN_KELULUSAN: { name: "Biaya Penggandaan / Salinan Dokumen Kelulusan", amount: 50000, unit: "Per Set" },
  TTM_ATPEM: { name: "Biaya TTM Atpem (Tutorial Tatap Muka Atas Permintaan)", amount: 150000, unit: "Per Mata Kuliah" },
  PINDAH_MODUS_UJIAN: { name: "Biaya Pindah Modus Ujian / Ubah Jadwal UO", amount: 150000, unit: "Per Mata Kuliah" },
  REMEDIAL_UO: { name: "Biaya Registrasi Remedial / Ujian Ulang UO", amount: 150000, unit: "Per Mata Kuliah" },
  RE_REGISTRATION_TAPS_SKRIPSI_PKP: { name: "Registrasi Ulang Skripsi PKP FKIP", amount: 750000, unit: "Per Registrasi Ulang" },
  RE_REGISTRATION_TAPS_OTHER: { name: "Registrasi Ulang TAPS (Skripsi/Proyek/Artikel/UKT)", amount: 400000, unit: "Per Registrasi Ulang" },
  KTM_REPLACEMENT: { name: "Biaya Penggantian KTM Hilang/Rusak", amount: 50000, unit: "Per Kartu" },
  IKA_UT_ACTIVATION: { name: "Biaya Aktivasi Ikatan Keluarga Alumni (IKA-UT)", amount: 150000, unit: "Per Lulusan" },
};
