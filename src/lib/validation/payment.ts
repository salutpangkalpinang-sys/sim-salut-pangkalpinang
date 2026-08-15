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
