const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /proof_storage_path/i,
  /signed_url/i,
  /storage_path/i,
  /bearer/i,
  /credential/i,
];

const NIK_REGEX = /\b(\d{6})\d{6}(\d{4})\b/g;

export function formatWibTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const formattedDate = new Intl.DateTimeFormat("id-ID", options).format(date);
    return `${formattedDate} WIB`;
  } catch {
    return isoString;
  }
}

export function maskNikInText(text: string): string {
  if (!text) return "";
  return text.replace(NIK_REGEX, "$1******$2");
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return maskNikInText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        sanitizedObj[key] = "[REDACTED_SENSITIVE_DATA]";
      } else {
        sanitizedObj[key] = sanitizeAuditValue(val);
      }
    }
    return sanitizedObj;
  }

  return value;
}

export function sanitizeAuditPayload(
  payload: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!payload) return null;
  return sanitizeAuditValue(payload) as Record<string, unknown>;
}
