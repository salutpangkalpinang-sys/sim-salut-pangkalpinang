// Utility for Official UT 2026/2027 Tariff Calculations per Study Program & Service Scheme

export interface UtTariffInfo {
  sksRate: number;        // Non-SIPAS per SKS rate
  sipasNonTtmPackage: number; // UKT 3 Non-TTM Paket
  sipasSemiPackage: number;   // UKT 4 Semi Paket
}

/**
 * Returns exact official UT 2026/2027 tariff per study program based on SK Rektor No 4478
 */
export function getOfficialUtTariff(studyProgramNameOrCode: string): UtTariffInfo {
  const query = (studyProgramNameOrCode || "").toUpperCase();

  // 1. Pariwisata (PJJ Pariwisata)
  if (query.includes("PARIWISATA") || query.includes("471")) {
    return { sksRate: 80000, sipasNonTtmPackage: 1900000, sipasSemiPackage: 2600000 };
  }

  // 2. Sains Data
  if (query.includes("SAINS DATA") || query.includes("253")) {
    return { sksRate: 85000, sipasNonTtmPackage: 1900000, sipasSemiPackage: 2600000 };
  }

  // 3. Kewirausahaan
  if (query.includes("KEWIRAUSAHAAN") || query.includes("472")) {
    return { sksRate: 120000, sipasNonTtmPackage: 2600000, sipasSemiPackage: 2975000 };
  }

  // 4. Sistem Informasi
  if (query.includes("SISTEM INFORMASI") || query.includes("252")) {
    return { sksRate: 78000, sipasNonTtmPackage: 1800000, sipasSemiPackage: 2400000 };
  }

  // 5. Perpajakan (S1)
  if (query.includes("PERPAJAKAN") || query.includes("312")) {
    return { sksRate: 75000, sipasNonTtmPackage: 1800000, sipasSemiPackage: 2200000 };
  }

  // 6. Teknologi Pendidikan
  if (query.includes("TEKNOLOGI PENDIDIKAN") || query.includes("163")) {
    return { sksRate: 75000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 7. Perencanaan Wilayah dan Kota (PWK)
  if (query.includes("PERENCANAAN WILAYAH") || query.includes("PWK") || query.includes("279")) {
    return { sksRate: 54000, sipasNonTtmPackage: 1750000, sipasSemiPackage: 2400000 };
  }

  // 8. Akuntansi Keuangan Publik & Ekonomi Syariah
  if (query.includes("KEUANGAN PUBLIK") || query.includes("EKONOMI SYARIAH") || query.includes("483") || query.includes("458")) {
    return { sksRate: 51000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 9. Biologi, Fisika, Kimia, Teknologi Pangan, Agribisnis
  if (query.includes("BIOLOGI") || query.includes("FISIKA") || query.includes("KIMIA") || query.includes("PANGAN") || query.includes("AGRIBISNIS")) {
    return { sksRate: 55000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 10. Akuntansi S1
  if (query.includes("AKUNTANSI") || query.includes("83")) {
    return { sksRate: 38000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 11. Ilmu Hukum
  if (query.includes("HUKUM") || query.includes("311")) {
    return { sksRate: 40000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 12. Bahasa Indonesia, Bahasa Inggris, Matematika, FKIP Pendidikan
  if (query.includes("MATEMATIKA") || query.includes("BAHASA") || query.includes("PPKN") || query.includes("PENDIDIKAN EKONOMI")) {
    return { sksRate: 41000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
  }

  // 13. PGSD / PGPAUD
  if (query.includes("PGSD") || query.includes("PGPAUD") || query.includes("118") || query.includes("122")) {
    return { sksRate: 55000, sipasNonTtmPackage: 1600000, sipasSemiPackage: 1700000 };
  }

  // 14. Ilmu Administrasi Negara/Publik, Ilmu Administrasi Bisnis, Ilmu Pemerintahan, Ilmu Komunikasi, Sosiologi, Ekonomi Pembangunan, Manajemen, Statistika
  // Official UT Tariff for Administrasi Negara (312) = Rp 36.000 / SKS!
  return { sksRate: 36000, sipasNonTtmPackage: 1300000, sipasSemiPackage: 1750000 };
}
