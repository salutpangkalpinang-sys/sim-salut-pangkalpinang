import { z } from "zod";

export const utRemittanceItemSchema = z.object({
  lipDocumentId: z.string({ required_error: "LIP Document ID wajib diisi" }).uuid("LIP Document ID tidak valid"),
  registrationId: z.string({ required_error: "Registration ID wajib diisi" }).uuid("Registration ID tidak valid"),
  amount: z
    .number({ required_error: "Nominal alokasi LIP wajib diisi" })
    .int("Nominal alokasi harus berupa Integer Rupiah")
    .gt(0, "Nominal alokasi LIP harus lebih dari 0"),
});

export const utRemittanceSchema = z
  .object({
    paidAt: z.string({ required_error: "Tanggal setoran wajib diisi" }),
    amount: z
      .number({ required_error: "Nominal total setoran wajib diisi" })
      .int("Nominal total setoran harus berupa Integer Rupiah")
      .gt(0, "Nominal setoran UT harus lebih dari 0"),
    cashAccountId: z.string().uuid().nullable().optional(),
    referenceNumber: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    idempotencyKey: z.string().uuid().optional(),
    items: z.array(utRemittanceItemSchema).min(1, "Minimal pilih 1 LIP kewajiban UT untuk dialokasikan"),
  })
  .refine(
    (data) => {
      const sumItems = data.items.reduce((acc, item) => acc + item.amount, 0);
      return sumItems === data.amount;
    },
    {
      message: "Total nominal setoran UT harus persis sama dengan jumlah alokasi item LIP",
      path: ["amount"],
    }
  );

export type UtRemittanceFormInput = z.infer<typeof utRemittanceSchema>;

export const rejectRemittanceSchema = z.object({
  remittanceId: z.string().uuid("ID Setoran UT tidak valid"),
  reason: z.string().trim().min(3, "Alasan penolakan minimal 3 karakter"),
});

export type RejectRemittanceFormInput = z.infer<typeof rejectRemittanceSchema>;

export const voidRemittanceRequestSchema = z.object({
  remittanceId: z.string().uuid("ID Setoran UT tidak valid"),
  reason: z.string().trim().min(3, "Alasan pengajuan void minimal 3 karakter"),
});

export type VoidRemittanceRequestFormInput = z.infer<typeof voidRemittanceRequestSchema>;

export const reviewRemittanceVoidSchema = z.object({
  voidRequestId: z.string().uuid("ID Void Request tidak valid"),
  action: z.enum(["approve", "reject"], { required_error: "Aksi persetujuan wajib dipilih" }),
  reviewNotes: z.string().trim().min(3, "Catatan review minimal 3 karakter"),
});

export type ReviewRemittanceVoidFormInput = z.infer<typeof reviewRemittanceVoidSchema>;
