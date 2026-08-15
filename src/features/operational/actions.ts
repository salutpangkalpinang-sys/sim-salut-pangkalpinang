"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import {
  operationalTransactionSchema,
  operationalCategorySchema,
  rejectOperationalSchema,
  voidOperationalRequestSchema,
  reviewOperationalVoidSchema,
  RejectOperationalFormInput,
  VoidOperationalRequestFormInput,
  ReviewOperationalVoidFormInput,
  OperationalCategoryFormInput,
} from "@/lib/validation/operational";
import { validateFileMetadata, validateFileMagicBytes } from "@/lib/validation/lip-invoice";
import { revalidatePath } from "next/cache";

export async function createOperationalTransactionAction(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return {
      error:
        "Anda tidak memiliki izin untuk mencatat transaksi operasional. Wewenang ini khusus Finance Admin dan Owner.",
    };
  }

  const transactionType = formData.get("transactionType") as string;
  const categoryId = formData.get("categoryId") as string;
  const cashAccountId = (formData.get("cashAccountId") as string) || null;
  const transactionDate =
    (formData.get("transactionDate") as string) || new Date().toISOString();
  const amount = Number(formData.get("amount"));
  const description = (formData.get("description") as string) || "";
  const referenceNumber = (formData.get("referenceNumber") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const proofFile = formData.get("proofFile") as File | null;
  const idempotencyKey =
    (formData.get("idempotencyKey") as string) || crypto.randomUUID();

  // Validate Input
  const validation = operationalTransactionSchema.safeParse({
    transactionType,
    categoryId,
    cashAccountId,
    transactionDate,
    amount,
    description,
    referenceNumber,
    notes,
    idempotencyKey,
  });

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data transaksi tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  // Upload proof file if provided
  let proofStoragePath: string | null = null;
  let originalFileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  if (proofFile && proofFile.size > 0) {
    const fileVal = validateFileMetadata(
      proofFile.name,
      proofFile.type,
      proofFile.size
    );
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
    proofStoragePath = `operational/${uniqueId}.${fileExt}`;
    originalFileName = proofFile.name;
    mimeType = proofFile.type;
    fileSize = proofFile.size;

    const { error: uploadErr } = await supabase.storage
      .from("operational-proofs")
      .upload(proofStoragePath, fileBuffer, {
        contentType: proofFile.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload proof error:", uploadErr);
      return {
        error: "Gagal mengunggah bukti transaksi: " + uploadErr.message,
      };
    }
  }

  // Call atomic PostgreSQL stored procedure `create_operational_transaction`
  const { data: transactionId, error: rpcErr } = await supabase.rpc(
    "create_operational_transaction",
    {
      p_transaction_type: data.transactionType,
      p_category_id: data.categoryId,
      p_cash_account_id: data.cashAccountId || null,
      p_transaction_date: data.transactionDate,
      p_amount: data.amount,
      p_description: data.description,
      p_reference_number: data.referenceNumber || null,
      p_proof_storage_path: proofStoragePath,
      p_original_file_name: originalFileName,
      p_mime_type: mimeType,
      p_file_size: fileSize,
      p_notes: data.notes || null,
      p_created_by: profile.id,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (rpcErr) {
    console.error("Database RPC create_operational_transaction error:", rpcErr);
    return { error: "Gagal menyimpan transaksi operasional: " + rpcErr.message };
  }

  revalidatePath("/kas-operasional");

  return { success: true, transactionId };
}

export async function verifyOperationalTransactionAction(transactionId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return {
      error:
        "Anda tidak memiliki izin untuk memverifikasi transaksi operasional. Wewenang ini khusus Finance Admin dan Owner.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("verify_operational_transaction", {
    p_transaction_id: transactionId,
    p_verifier_id: profile.id,
  });

  if (error) {
    console.error("Database RPC verify_operational_transaction error:", error);
    return { error: "Gagal memverifikasi transaksi: " + error.message };
  }

  revalidatePath("/kas-operasional");
  revalidatePath(`/kas-operasional/${transactionId}`);

  return { success: true };
}

export async function rejectOperationalTransactionAction(
  input: RejectOperationalFormInput
) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return {
      error:
        "Anda tidak memiliki izin untuk menolak transaksi operasional. Wewenang ini khusus Finance Admin dan Owner.",
    };
  }

  const validation = rejectOperationalSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data penolakan tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("operational_transactions")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: profile.id,
      rejection_reason: data.reason,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", data.transactionId);

  if (error) {
    console.error("Database reject operational error:", error);
    return { error: "Gagal menolak transaksi: " + error.message };
  }

  revalidatePath("/kas-operasional");
  revalidatePath(`/kas-operasional/${data.transactionId}`);

  return { success: true };
}

export async function requestOperationalVoidAction(
  input: VoidOperationalRequestFormInput
) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return {
      error:
        "Anda tidak memiliki izin untuk mengajukan void pembatalan. Wewenang ini khusus Finance Admin dan Owner.",
    };
  }

  const validation = voidOperationalRequestSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data pengajuan tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("operational_transaction_void_requests")
    .insert({
      operational_transaction_id: data.transactionId,
      requested_by: profile.id,
      reason: data.reason,
      status: "pending",
    });

  if (error) {
    console.error("Database insert operational void request error:", error);
    return { error: "Gagal mengajukan void pembatalan: " + error.message };
  }

  revalidatePath("/kas-operasional");
  revalidatePath(`/kas-operasional/${data.transactionId}`);

  return { success: true };
}

export async function reviewOperationalVoidAction(
  input: ReviewOperationalVoidFormInput
) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return {
      error:
        "Hanya role Owner yang memiliki wewenang untuk memproses persetujuan void transaksi operasional.",
    };
  }

  const validation = reviewOperationalVoidSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data review tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "approve_operational_transaction_void_request",
    {
      p_void_request_id: data.voidRequestId,
      p_reviewer_id: profile.id,
      p_action: data.action,
      p_review_notes: data.reviewNotes,
    }
  );

  if (error) {
    console.error(
      "Database RPC approve_operational_transaction_void_request error:",
      error
    );
    return { error: "Gagal memproses persetujuan void: " + error.message };
  }

  revalidatePath("/kas-operasional");

  return { success: true };
}

export async function createOperationalCategoryAction(
  input: OperationalCategoryFormInput
) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "finance_admin"])) {
    return {
      error: "Anda tidak memiliki izin untuk mengelola kategori operasional.",
    };
  }

  const validation = operationalCategorySchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data kategori tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { data: catId, error } = await supabase
    .from("operational_categories")
    .insert({
      code: data.code || null,
      name: data.name,
      transaction_type: data.transactionType,
      is_active: true,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Database create category error:", error);
    return { error: "Gagal membuat kategori: " + error.message };
  }

  revalidatePath("/kas-operasional");

  return { success: true, categoryId: catId?.id };
}

export async function getSignedOperationalProofUrlAction(storagePath: string) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { error: "Unauthenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("operational-proofs")
    .createSignedUrl(storagePath, 60);

  if (error || !data) {
    return { error: "Gagal membuat URL aman untuk bukti transaksi operasional." };
  }

  return { signedUrl: data.signedUrl };
}
