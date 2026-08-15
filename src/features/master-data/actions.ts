"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

export async function toggleAcademicPeriodActiveAction(periodId: string, setActive: boolean) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola periode akademik." };
  }

  const supabase = await createClient();

  if (setActive) {
    // Non-active all other periods first
    await supabase.from("academic_periods").update({ is_active: false }).neq("id", periodId);
  }

  const { error } = await supabase
    .from("academic_periods")
    .update({ is_active: setActive, updated_at: new Date().toISOString() })
    .eq("id", periodId);

  if (error) {
    return { error: "Gagal memperbarui periode akademik: " + error.message };
  }

  revalidatePath("/master-data");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createAcademicPeriodAction(code: string, name: string, term: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola periode akademik." };
  }

  if (!code.trim() || !name.trim()) {
    return { error: "Kode dan Nama Periode wajib diisi." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("academic_periods").insert({
    code: code.trim(),
    name: name.trim(),
    term: term.trim() || "Ganjil",
    is_active: false,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Kode periode akademik sudah digunakan." };
    }
    return { error: "Gagal menambahkan periode akademik: " + error.message };
  }

  revalidatePath("/master-data");
  return { success: true };
}

export async function createFeeRateAction(input: {
  feeTypeId: string;
  studyProgramId?: string | null;
  serviceSchemeId?: string | null;
  calculationType: "PER_SEMESTER" | "PER_SKS" | "FIXED";
  amount: number;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola tarif biaya." };
  }

  if (!input.feeTypeId || input.amount < 0) {
    return { error: "Jenis biaya dan nominal tarif wajib diisi dengan benar." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("fee_rates").insert({
    fee_type_id: input.feeTypeId,
    study_program_id: input.studyProgramId || null,
    service_scheme_id: input.serviceSchemeId || null,
    calculation_type: input.calculationType,
    amount: Math.round(input.amount),
    is_active: true,
    created_by: profile.id,
  });

  if (error) {
    return { error: "Gagal menyimpan tarif biaya: " + error.message };
  }

  revalidatePath("/master-data");
  return { success: true };
}
