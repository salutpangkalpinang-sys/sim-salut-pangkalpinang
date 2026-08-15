/**
 * SIM-SALUT Secure CSV Exporter Engine
 * Enforces UTF-8 BOM, CSV Formula Injection Escaping, NIK Masking & Proper Quote Sanitization
 */

export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value).trim();

  // CSV Formula Injection Protection:
  // If cell starts with =, +, -, @, prepend a single quote `'`
  if (/^[=+\-@]\s*/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes inside string
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function generateCsvString(headers: string[], rows: any[][]): string {
  // Add UTF-8 BOM for Microsoft Excel Indonesia compatibility
  const BOM = "\uFEFF";
  const headerLine = headers.map(escapeCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(","));

  return BOM + [headerLine, ...rowLines].join("\r\n");
}

export function maskNik(nik: string | null | undefined): string {
  if (!nik || nik.length < 16) return "-";
  return `${nik.substring(0, 4)}**********${nik.substring(12)}`;
}
