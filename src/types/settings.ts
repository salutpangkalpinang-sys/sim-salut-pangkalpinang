export const ALLOWED_SETTING_KEYS = [
  "salut_name",
  "salut_official_name",
  "salut_address",
  "salut_city",
  "salut_province",
  "salut_postal_code",
  "salut_whatsapp",
  "salut_email",
  "salut_leader_name",
  "receipt_header_name",
  "receipt_address",
  "receipt_whatsapp",
  "receipt_email",
  "receipt_leader_name",
  "receipt_footer",
  "default_salut_fee",
] as const;

export type AllowedSettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

export interface SalutSettings {
  salut_name: string;
  salut_official_name: string;
  salut_address: string;
  salut_city: string;
  salut_province: string;
  salut_postal_code: string;
  salut_whatsapp: string;
  salut_email: string;
  salut_leader_name: string;
  receipt_header_name: string;
  receipt_address: string;
  receipt_whatsapp: string;
  receipt_email: string;
  receipt_leader_name: string;
  receipt_footer: string;
  default_salut_fee: number;
  updatedAt: string | null;
  updatedBy: string | null;
}
