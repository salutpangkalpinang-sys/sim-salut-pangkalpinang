import { z } from "zod";
import { ALLOWED_SETTING_KEYS, AllowedSettingKey } from "@/types/settings";

export const settingsSchema = z.object({
  salut_name: z.string().trim().min(2, "Nama SALUT minimal 2 karakter").max(100, "Nama SALUT maksimal 100 karakter"),
  salut_official_name: z.string().trim().min(2, "Nama resmi SALUT minimal 2 karakter").max(150, "Nama resmi SALUT maksimal 150 karakter"),
  salut_address: z.string().trim().min(5, "Alamat SALUT minimal 5 karakter").max(250, "Alamat SALUT maksimal 250 karakter"),
  salut_city: z.string().trim().min(2, "Kota SALUT minimal 2 karakter").max(100, "Kota SALUT maksimal 100 karakter"),
  salut_province: z.string().trim().optional().default(""),
  salut_postal_code: z.string().trim().optional().default(""),
  salut_whatsapp: z.string().trim().min(8, "Nomor WhatsApp minimal 8 karakter"),
  salut_email: z.string().trim().email("Format email SALUT tidak valid"),
  salut_leader_name: z.string().trim().min(2, "Nama pimpinan minimal 2 karakter").max(100, "Nama pimpinan maksimal 100 karakter"),

  receipt_header_name: z.string().trim().min(2, "Nama kop kuitansi minimal 2 karakter").max(100, "Nama kop kuitansi maksimal 100 karakter"),
  receipt_address: z.string().trim().min(5, "Alamat kuitansi minimal 5 karakter").max(250, "Alamat kuitansi maksimal 250 karakter"),
  receipt_whatsapp: z.string().trim().min(8, "Nomor WhatsApp kuitansi minimal 8 karakter"),
  receipt_email: z.string().trim().email("Format email kuitansi tidak valid"),
  receipt_leader_name: z.string().trim().min(2, "Nama penanggung jawab kuitansi minimal 2 karakter").max(100, "Nama penanggung jawab kuitansi maksimal 100 karakter"),
  receipt_footer: z.string().trim().max(500, "Footer kuitansi maksimal 500 karakter").optional().default(""),

  default_salut_fee: z
    .number({ invalid_type_error: "Default biaya layanan SALUT harus berupa angka Integer Rupiah" })
    .int("Default biaya layanan SALUT harus berupa bilangan bulat Rupiah (tanpa sen/desimal)")
    .min(0, "Default biaya layanan SALUT tidak boleh negatif"),
});

export function validateSettingKeyAllowlist(key: string): { isValid: boolean; error?: string } {
  const isAllowed = ALLOWED_SETTING_KEYS.includes(key as AllowedSettingKey);
  if (!isAllowed) {
    return {
      isValid: false,
      error: `Kunci pengaturan '${key}' tidak diizinkan. Kunci terlarang / arbitrary key ditolak oleh server security boundary.`,
    };
  }
  return { isValid: true };
}
