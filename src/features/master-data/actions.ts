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

export async function createCashAccountAction(input: {
  code: string;
  name: string;
  accountNumber?: string;
  bankName?: string;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola akun kas/rekening." };
  }

  if (!input.code.trim() || !input.name.trim()) {
    return { error: "Kode dan Nama Akun Kas / Rekening wajib diisi." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("cash_accounts").insert({
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    account_number: input.accountNumber?.trim() || null,
    bank_name: input.bankName?.trim() || null,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Kode akun kas/rekening sudah digunakan." };
    }
    return { error: "Gagal menambahkan rekening baru: " + error.message };
  }

  revalidatePath("/master-data");
  revalidatePath("/pembayaran");
  revalidatePath("/kas-operasional");
  revalidatePath("/setoran-ut");
  return { success: true };
}

export async function updateCashAccountAction(input: {
  id: string;
  name: string;
  accountNumber?: string;
  bankName?: string;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola akun kas/rekening." };
  }

  if (!input.id || !input.name.trim()) {
    return { error: "Nama Akun Kas / Rekening wajib diisi." };
  }

  const supabase = await createClient();

  // 1. Try SECURITY DEFINER RPC first (bypasses RLS atomically in PostgreSQL)
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("update_cash_account", {
      p_id: input.id,
      p_name: input.name.trim(),
      p_account_number: input.accountNumber?.trim() || null,
      p_bank_name: input.bankName?.trim() || null,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      revalidatePath("/master-data");
      revalidatePath("/pembayaran");
      revalidatePath("/kas-operasional");
      revalidatePath("/setoran-ut");
      return { success: true };
    }
  } catch (err) {
    console.warn("update_cash_account RPC fallback:", err);
  }

  // 2. Fallback: Direct table update
  const { data, error } = await supabase
    .from("cash_accounts")
    .update({
      name: input.name.trim(),
      account_number: input.accountNumber?.trim() || null,
      bank_name: input.bankName?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select();

  if (error) {
    return { error: "Gagal mengedit rekening: " + error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Gagal memperbarui rekening: RLS database memblokir perubahan. Mohon jalankan skrip migrasi SQL RLS." };
  }

  revalidatePath("/master-data");
  revalidatePath("/pembayaran");
  revalidatePath("/kas-operasional");
  revalidatePath("/setoran-ut");
  return { success: true, updated: data[0] };
}

export async function toggleCashAccountActiveAction(id: string, setActive: boolean) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengelola akun kas/rekening." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cash_accounts")
    .update({ is_active: setActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Gagal memperbarui status rekening: " + error.message };
  }

  revalidatePath("/master-data");
  revalidatePath("/pembayaran");
  revalidatePath("/kas-operasional");
  revalidatePath("/setoran-ut");
  return { success: true };
}
