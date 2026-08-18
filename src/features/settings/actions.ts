"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { settingsSchema, validateSettingKeyAllowlist } from "@/lib/validation/settings";
import { getAppSettings, updateInMemorySettings } from "./queries";
import { SalutSettings, ALLOWED_SETTING_KEYS } from "@/types/settings";

export async function updateSettingsAction(prevState: unknown, formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return {
      error: "Hanya role Owner yang memiliki izin mengubah pengaturan sistem.",
    };
  }

  const rawFee = formData.get("default_salut_fee") as string;
  const parsedFee = Number(rawFee);

  const payload: Record<string, unknown> = {
    salut_name: formData.get("salut_name"),
    salut_official_name: formData.get("salut_official_name"),
    salut_address: formData.get("salut_address"),
    salut_city: formData.get("salut_city"),
    salut_province: formData.get("salut_province") || "",
    salut_postal_code: formData.get("salut_postal_code") || "",
    salut_whatsapp: formData.get("salut_whatsapp"),
    salut_email: formData.get("salut_email"),
    salut_leader_name: formData.get("salut_leader_name"),

    receipt_header_name: formData.get("receipt_header_name"),
    receipt_address: formData.get("receipt_address"),
    receipt_whatsapp: formData.get("receipt_whatsapp"),
    receipt_email: formData.get("receipt_email"),
    receipt_leader_name: formData.get("receipt_leader_name"),
    receipt_footer: formData.get("receipt_footer") || "",

    default_salut_fee: parsedFee,
  };

  // 1. Allowlist Key Validation
  for (const key of Object.keys(payload)) {
    const check = validateSettingKeyAllowlist(key);
    if (!check.isValid) {
      return { error: check.error };
    }
  }

  // Check if client passed any arbitrary keys in form data
  for (const key of Array.from(formData.keys())) {
    if (!key.startsWith("$ACTION") && !ALLOWED_SETTING_KEYS.includes(key as any)) {
      return {
        error: `Kunci pengaturan '${key}' tidak diizinkan. Kunci terlarang / arbitrary key ditolak oleh server security boundary.`,
      };
    }
  }

  // 2. Schema Validation
  const validation = settingsSchema.safeParse(payload);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data pengaturan tidak valid",
    };
  }

  const validatedData = validation.data;
  const oldSettings = await getAppSettings();

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();

      // Update salut_info, receipt_info, default_salut_fee in app_settings
      const salutInfoObj = {
        name: validatedData.salut_name,
        official_name: validatedData.salut_official_name,
        address: validatedData.salut_address,
        city: validatedData.salut_city,
        province: validatedData.salut_province,
        postal_code: validatedData.salut_postal_code,
        whatsapp: validatedData.salut_whatsapp,
        email: validatedData.salut_email,
        leader_name: validatedData.salut_leader_name,
      };

      const receiptInfoObj = {
        header_name: validatedData.receipt_header_name,
        address: validatedData.receipt_address,
        whatsapp: validatedData.receipt_whatsapp,
        email: validatedData.receipt_email,
        leader_name: validatedData.receipt_leader_name,
        footer: validatedData.receipt_footer,
      };

      const results = await Promise.all([
        supabase.from("app_settings").upsert({
          key: "salut_info",
          value: salutInfoObj,
          description: "Informasi identitas resmi SALUT",
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        }),
        supabase.from("app_settings").upsert({
          key: "receipt_info",
          value: receiptInfoObj,
          description: "Informasi kop dan footer kuitansi resmi",
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        }),
        supabase.from("app_settings").upsert({
          key: "default_salut_fee",
          value: { amount: validatedData.default_salut_fee, currency: "IDR" },
          description: "Nominal default biaya layanan SALUT per registrasi",
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        }),
      ]);

      const firstError = results.find((res) => res.error)?.error;
      if (firstError) {
        console.error("Gagal menyimpan app_settings di Supabase:", firstError);
        return {
          error: `Gagal menyimpan pengaturan ke database Supabase: ${firstError.message}`,
        };
      }
    } catch (err: any) {
      console.error("Exception saat menyimpan pengaturan:", err);
      return {
        error: `Terjadi kesalahan saat menyimpan pengaturan: ${err?.message || "Error tidak diketahui"}`,
      };
    }
  }

  const newSettingsObj: SalutSettings = {
    ...validatedData,
    updatedAt: new Date().toISOString(),
    updatedBy: profile.fullName,
  };

  updateInMemorySettings(newSettingsObj);

  // 3. Audit Event Logging (setting_changed)
  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      await supabase.from("audit_logs").insert({
        actor_user_id: profile.id,
        action: "setting_changed",
        entity_type: "app_settings",
        entity_id: null,
        old_data: {
          defaultFee: oldSettings.default_salut_fee,
          salutName: oldSettings.salut_name,
          receiptHeader: oldSettings.receipt_header_name,
        },
        new_data: {
          defaultFee: validatedData.default_salut_fee,
          salutName: validatedData.salut_name,
          receiptHeader: validatedData.receipt_header_name,
        },
        reason: "Pembaruan Konfigurasi Pengaturan Sistem oleh Owner",
      });
    } catch {
      // Audit log fallback
    }
  }

  revalidatePath("/pengaturan");
  revalidatePath("/pembayaran");

  return {
    success: true,
    message: "Pengaturan sistem SIM-SALUT Pangkalpinang berhasil diperbarui.",
  };
}

export async function fetchAppSettingsAction() {
  return await getAppSettings();
}
