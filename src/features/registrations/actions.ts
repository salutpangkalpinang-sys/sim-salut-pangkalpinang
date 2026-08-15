"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import {
  registrationSchema,
  cancelRegistrationSchema,
  RegistrationFormInput,
  CancelRegistrationFormInput,
} from "@/lib/validation/registration";
import { CandidateFeeRate } from "@/types/registration";
import { revalidatePath } from "next/cache";

export async function getAvailableCandidateFeeRatesAction(
  studyProgramId?: string,
  serviceSchemeId?: string,
  academicPeriodId?: string
): Promise<CandidateFeeRate[]> {
  const supabase = await createClient();

  let query = supabase
    .from("fee_rates")
    .select(
      `
      id,
      fee_type_id,
      name,
      calculation_type,
      unit_amount,
      source,
      verification_status,
      is_active,
      fee_types ( code, name, category, is_per_sks )
    `
    )
    .eq("is_active", true)
    .eq("verification_status", "VERIFIED");

  if (studyProgramId) {
    query = query.or(`study_program_id.eq.${studyProgramId},study_program_id.is.null`);
  }
  if (serviceSchemeId) {
    query = query.or(`service_scheme_id.eq.${serviceSchemeId},service_scheme_id.is.null`);
  }
  if (academicPeriodId) {
    query = query.or(`academic_period_id.eq.${academicPeriodId},academic_period_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching candidate fee rates:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    feeTypeId: item.fee_type_id,
    feeTypeName: item.fee_types?.name || item.name,
    feeTypeCode: item.fee_types?.code || "",
    feeTypeCategory: item.fee_types?.category || "UT_OFFICIAL",
    name: item.name,
    calculationType: item.calculation_type === "PER_SKS" ? "PER_SKS" : "FIXED",
    unitAmount: Number(item.unit_amount),
    source: item.source || "SK Resmi",
    isPerSks: item.fee_types?.is_per_sks || item.calculation_type === "PER_SKS",
  }));
}

export async function createRegistrationAction(input: RegistrationFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk membuat registrasi semester." };
  }

  const validation = registrationSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data registrasi tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const feeItemsPayload = data.feeSnapshots.map((item) => ({
    source_fee_rate_id: item.sourceFeeRateId || null,
    fee_type_id: item.feeTypeId,
    fee_name_snapshot: item.feeNameSnapshot,
    calculation_type: item.calculationType,
    quantity: item.quantity,
    unit_amount: item.unitAmount,
    source_snapshot: item.sourceSnapshot || "Master Rate Snapshot",
    notes: item.notes || null,
  }));

  const { data: registrationId, error } = await supabase.rpc(
    "create_registration_with_snapshots",
    {
      p_student_id: data.studentId,
      p_academic_period_id: data.academicPeriodId,
      p_registration_type_id: data.registrationTypeId,
      p_study_program_id: data.studyProgramId,
      p_service_scheme_id: data.serviceSchemeId,
      p_credits: data.credits,
      p_notes: data.notes || null,
      p_created_by: profile.id,
      p_fee_items: feeItemsPayload,
    }
  );

  if (error) {
    console.error("Database error creating registration:", error);
    return { error: "Gagal membuat registrasi: " + error.message };
  }

  revalidatePath("/registrasi");
  revalidatePath("/mahasiswa");
  revalidatePath(`/mahasiswa/${data.studentId}`);

  return { success: true, registrationId };
}

export async function cancelRegistrationAction(input: CancelRegistrationFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk membatalkan registrasi." };
  }

  const validation = cancelRegistrationSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data pembatalan tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
      cancellation_reason: data.cancellationReason,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", data.registrationId);

  if (error) {
    console.error("Database error cancelling registration:", error);
    return { error: "Gagal membatalkan registrasi: " + error.message };
  }

  revalidatePath("/registrasi");
  revalidatePath(`/registrasi/${data.registrationId}`);

  return { success: true };
}
