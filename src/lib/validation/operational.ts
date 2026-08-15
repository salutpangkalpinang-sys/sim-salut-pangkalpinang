import { z } from "zod";

export const operationalCategorySchema = z.object({
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter"),
  transactionType: z.enum(["income", "expense"], {
    required_error: "Tipe transaksi wajib dipilih (income/expense)",
  }),
  code: z.string().trim().optional().nullable(),
});

export type OperationalCategoryFormInput = z.infer<typeof operationalCategorySchema>;

export const operationalTransactionSchema = z.object({
  transactionType: z.enum(["income", "expense"], {
    required_error: "Jenis transaksi wajib dipilih",
  }),
  categoryId: z.string({ required_error: "Kategori operasional wajib dipilih" }).uuid("ID Kategori tidak valid"),
  cashAccountId: z.string().uuid().nullable().optional(),
  transactionDate: z.string({ required_error: "Tanggal transaksi wajib diisi" }),
  amount: z
    .number({ required_error: "Nominal transaksi wajib diisi" })
    .int("Nominal transaksi harus berupa Integer Rupiah")
    .gt(0, "Nominal transaksi harus lebih dari 0"),
  description: z.string().trim().min(3, "Deskripsi transaksi minimal 3 karakter"),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  idempotencyKey: z.string({ required_error: "Idempotency key wajib diisi" }).uuid("Idempotency key tidak valid"),
});

export type OperationalTransactionFormInput = z.infer<typeof operationalTransactionSchema>;

export const rejectOperationalSchema = z.object({
  transactionId: z.string().uuid("ID Transaksi tidak valid"),
  reason: z.string().trim().min(3, "Alasan penolakan minimal 3 karakter"),
});

export type RejectOperationalFormInput = z.infer<typeof rejectOperationalSchema>;

export const voidOperationalRequestSchema = z.object({
  transactionId: z.string().uuid("ID Transaksi tidak valid"),
  reason: z.string().trim().min(3, "Alasan pengajuan void minimal 3 karakter"),
});

export type VoidOperationalRequestFormInput = z.infer<typeof voidOperationalRequestSchema>;

export const reviewOperationalVoidSchema = z.object({
  voidRequestId: z.string().uuid("ID Void Request tidak valid"),
  action: z.enum(["approve", "reject"], { required_error: "Aksi persetujuan wajib dipilih" }),
  reviewNotes: z.string().trim().min(3, "Catatan review minimal 3 karakter"),
});

export type ReviewOperationalVoidFormInput = z.infer<typeof reviewOperationalVoidSchema>;
