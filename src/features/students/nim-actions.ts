"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const recordNimSubmissionSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid."),
  registrationId: z.string().uuid("Registration ID tidak valid."),
  invoiceId: z.string().uuid("Invoice ID tidak valid."),
  submissionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal pengajuan harus YYYY-MM-DD.")
    .optional(),
  referenceNumber: z.string().trim().max(100, "Nomor referensi maksimal 100 karakter.").optional(),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
});

const assignOfficialNimSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid."),
  nim: z
    .string()
    .trim()
    .min(1, "NIM resmi wajib diisi dan minimal 1 karakter.")
    .max(30, "NIM resmi maksimal 30 karakter.")
    .regex(/^[0-9A-Za-z]+$/, "NIM resmi hanya boleh berupa angka dan huruf tanpa spasi."),
  effectiveDate: z.string().optional(),
  reason: z.string().trim().max(500, "Catatan/alasan maksimal 500 karakter.").optional(),
});

export async function recordNimSubmissionAction(input: z.infer<typeof recordNimSubmissionSchema>) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki wewenang untuk mencatat pengajuan NIM calon mahasiswa." };
  }

  const validation = recordNimSubmissionSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data masukan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { data: rpcRes, error } = await supabase.rpc("record_nim_submission", {
    p_student_id: data.studentId,
    p_registration_id: data.registrationId,
    p_invoice_id: data.invoiceId,
    p_submission_date: data.submissionDate || new Date().toISOString().split("T")[0],
    p_reference_number: data.referenceNumber || null,
    p_notes: data.notes || null,
  });

  if (error) {
    console.error("RPC record_nim_submission error:", error);
    return {
      error:
        error.message?.replace(/^[A-Z_]+:\s*/, "") ||
        "Gagal mencatat pengajuan NIM ke UT pada sistem.",
    };
  }

  revalidatePath("/calon-mahasiswa");
  revalidatePath("/mahasiswa");
  revalidatePath(`/calon-mahasiswa/${data.studentId}`);
  revalidatePath(`/mahasiswa/${data.studentId}`);

  return { success: true, result: rpcRes };
}

export async function assignOfficialNimAction(input: z.infer<typeof assignOfficialNimSchema>) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki wewenang untuk menetapkan NIM resmi mahasiswa." };
  }

  const validation = assignOfficialNimSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data masukan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { data: rpcRes, error } = await supabase.rpc("assign_official_nim", {
    p_student_id: data.studentId,
    p_nim: data.nim,
    p_effective_date: data.effectiveDate || new Date().toISOString(),
    p_reason: data.reason || null,
  });

  if (error) {
    console.error("RPC assign_official_nim error:", error);
    return {
      error:
        error.message?.replace(/^[A-Z_]+:\s*/, "") ||
        "Gagal menetapkan NIM resmi mahasiswa pada sistem.",
    };
  }

  revalidatePath("/calon-mahasiswa");
  revalidatePath("/mahasiswa");
  revalidatePath(`/calon-mahasiswa/${data.studentId}`);
  revalidatePath(`/mahasiswa/${data.studentId}`);

  return { success: true, result: rpcRes };
}
