"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import {
  lipDocumentSchema,
  validateFileMetadata,
  validateFileMagicBytes,
  createInvoiceSchema,
  discountApprovalSchema,
  CreateInvoiceFormInput,
  DiscountApprovalFormInput,
} from "@/lib/validation/lip-invoice";
import { revalidatePath } from "next/cache";

export async function uploadLipFileAndCreateAction(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengunggah LIP." };
  }

  const registrationId = formData.get("registrationId") as string;
  const lipNumber = formData.get("lipNumber") as string;
  const officialAmount = Number(formData.get("officialAmount"));
  const tuitionAmount = Number(formData.get("tuitionAmount")) || 0;
  const bookAmount = Number(formData.get("bookAmount")) || 0;
  const shippingAmount = Number(formData.get("shippingAmount")) || 0;
  const otherUtAmount = Number(formData.get("otherUtAmount")) || 0;
  const issuedAt = formData.get("issuedAt") as string || null;
  const dueAt = formData.get("dueAt") as string || null;
  const notes = formData.get("notes") as string || null;
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Berkas fisik LIP wajib diunggah." };
  }

  // Validate File metadata
  const fileVal = validateFileMetadata(file.name, file.type, file.size);
  if (!fileVal.valid) {
    return { error: fileVal.message };
  }

  // Server-Side Magic-Byte Signature Validation
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const magicVal = validateFileMagicBytes(buffer, file.name);
  if (!magicVal.valid) {
    return { error: magicVal.message };
  }

  // Validate Form input
  const validation = lipDocumentSchema.safeParse({
    registrationId,
    lipNumber,
    officialAmount,
    tuitionAmount,
    bookAmount,
    shippingAmount,
    otherUtAmount,
    issuedAt,
    dueAt,
    notes,
  });

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data LIP tidak valid." };
  }

  const supabase = await createClient();

  // Determine current LIP version for this registration
  const { data: existingLips } = await supabase
    .from("lip_documents")
    .select("version")
    .eq("registration_id", registrationId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existingLips && existingLips.length > 0 ? existingLips[0].version + 1 : 1;

  // Generate storage path: registrations/{registration_id}/lip/{uuid}.{ext}
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const uniqueId = crypto.randomUUID();
  const storagePath = `registrations/${registrationId}/lip/${uniqueId}.${fileExt}`;

  // Upload file to Supabase Private Storage Bucket `lip-documents`
  const { error: uploadErr } = await supabase.storage
    .from("lip-documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
    return { error: "Gagal mengunggah file LIP ke penyimpanan: " + uploadErr.message };
  }

  // Insert LIP record into database
  const { data: lipRec, error: dbErr } = await supabase
    .from("lip_documents")
    .insert({
      registration_id: registrationId,
      lip_number: lipNumber.trim(),
      version: nextVersion,
      official_amount: officialAmount,
      tuition_amount: tuitionAmount,
      book_amount: bookAmount,
      shipping_amount: shippingAmount,
      other_ut_amount: otherUtAmount,
      issued_at: issuedAt,
      due_at: dueAt,
      storage_path: storagePath,
      original_file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      status: "pending_verification",
      notes: notes?.trim() || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (dbErr) {
    console.error("Database insert LIP error:", dbErr);
    return { error: "Gagal menyimpan data LIP: " + dbErr.message };
  }

  revalidatePath("/lip-tagihan");
  revalidatePath(`/registrasi/${registrationId}`);

  return { success: true, lipDocumentId: lipRec.id };
}

export async function verifyLipDocumentAction(id: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk memverifikasi LIP." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("lip_documents")
    .update({
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: profile.id,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", id);

  if (error) {
    console.error("Database verify LIP error:", error);
    return { error: "Gagal memverifikasi LIP: " + error.message };
  }

  revalidatePath("/lip-tagihan");

  return { success: true };
}

export async function cancelLipDocumentAction(id: string, reason: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk membatalkan LIP." };
  }

  if (!reason || reason.trim().length < 3) {
    return { error: "Alasan pembatalan LIP wajib diisi." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("lip_documents")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
      cancellation_reason: reason.trim(),
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", id);

  if (error) {
    console.error("Database cancel LIP error:", error);
    return { error: "Gagal membatalkan LIP: " + error.message };
  }

  revalidatePath("/lip-tagihan");

  return { success: true };
}

export async function createInvoiceAction(input: CreateInvoiceFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk menerbitkan tagihan invoice." };
  }

  const validation = createInvoiceSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data tagihan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  // Ensure LIP status is verified before issuing final invoice
  const { data: lipDoc } = await supabase
    .from("lip_documents")
    .select("status")
    .eq("id", data.lipDocumentId)
    .single();

  if (!lipDoc || lipDoc.status !== "verified") {
    return { error: "Tagihan invoice HANYA dapat diterbitkan dari LIP yang berstatus Terverifikasi (verified)." };
  }

  const itemsPayload = data.items.map((it: any) => ({
    item_type: it.itemType,
    fee_type_id: it.feeTypeId || null,
    description: it.description,
    quantity: it.quantity,
    unit_amount: it.unitAmount,
    source_type: it.sourceType || "manual",
    source_id: it.sourceId || null,
    approval_status: it.approvalStatus || null,
    approval_reason: it.approvalReason || null,
  }));

  // Call atomic PostgreSQL stored procedure `create_invoice_with_items`
  const { data: invoiceId, error } = await supabase.rpc("create_invoice_with_items", {
    p_registration_id: data.registrationId,
    p_lip_document_id: data.lipDocumentId,
    p_due_at: data.dueAt || null,
    p_notes: data.notes || null,
    p_created_by: profile.id,
    p_items: itemsPayload,
  });

  if (error) {
    console.error("Database RPC create_invoice_with_items error:", error);
    return { error: "Gagal menerbitkan invoice: " + error.message };
  }

  revalidatePath("/lip-tagihan");
  revalidatePath(`/registrasi/${data.registrationId}`);

  return { success: true, invoiceId };
}

export async function approveDiscountAction(input: DiscountApprovalFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return { error: "Hanya role Owner yang memiliki wewenang untuk menyetujui potongan diskon." };
  }

  const validation = discountApprovalSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Data persetujuan tidak valid." };
  }

  const data = validation.data;
  const supabase = await createClient();

  const newStatus = data.action === "approve" ? "approved" : "rejected";

  const { error } = await supabase
    .from("invoice_items")
    .update({
      approval_status: newStatus,
      approval_reason: (data.reason || data.notes || "").trim() || null,
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", data.invoiceItemId);

  if (error) {
    console.error("Database update discount approval error:", error);
    return { error: "Gagal memperbarui status potongan: " + error.message };
  }

  revalidatePath("/lip-tagihan");

  return { success: true };
}

export async function getSignedLipUrlAction(storagePath: string) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { error: "Unauthenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("lip-documents")
    .createSignedUrl(storagePath, 60); // Short lived 60s signed URL

  if (error || !data) {
    return { error: "Gagal membuat URL aman untuk berkas LIP." };
  }

  return { signedUrl: data.signedUrl };
}
