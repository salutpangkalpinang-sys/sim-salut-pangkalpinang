import { z } from "zod";

export const studentPaymentSchema = z.object({
  studentId: z.string({ required_error: "Mahasiswa wajib dipilih" }).uuid("ID Mahasiswa tidak valid"),
  paidAt: z.string({ required_error: "Tanggal bayar wajib diisi" }),
  amount: z
    .number({ required_error: "Nominal pembayaran wajib diisi" })
    .int("Nominal harus berupa Integer Rupiah")
    .gt(0, "Nominal pembayaran harus lebih dari 0"),
  paymentMethodId: z.string({ required_error: "Metode pembayaran wajib dipilih" }).uuid("Metode pembayaran tidak valid"),
  cashAccountId: z.string().uuid().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  invoiceId: z.string({ required_error: "Invoice alokasi wajib dipilih" }).uuid("ID Invoice tidak valid"),
  allocatedAmount: z
    .number({ required_error: "Nominal alokasi wajib diisi" })
    .int("Alokasi harus berupa Integer Rupiah")
    .gt(0, "Nominal alokasi harus lebih dari 0"),
});

export type PaymentCategory = "cash" | "bank";
export type CashAccountType = "cash" | "bank";

/**
 * Explicit Master Mapping Registry:
 * Memetakan kode metode pembayaran ke kategori resmi ('cash' | 'bank').
 * Fail-closed: jika kode tidak terdaftar pada registry, tolak (throw/unknown).
 */
export const OFFICIAL_PAYMENT_METHOD_CATEGORIES: Record<string, PaymentCategory> = {
  CASH: "cash",
  BANK_TRANSFER: "bank",
};

/**
 * Explicit Master Mapping Registry:
 * Memetakan kode rekening kas ke tipe akun resmi ('cash' | 'bank').
 * Fail-closed: jika kode tidak terdaftar pada registry, tolak (throw/unknown).
 */
export const OFFICIAL_CASH_ACCOUNT_TYPES: Record<string, CashAccountType> = {
  KAS_TUNAI: "cash",
  BANK_BCA: "bank",
  BANK_BRI: "bank",
  BANK_BTN: "bank",
};

/**
 * Determines the official category of a payment method based on explicit mapping.
 * Mengembalikan null jika kode tidak terdaftar di master resmi.
 */
export function getPaymentMethodCategory(code: string): PaymentCategory | null {
  const normalized = (code || "").trim().toUpperCase();
  return OFFICIAL_PAYMENT_METHOD_CATEGORIES[normalized] || null;
}

/**
 * Determines the official type of a cash account based on explicit mapping.
 * Mengembalikan null jika kode tidak terdaftar di master resmi.
 */
export function getCashAccountType(account: {
  code: string;
}): CashAccountType | null {
  const normalizedCode = (account.code || "").trim().toUpperCase();
  return OFFICIAL_CASH_ACCOUNT_TYPES[normalizedCode] || null;
}

/**
 * Validates that a selected payment method matches the destination cash account.
 * Rule:
 * - Tunai (cash) -> WAJIB rekening kas tunai (cash account).
 * - Transfer bank (bank) -> WAJIB rekening bank (bank account).
 * - Metode lain -> Tidak boleh bertentangan jika ada korelasi.
 * - Rekening kas yang nonaktif DITOLAK.
 */
export function validatePaymentAccountPairing(params: {
  methodCode: string;
  methodName?: string;
  methodIsActive?: boolean;
  account: {
    id: string;
    code: string;
    name?: string;
    bank_name?: string | null;
    bankName?: string | null;
    account_number?: string | null;
    accountNumber?: string | null;
    is_active?: boolean;
    isActive?: boolean;
  } | null;
}): { valid: boolean; message?: string } {
  const { methodCode, methodIsActive = true, account } = params;

  if (methodIsActive === false) {
    return { valid: false, message: "Metode pembayaran yang dipilih sedang nonaktif." };
  }

  if (!account) {
    return { valid: false, message: "Rekening kas / bank penerima wajib dipilih." };
  }

  const isAccountActive = account.is_active ?? account.isActive ?? true;
  if (!isAccountActive) {
    return { valid: false, message: "Rekening kas / bank yang dipilih sedang tidak aktif." };
  }

  const category = getPaymentMethodCategory(methodCode);
  if (!category) {
    return {
      valid: false,
      message: `Metode pembayaran dengan kode "${methodCode}" tidak dikenal dalam master resmi.`,
    };
  }

  const accountType = getCashAccountType(account);
  if (!accountType) {
    return {
      valid: false,
      message: `Rekening kas dengan kode "${account.code}" tidak dikenal dalam master resmi.`,
    };
  }

  if (category === "cash" && accountType !== "cash") {
    return {
      valid: false,
      message: "Metode pembayaran Tunai wajib disalurkan ke Rekening Kas Tunai, bukan rekening bank.",
    };
  }

  if (category === "bank" && accountType !== "bank") {
    return {
      valid: false,
      message: "Metode pembayaran Transfer Bank wajib disalurkan ke Rekening Bank, bukan kas tunai.",
    };
  }

  return { valid: true };
}

export type StudentPaymentFormInput = z.infer<typeof studentPaymentSchema>;

export const rejectPaymentSchema = z.object({
  paymentId: z.string().uuid("ID Pembayaran tidak valid"),
  reason: z.string().trim().min(3, "Alasan penolakan minimal 3 karakter"),
});

export type RejectPaymentFormInput = z.infer<typeof rejectPaymentSchema>;

export const voidRequestSchema = z.object({
  paymentId: z.string().uuid("ID Pembayaran tidak valid"),
  reason: z.string().trim().min(3, "Alasan pembatalan/void minimal 3 karakter"),
});

export type VoidRequestFormInput = z.infer<typeof voidRequestSchema>;

export const reviewVoidSchema = z.object({
  voidRequestId: z.string().uuid("ID Void Request tidak valid"),
  action: z.enum(["approve", "reject"], { required_error: "Aksi persetujuan wajib dipilih" }),
  reviewNotes: z.string().trim().min(3, "Catatan review minimal 3 karakter"),
});

export type ReviewVoidFormInput = z.infer<typeof reviewVoidSchema>;
