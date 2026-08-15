"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import {
  utRemittanceSchema,
  rejectRemittanceSchema,
  voidRemittanceRequestSchema,
  reviewRemittanceVoidSchema,
  RejectRemittanceFormInput,
  VoidRemittanceRequestFormInput,
  ReviewRemittanceVoidFormInput,
} from "@/lib/validation/ut-remittance";
import { validateFileMetadata, validateFileMagicBytes } from "@/lib/validation/lip-invoice";
import { revalidatePath } from "next/cache";

export async function createUtRemittanceAction(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mencatat setoran UT. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const paidAt = (formData.get("paidAt") as string) || new Date().toISOString();
  const amount = Number(formData.get("amount"));
  const cashAccountId = (formData.get("cashAccountId") as string) || null;
  const referenceNumber = (formData.get("referenceNumber") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const itemsJson = formData.get("items") as string;
  const proofFile = formData.get("proofFile") as File | null;
  const idempotencyKey = (formData.get("idempotencyKey") as string) || crypto.randomUUID();

  let items = [];
  try {
    items = JSON.parse(itemsJson || "[]");
  } catch {
    return { error: "Format data alokasi LIP tidak valid." };
  }

  // Validate Input
  const validation = utRemittanceSchema.safeParse({
    paidAt,
    amount,
    cashAccountId,
    referenceNumber,
    notes,
    idempotencyKey,
    items,
  });

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data setoran UT tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  // Upload proof file if provided
  let proofStoragePath: string | null = null;
  let originalFileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  if (proofFile && proofFile.size > 0) {
    const fileVal = validateFileMetadata(proofFile.name, proofFile.type, proofFile.size);
    if (!fileVal.valid) {
      return { error: fileVal.message || "Berkas tidak valid" };
    }

    const arrayBuffer = await proofFile.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const magicVal = validateFileMagicBytes(fileBuffer, proofFile.name);
    if (!magicVal.valid) {
      return { error: magicVal.message };
    }

    const fileExt = proofFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const uniqueId = crypto.randomUUID();
    proofStoragePath = `remittances/${uniqueId}.${fileExt}`;
    originalFileName = proofFile.name;
    mimeType = proofFile.type;
    fileSize = proofFile.size;

    const { error: uploadErr } = await supabase.storage
      .from("ut-remittance-proofs")
      .upload(proofStoragePath, fileBuffer, {
        contentType: proofFile.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload proof error:", uploadErr);
      return { error: "Gagal mengunggah bukti setoran UT: " + uploadErr.message };
    }
  }

  // Call atomic PostgreSQL stored procedure `create_ut_remittance_with_items`
  const { data: remittanceId, error: rpcErr } = await supabase.rpc("create_ut_remittance_with_items", {
    p_paid_at: data.paidAt,
    p_amount: data.amount,
    p_cash_account_id: data.cashAccountId || null,
    p_reference_number: data.referenceNumber || null,
    p_proof_storage_path: proofStoragePath,
    p_original_file_name: originalFileName,
    p_mime_type: mimeType,
    p_file_size: fileSize,
    p_notes: data.notes || null,
    p_created_by: profile.id,
    p_idempotency_key: idempotencyKey,
    p_items: JSON.stringify(data.items),
  });

  if (rpcErr) {
    console.error("Database RPC create_ut_remittance_with_items error:", rpcErr);
    return { error: "Gagal menyimpan setoran UT: " + rpcErr.message };
  }

  revalidatePath("/setoran-ut");
  revalidatePath("/lip-tagihan");

  return { success: true, remittanceId };
}

export async function verifyUtRemittanceAction(remittanceId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk memverifikasi setoran UT. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("verify_ut_remittance", {
    p_remittance_id: remittanceId,
    p_verifier_id: profile.id,
  });

  if (error) {
    console.error("Database RPC verify_ut_remittance error:", error);
    return { error: "Gagal memverifikasi setoran UT: " + error.message };
  }

  revalidatePath("/setoran-ut");
  revalidatePath(`/setoran-ut/${remittanceId}`);
  revalidatePath("/lip-tagihan");

  return { success: true };
}

export async function rejectUtRemittanceAction(input: RejectRemittanceFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk menolak setoran UT. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const validation = rejectRemittanceSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data penolakan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("ut_remittances")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: profile.id,
      rejection_reason: data.reason,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", data.remittanceId);

  if (error) {
    console.error("Database reject remittance error:", error);
    return { error: "Gagal menolak setoran UT: " + error.message };
  }

  revalidatePath("/setoran-ut");
  revalidatePath(`/setoran-ut/${data.remittanceId}`);

  return { success: true };
}

export async function requestUtRemittanceVoidAction(input: VoidRemittanceRequestFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengajukan void pembatalan. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const validation = voidRemittanceRequestSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data pengajuan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("ut_remittance_void_requests").insert({
    remittance_id: data.remittanceId,
    requested_by: profile.id,
    reason: data.reason,
    status: "pending",
  });

  if (error) {
    console.error("Database insert void request error:", error);
    return { error: "Gagal mengajukan void pembatalan: " + error.message };
  }

  revalidatePath("/setoran-ut");
  revalidatePath(`/setoran-ut/${data.remittanceId}`);

  return { success: true };
}

export async function reviewUtRemittanceVoidAction(input: ReviewRemittanceVoidFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return { error: "Hanya role Owner yang memiliki wewenang untuk memproses persetujuan void setoran UT." };
  }

  const validation = reviewRemittanceVoidSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data review tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_ut_remittance_void_request", {
    p_void_request_id: data.voidRequestId,
    p_reviewer_id: profile.id,
    p_action: data.action,
    p_review_notes: data.reviewNotes,
  });

  if (error) {
    console.error("Database RPC approve_ut_remittance_void_request error:", error);
    return { error: "Gagal memproses persetujuan void: " + error.message };
  }

  revalidatePath("/setoran-ut");

  return { success: true };
}

export async function getSignedRemittanceProofUrlAction(storagePath: string) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { error: "Unauthenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("ut-remittance-proofs")
    .createSignedUrl(storagePath, 60);

  if (error || !data) {
    return { error: "Gagal membuat URL aman untuk bukti setoran UT." };
  }

  return { signedUrl: data.signedUrl };
}
