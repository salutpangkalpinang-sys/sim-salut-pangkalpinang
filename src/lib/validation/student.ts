import { z } from "zod";

// Helper function to normalize empty strings to null
const emptyToNull = z
  .string()
  .transform((val) => {
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .nullable()
  .optional();

// Helper function to normalize WhatsApp phone numbers (e.g. 0812345678 -> 62812345678)
export function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/\D/g, "");
  if (!digitsOnly) return null;
  if (digitsOnly.startsWith("0")) {
    return "62" + digitsOnly.slice(1);
  }
  return digitsOnly;
}

export const studentSchema = z.object({
  fullName: z
    .string({ required_error: "Nama lengkap wajib diisi" })
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter"),
  nim: emptyToNull.refine(
    (val) => !val || /^[0-9A-Za-z]+$/.test(val),
    "NIM hanya boleh berisi huruf dan angka"
  ),
  nik: emptyToNull.refine(
    (val) => !val || /^\d{16}$/.test(val),
    "NIK harus berupa 16 digit angka"
  ),
  birthPlace: emptyToNull,
  birthDate: emptyToNull.refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    if (isNaN(date.getTime())) return false;
    return date <= new Date();
  }, "Tanggal lahir tidak boleh di masa depan"),
  gender: z.enum(["L", "P"]).nullable().optional(),
  whatsapp: z
    .string()
    .transform(normalizeWhatsApp)
    .nullable()
    .optional(),
  email: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: "Format email tidak valid",
    })
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  address: emptyToNull,
  city: emptyToNull,
  entryYear: z
    .union([z.number(), z.string().transform((val) => parseInt(val, 10))])
    .refine(
      (val) =>
        !val ||
        (isNaN(val)
          ? false
          : (val >= 1980 && val <= 2100) || (val >= 19801 && val <= 21002)),
      "Angkatan / Tahun masuk harus berupa tahun 4 digit (contoh: 2026) atau 5 digit masa UT (contoh: 20261)"
    )
    .nullable()
    .optional(),
  facultyId: emptyToNull,
  studyLevelId: emptyToNull,
  studyProgramId: emptyToNull,
  serviceSchemeId: emptyToNull,
  statusId: z.string({ required_error: "Status mahasiswa wajib dipilih" }).uuid("Status tidak valid"),
  internalNotes: emptyToNull,
});

export type StudentFormInput = z.infer<typeof studentSchema>;

export const statusChangeSchema = z.object({
  studentId: z.string().uuid("ID Mahasiswa tidak valid"),
  newStatusId: z.string().uuid("Status baru tidak valid"),
  effectiveAt: z.string().optional(),
  reason: z.string().trim().min(3, "Alasan perubahan status minimal 3 karakter"),
});

export type StatusChangeFormInput = z.infer<typeof statusChangeSchema>;
