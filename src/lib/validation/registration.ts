import { z } from "zod";

export const feeSnapshotInputSchema = z
  .object({
    sourceFeeRateId: z.string().uuid().nullable().optional(),
    feeTypeId: z.string({ required_error: "Jenis biaya wajib dipilih" }).uuid("Jenis biaya tidak valid"),
    feeNameSnapshot: z.string({ required_error: "Nama snapshot biaya wajib diisi" }).trim().min(2, "Nama biaya minimal 2 karakter"),
    calculationType: z.enum(["FIXED", "PER_SKS", "per_semester", "per_sks"], {
      required_error: "Metode kalkulasi tidak valid",
    }),
    quantity: z
      .number({ required_error: "Kuantitas wajib diisi" })
      .int("Kuantitas harus berupa angka bulat")
      .gt(0, "Kuantitas harus lebih dari 0"),
    unitAmount: z
      .number({ required_error: "Nominal satuan wajib diisi" })
      .int("Nominal satuan harus berupa Integer Rupiah (tanpa desimal)")
      .gte(0, "Nominal satuan tidak boleh negatif"),
    sourceSnapshot: z.string().optional().default("Master Rate Snapshot"),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => Number.isInteger(data.unitAmount), {
    message: "Nominal uang harus berupa Integer Rupiah",
    path: ["unitAmount"],
  });

export const registrationSchema = z.object({
  studentId: z.string({ required_error: "Mahasiswa wajib dipilih" }).uuid("Mahasiswa tidak valid"),
  academicPeriodId: z.string({ required_error: "Periode akademik wajib dipilih" }).uuid("Periode tidak valid"),
  registrationTypeId: z.string({ required_error: "Jenis registrasi wajib dipilih" }).uuid("Jenis registrasi tidak valid"),
  studyProgramId: z.string({ required_error: "Program studi wajib dipilih" }).uuid("Program studi tidak valid"),
  serviceSchemeId: z.string({ required_error: "Skema layanan wajib dipilih" }).uuid("Skema layanan tidak valid"),
  credits: z
    .number()
    .int("SKS harus berupa angka bulat")
    .gte(0, "Jumlah SKS tidak boleh negatif")
    .default(0),
  notes: z.string().nullable().optional(),
  feeSnapshots: z
    .array(feeSnapshotInputSchema)
    .min(1, "Registrasi harus memiliki minimal 1 rincian komponen biaya"),
});

export type RegistrationFormInput = z.infer<typeof registrationSchema>;
export type FeeSnapshotInput = z.infer<typeof feeSnapshotInputSchema>;

export const cancelRegistrationSchema = z.object({
  registrationId: z.string().uuid("ID Registrasi tidak valid"),
  cancellationReason: z.string().trim().min(3, "Alasan pembatalan minimal 3 karakter"),
});

export type CancelRegistrationFormInput = z.infer<typeof cancelRegistrationSchema>;
