import { z } from "zod";

export const ALLOWED_FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateFileMetadata(fileName: string, mimeType: string, fileSize: number) {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, message: "Ukuran berkas melebihi batas maksimal 10 MB." };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return { valid: false, message: "Format berkas tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP." };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, message: "MIME type berkas tidak didukung." };
  }

  return { valid: true };
}

/**
 * Server-Side Magic-Byte Signature Validation
 * Inspects initial bytes of file buffer to prevent extension/MIME spoofing (e.g., malicious .exe renamed to .pdf)
 */
export function validateFileMagicBytes(buffer: Buffer, fileName: string): { valid: boolean; message?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false, message: "Berkas kosong atau tidak dapat dibaca." };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Magic bytes checks
  const isPdf =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d; // %PDF-

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50; // WEBP

  if (ext === "pdf" && !isPdf) {
    return {
      valid: false,
      message: "Isi berkas bukan dokumen PDF yang valid. Pengunggahan ditolak.",
    };
  }

  if ((ext === "jpg" || ext === "jpeg") && !isJpeg) {
    return {
      valid: false,
      message: "Isi berkas bukan gambar JPEG/JPG yang valid. Pengunggahan ditolak.",
    };
  }

  if (ext === "png" && !isPng) {
    return {
      valid: false,
      message: "Isi berkas bukan gambar PNG yang valid. Pengunggahan ditolak.",
    };
  }

  if (ext === "webp" && !isWebp) {
    return {
      valid: false,
      message: "Isi berkas bukan gambar WEBP yang valid. Pengunggahan ditolak.",
    };
  }

  if (!isPdf && !isJpeg && !isPng && !isWebp) {
    return {
      valid: false,
      message: "Magic byte signature berkas tidak dikenal atau bukan format yang didukung.",
    };
  }

  return { valid: true };
}

export const lipDocumentSchema = z.object({
  registrationId: z.string({ required_error: "Registrasi wajib dipilih" }).uuid("ID Registrasi tidak valid"),
  lipNumber: z.string({ required_error: "Nomor LIP wajib diisi" }).trim().min(3, "Nomor LIP minimal 3 karakter"),
  officialAmount: z
    .number({ required_error: "Total Resmi LIP wajib diisi" })
    .int("Nominal harus berupa Integer Rupiah")
    .gte(0, "Total Resmi LIP tidak boleh negatif"),
  tuitionAmount: z
    .number()
    .int("Nominal SPP/Uang Kuliah harus berupa Integer Rupiah")
    .gte(0)
    .default(0),
  bookAmount: z
    .number()
    .int("Nominal Bahan Ajar/Buku harus berupa Integer Rupiah")
    .gte(0)
    .default(0),
  shippingAmount: z
    .number()
    .int("Nominal Biaya Kirim harus berupa Integer Rupiah")
    .gte(0)
    .default(0),
  otherUtAmount: z
    .number()
    .int("Nominal Biaya UT lainnya harus berupa Integer Rupiah")
    .gte(0)
    .default(0),
  issuedAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createInvoiceItemSchema = z.object({
  itemType: z.enum(["ut_liability", "service_fee", "internal_fee", "discount"]),
  feeTypeId: z.string().nullable().optional(),
  description: z.string().trim().min(1, "Deskripsi item wajib diisi"),
  quantity: z.number().int().gte(1).default(1),
  unitAmount: z.number().int().gte(0).default(0),
  amount: z.number().int().gte(0).optional(),
  isDiscount: z.boolean().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().nullable().optional(),
  approvalStatus: z.string().nullable().optional(),
  approvalReason: z.string().nullable().optional(),
});

export const createInvoiceSchema = z.object({
  registrationId: z.string().uuid("ID Registrasi tidak valid"),
  lipDocumentId: z.string().uuid("ID Document LIP tidak valid").nullable().optional(),
  dueAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(createInvoiceItemSchema).min(1, "Minimal 1 item tagihan"),
});

export type CreateInvoiceFormInput = z.infer<typeof createInvoiceSchema>;

export const discountApprovalSchema = z.object({
  invoiceItemId: z.string().uuid("ID Item Discount tidak valid"),
  action: z.enum(["approve", "reject"]),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type DiscountApprovalFormInput = z.infer<typeof discountApprovalSchema>;
