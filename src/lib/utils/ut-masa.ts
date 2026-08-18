/**
 * Utility for Standard 5-digit UT Masa / Angkatan Calculation and Formatting
 *
 * Rule Pendaftaran UT:
 * - Oktober (10) - Desember (12) tahun N-1 s.d. Januari (1) tahun N => Angkatan 1 tahun N (Format: NNNN1)
 *   Contoh: Oktober 2025 - Januari 2026 = 20261 (Penerimaan 1 Masa 2026/2027 Ganjil)
 * - Februari (2) - September (9) tahun N => Angkatan 2 tahun N (Format: NNNN2)
 *   Contoh: Maret 2026 - Agustus 2026 = 20262 (Penerimaan 2 Masa 2026/2027 Genap)
 */

export function deriveUtMasaCode(dateInput?: Date | string | null): number {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return deriveUtMasaCode(new Date());
  }

  const month = d.getMonth() + 1; // 1-indexed: 1 = Jan, 10 = Oct, 12 = Dec
  const year = d.getFullYear();

  if (month >= 10) {
    // Oktober, November, Desember -> Angkatan 1 Tahun Depan (YYYY+1 Masa 1)
    return (year + 1) * 10 + 1;
  } else if (month === 1) {
    // Januari -> Angkatan 1 Tahun Ini (YYYY Masa 1)
    return year * 10 + 1;
  } else {
    // Februari s.d. September -> Angkatan 2 Tahun Ini (YYYY Masa 2)
    return year * 10 + 2;
  }
}

/**
 * Format 5-digit UT Masa code to human-readable label
 * Example:
 * 20261 -> "20261 (Masa 2026/2027 Ganjil - Penerimaan 1)"
 * 20262 -> "20262 (Masa 2026/2027 Genap - Penerimaan 2)"
 */
export function formatUtMasaLabel(code: number | string | null | undefined): string {
  if (!code) return "-";
  const str = String(code).trim();
  if (str.length !== 5) {
    return `${str}`;
  }

  const yr = parseInt(str.substring(0, 4), 10);
  const term = str.substring(4);

  if (term === "1") {
    return `${str} (Masa ${yr}/${yr + 1} Ganjil - Penerimaan 1)`;
  } else if (term === "2") {
    return `${str} (Masa ${yr}/${yr + 1} Genap - Penerimaan 2)`;
  }

  return `${str}`;
}

/**
 * Generates dropdown options list for Admin Student Edit / Form / Filter UI
 */
export function generateUtMasaOptions(startYear = 2022, endYear = 2030): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];

  for (let y = endYear; y >= startYear; y--) {
    const code2 = y * 10 + 2;
    const code1 = y * 10 + 1;

    options.push({
      value: code2,
      label: formatUtMasaLabel(code2),
    });
    options.push({
      value: code1,
      label: formatUtMasaLabel(code1),
    });
  }

  return options;
}
