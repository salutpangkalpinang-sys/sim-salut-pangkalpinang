"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import {
  studentPaymentSchema,
  rejectPaymentSchema,
  voidRequestSchema,
  reviewVoidSchema,
  RejectPaymentFormInput,
  VoidRequestFormInput,
  ReviewVoidFormInput,
} from "@/lib/validation/payment";
import { validateFileMetadata, validateFileMagicBytes } from "@/lib/validation/lip-invoice";
import { revalidatePath } from "next/cache";

export async function createStudentPaymentAction(formData: FormData) {
  const profile = await getCurrentUserProfile();

  // Hardening Checkpoint 5 RBAC: Academic Admin is denied from financial mutations!
  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mencatat pembayaran. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const studentId = formData.get("studentId") as string;
  const paidAt = (formData.get("paidAt") as string) || new Date().toISOString();
  const amount = Number(formData.get("amount"));
  const paymentMethodId = formData.get("paymentMethodId") as string;
  const cashAccountId = (formData.get("cashAccountId") as string) || null;
  const referenceNumber = (formData.get("referenceNumber") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const invoiceId = formData.get("invoiceId") as string;
  const allocatedAmount = Number(formData.get("allocatedAmount"));
  const proofFile = formData.get("proofFile") as File | null;
  const idempotencyKey = (formData.get("idempotencyKey") as string) || crypto.randomUUID();

  // Validate Input
  const validation = studentPaymentSchema.safeParse({
    studentId,
    paidAt,
    amount,
    paymentMethodId,
    cashAccountId,
    referenceNumber,
    notes,
    invoiceId,
    allocatedAmount,
  });

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data pembayaran tidak valid." };
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
    proofStoragePath = `payments/${studentId}/${uniqueId}.${fileExt}`;
    originalFileName = proofFile.name;
    mimeType = proofFile.type;
    fileSize = proofFile.size;

    const { error: uploadErr } = await supabase.storage
      .from("payment-proofs")
      .upload(proofStoragePath, fileBuffer, {
        contentType: proofFile.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload proof error:", uploadErr);
      return { error: "Gagal mengunggah bukti pembayaran: " + uploadErr.message };
    }
  }

  // Call atomic PostgreSQL stored procedure `create_payment_with_allocation` with Idempotency Key
  const { data: paymentId, error: rpcErr } = await supabase.rpc("create_payment_with_allocation", {
    p_student_id: data.studentId,
    p_paid_at: data.paidAt,
    p_amount: data.amount,
    p_payment_method_id: data.paymentMethodId,
    p_cash_account_id: data.cashAccountId || null,
    p_reference_number: data.referenceNumber || null,
    p_proof_storage_path: proofStoragePath,
    p_original_file_name: originalFileName,
    p_mime_type: mimeType,
    p_file_size: fileSize,
    p_notes: data.notes || null,
    p_created_by: profile.id,
    p_invoice_id: data.invoiceId,
    p_allocated_amount: data.allocatedAmount,
    p_idempotency_key: idempotencyKey,
  });

  if (rpcErr) {
    console.error("Database RPC create_payment_with_allocation error:", rpcErr);
    return { error: "Gagal menyimpan pembayaran: " + rpcErr.message };
  }

  revalidatePath("/pembayaran");
  revalidatePath("/lip-tagihan");
  revalidatePath(`/mahasiswa/${data.studentId}`);

  return { success: true, paymentId };
}

export async function verifyStudentPaymentAction(paymentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk memverifikasi pembayaran. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("verify_student_payment", {
    p_payment_id: paymentId,
    p_verifier_id: profile.id,
  });

  if (error) {
    console.error("Database RPC verify_student_payment error:", error);
    return { error: "Gagal memverifikasi pembayaran: " + error.message };
  }

  revalidatePath("/pembayaran");
  revalidatePath(`/pembayaran/${paymentId}`);
  revalidatePath("/lip-tagihan");

  return { success: true };
}

export async function rejectStudentPaymentAction(input: RejectPaymentFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk menolak pembayaran. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const validation = rejectPaymentSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data penolakan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("student_payments")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: profile.id,
      rejection_reason: data.reason,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", data.paymentId);

  if (error) {
    console.error("Database reject payment error:", error);
    return { error: "Gagal menolak pembayaran: " + error.message };
  }

  revalidatePath("/pembayaran");
  revalidatePath(`/pembayaran/${data.paymentId}`);

  return { success: true };
}

export async function requestPaymentVoidAction(input: VoidRequestFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengajukan void pembatalan. Wewenang ini khusus Finance Admin dan Owner." };
  }

  const validation = voidRequestSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data pengajuan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("payment_void_requests").insert({
    payment_id: data.paymentId,
    requested_by: profile.id,
    reason: data.reason,
    status: "pending",
  });

  if (error) {
    console.error("Database insert void request error:", error);
    return { error: "Gagal mengajukan void pembatalan: " + error.message };
  }

  revalidatePath("/pembayaran");
  revalidatePath(`/pembayaran/${data.paymentId}`);

  return { success: true };
}

export async function reviewPaymentVoidAction(input: ReviewVoidFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return { error: "Hanya role Owner yang memiliki wewenang untuk memproses persetujuan void pembayaran." };
  }

  const validation = reviewVoidSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data review tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_payment_void_request", {
    p_void_request_id: data.voidRequestId,
    p_reviewer_id: profile.id,
    p_action: data.action,
    p_review_notes: data.reviewNotes,
  });

  if (error) {
    console.error("Database RPC approve_payment_void_request error:", error);
    return { error: "Gagal memproses persetujuan void: " + error.message };
  }

  revalidatePath("/pembayaran");

  return { success: true };
}

export async function getSignedProofUrlAction(storagePath: string) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { error: "Unauthenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(storagePath, 60);

  if (error || !data) {
    return { error: "Gagal membuat URL aman untuk bukti pembayaran." };
  }

  return { signedUrl: data.signedUrl };
}
