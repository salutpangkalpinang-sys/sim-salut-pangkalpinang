import { createClient } from "@/lib/supabase/server";
import { SalutSettings, ALLOWED_SETTING_KEYS } from "@/types/settings";

const DEFAULT_SETTINGS: SalutSettings = {
  salut_name: "SALUT Pangkalpinang",
  salut_official_name: "Sentra Layanan Universitas Terbuka Pangkalpinang",
  salut_address: "Jl. Utama No. 12, Pangkalpinang",
  salut_city: "Pangkalpinang",
  salut_province: "Kepulauan Bangka Belitung",
  salut_postal_code: "33111",
  salut_whatsapp: "081234567890",
  salut_email: "info@salut-pangkalpinang.ac.id",
  salut_leader_name: "Drs. H. Ahmad Subagyo, M.M.",

  receipt_header_name: "SALUT PANGKALPINANG",
  receipt_address: "Jl. Utama No. 12, Pangkalpinang, Bangka Belitung",
  receipt_whatsapp: "081234567890",
  receipt_email: "keuangan@salut-pangkalpinang.ac.id",
  receipt_leader_name: "Drs. H. Ahmad Subagyo, M.M.",
  receipt_footer: "1. Bukti pembayaran ini adalah dokumen sah pengganti kuitansi fisik.\n2. Harap simpan bukti kuitansi ini untuk keperluan administrasi akademik.",

  default_salut_fee: 400000,
  updatedAt: new Date("2026-08-15T08:00:00Z").toISOString(),
  updatedBy: "Owner SIM-SALUT",
};

// In-memory store for dev mode fallback
let IN_MEMORY_SETTINGS_STORE: SalutSettings = { ...DEFAULT_SETTINGS };

export async function getAppSettings(): Promise<SalutSettings> {
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();

      const { data: rows, error } = await supabase
        .from("app_settings")
        .select("key, value, updated_at, updated_by");

      if (!error && rows && rows.length > 0) {
        const fetched: Partial<SalutSettings> = {};
        let lastUpdatedAt: string | null = null;
        let lastUpdatedBy: string | null = null;

        for (const row of rows) {
          // Explicitly ignore any key that is not in our ALLOWED_SETTING_KEYS allowlist
          if (!ALLOWED_SETTING_KEYS.includes(row.key as any) && row.key !== "salut_info" && row.key !== "receipt_info") {
            continue;
          }

          if (row.key === "salut_info" && typeof row.value === "object" && row.value !== null) {
            const val = row.value as Record<string, any>;
            if (val.name) fetched.salut_name = val.name;
            if (val.official_name) fetched.salut_official_name = val.official_name;
            if (val.address) fetched.salut_address = val.address;
            if (val.city) fetched.salut_city = val.city;
            if (val.province) fetched.salut_province = val.province;
            if (val.postal_code) fetched.salut_postal_code = val.postal_code;
            if (val.whatsapp || val.phone) fetched.salut_whatsapp = val.whatsapp || val.phone;
            if (val.email) fetched.salut_email = val.email;
            if (val.leader_name) fetched.salut_leader_name = val.leader_name;
          } else if (row.key === "receipt_info" && typeof row.value === "object" && row.value !== null) {
            const val = row.value as Record<string, any>;
            if (val.header_name) fetched.receipt_header_name = val.header_name;
            if (val.address) fetched.receipt_address = val.address;
            if (val.whatsapp) fetched.receipt_whatsapp = val.whatsapp;
            if (val.email) fetched.receipt_email = val.email;
            if (val.leader_name) fetched.receipt_leader_name = val.leader_name;
            if (val.footer) fetched.receipt_footer = val.footer;
          } else if (row.key === "default_salut_fee") {
            if (typeof row.value === "number") {
              fetched.default_salut_fee = row.value;
            } else if (typeof row.value === "object" && row.value !== null && (row.value as any).amount !== undefined) {
              fetched.default_salut_fee = Number((row.value as any).amount) || 400000;
            }
          } else if (typeof row.value === "string" || typeof row.value === "number") {
            (fetched as any)[row.key] = row.value;
          }

          if (row.updated_at) lastUpdatedAt = row.updated_at;
          if (row.updated_by) lastUpdatedBy = row.updated_by;
        }

        return {
          ...IN_MEMORY_SETTINGS_STORE,
          ...fetched,
          updatedAt: lastUpdatedAt || IN_MEMORY_SETTINGS_STORE.updatedAt,
          updatedBy: lastUpdatedBy || IN_MEMORY_SETTINGS_STORE.updatedBy,
        };
      }
    } catch {
      // Supabase fallback
    }
  }

  return { ...IN_MEMORY_SETTINGS_STORE };
}

export function updateInMemorySettings(newSettings: SalutSettings): void {
  IN_MEMORY_SETTINGS_STORE = { ...newSettings };
}
