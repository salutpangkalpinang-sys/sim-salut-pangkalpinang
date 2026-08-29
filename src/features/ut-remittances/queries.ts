import { createClient } from "@/lib/supabase/server";
import {
  UtRemittance,
  UtRemittanceItem,
  UtRemittanceVoidRequest,
  EligibleLipForRemittance,
} from "@/types/ut-remittance";

export async function getUtRemittancesList(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("ut_remittances")
    .select(
      `
      *,
      cash_accounts ( name ),
      ut_remittance_items (
        id,
        registration_id,
        lip_document_id,
        amount,
        lip_documents ( lip_number, official_amount ),
        registrations ( registration_number, students ( nim, full_name ) )
      ),
      ut_remittance_void_requests (
        id,
        status,
        reason,
        requested_at,
        review_notes
      )
    `,
      { count: "exact" }
    );

  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`remittance_number.ilike.${s},reference_number.ilike.${s}`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching UT remittances:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: UtRemittance[] = (data || []).map((item: any) => {
    const items: UtRemittanceItem[] = (item.ut_remittance_items || []).map((ri: any) => ({
      id: ri.id,
      remittanceId: item.id,
      registrationId: ri.registration_id,
      lipDocumentId: ri.lip_document_id,
      amount: Number(ri.amount) || 0,
      createdAt: ri.created_at,
      createdBy: ri.created_by,
      lipNumber: ri.lip_documents?.lip_number,
      officialAmount: Number(ri.lip_documents?.official_amount) || 0,
      registrationNumber: ri.registrations?.registration_number,
      studentName: ri.registrations?.students?.full_name,
      studentNim: ri.registrations?.students?.nim,
    }));

    const voidReqData = item.ut_remittance_void_requests && item.ut_remittance_void_requests.length > 0
      ? item.ut_remittance_void_requests[item.ut_remittance_void_requests.length - 1]
      : null;

    const voidRequest: UtRemittanceVoidRequest | null = voidReqData ? {
      id: voidReqData.id,
      remittanceId: item.id,
      requestedBy: voidReqData.requested_by,
      requestedAt: voidReqData.requested_at,
      reason: voidReqData.reason,
      status: voidReqData.status,
      reviewedBy: voidReqData.reviewed_by,
      reviewedAt: voidReqData.reviewed_at,
      reviewNotes: voidReqData.review_notes,
      createdAt: voidReqData.created_at,
    } : null;

    return {
      id: item.id,
      remittanceNumber: item.remittance_number,
      paidAt: item.paid_at,
      amount: Number(item.amount) || 0,
      cashAccountId: item.cash_account_id,
      referenceNumber: item.reference_number,
      proofStoragePath: item.proof_storage_path,
      originalFileName: item.original_file_name,
      mimeType: item.mime_type,
      fileSize: item.file_size ? Number(item.file_size) : null,
      status: item.status,
      notes: item.notes,
      receivedBy: item.received_by,
      idempotencyKey: item.idempotency_key,
      submittedAt: item.submitted_at,
      verifiedAt: item.verified_at,
      verifiedBy: item.verified_by,
      rejectedAt: item.rejected_at,
      rejectedBy: item.rejected_by,
      rejectionReason: item.rejection_reason,
      voidedAt: item.voided_at,
      voidedBy: item.voided_by,
      voidReason: item.void_reason,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      cashAccountName: item.cash_accounts?.name,
      items,
      voidRequest,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { data: mappedData, total, page, limit, totalPages };
}

export async function getUtRemittanceById(id: string): Promise<UtRemittance | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ut_remittances")
    .select(
      `
      *,
      cash_accounts ( name ),
      ut_remittance_items (
        id,
        registration_id,
        lip_document_id,
        amount,
        lip_documents ( lip_number, official_amount ),
        registrations ( registration_number, students ( nim, full_name ) )
      ),
      ut_remittance_void_requests (
        id,
        status,
        reason,
        requested_at,
        reviewed_at,
        review_notes
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const item: any = data;

  const items: UtRemittanceItem[] = (item.ut_remittance_items || []).map((ri: any) => ({
    id: ri.id,
    remittanceId: item.id,
    registrationId: ri.registration_id,
    lipDocumentId: ri.lip_document_id,
    amount: Number(ri.amount) || 0,
    createdAt: ri.created_at,
    createdBy: ri.created_by,
    lipNumber: ri.lip_documents?.lip_number,
    officialAmount: Number(ri.lip_documents?.official_amount) || 0,
    registrationNumber: ri.registrations?.registration_number,
    studentName: ri.registrations?.students?.full_name,
    studentNim: ri.registrations?.students?.nim,
  }));

  let signedProofUrl: string | null = null;
  if (item.proof_storage_path) {
    const { data: signedData } = await supabase.storage
      .from("ut-remittance-proofs")
      .createSignedUrl(item.proof_storage_path, 60);
    signedProofUrl = signedData?.signedUrl || null;
  }

  const voidReqData = item.ut_remittance_void_requests && item.ut_remittance_void_requests.length > 0
    ? item.ut_remittance_void_requests[item.ut_remittance_void_requests.length - 1]
    : null;

  const voidRequest: UtRemittanceVoidRequest | null = voidReqData ? {
    id: voidReqData.id,
    remittanceId: item.id,
    requestedBy: voidReqData.requested_by,
    requestedAt: voidReqData.requested_at,
    reason: voidReqData.reason,
    status: voidReqData.status,
    reviewedBy: voidReqData.reviewed_by,
    reviewedAt: voidReqData.reviewed_at,
    reviewNotes: voidReqData.review_notes,
    createdAt: voidReqData.created_at,
  } : null;

  return {
    id: item.id,
    remittanceNumber: item.remittance_number,
    paidAt: item.paid_at,
    amount: Number(item.amount) || 0,
    cashAccountId: item.cash_account_id,
    referenceNumber: item.reference_number,
    proofStoragePath: item.proof_storage_path,
    originalFileName: item.original_file_name,
    mimeType: item.mime_type,
    fileSize: item.file_size ? Number(item.file_size) : null,
    status: item.status,
    notes: item.notes,
    receivedBy: item.received_by,
    idempotencyKey: item.idempotency_key,
    submittedAt: item.submitted_at,
    verifiedAt: item.verified_at,
    verifiedBy: item.verified_by,
    rejectedAt: item.rejected_at,
    rejectedBy: item.rejected_by,
    rejectionReason: item.rejection_reason,
    voidedAt: item.voided_at,
    voidedBy: item.voided_by,
    voidReason: item.void_reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    cashAccountName: item.cash_accounts?.name,
    signedProofUrl,
    items,
    voidRequest,
  };
}

export async function getEligibleLipsForRemittance(): Promise<EligibleLipForRemittance[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lip_documents")
    .select(
      `
      id,
      registration_id,
      lip_number,
      official_amount,
      status,
      registrations (
        registration_number,
        students ( nim, full_name )
      ),
      invoices (
        id,
        status,
        invoice_items ( amount, item_type, approval_status ),
        payment_allocations ( amount, student_payments ( status ) )
      ),
      ut_remittance_items (
        amount,
        ut_remittances ( status )
      )
    `
    )
    .in("status", ["verified", "paid_to_ut"]);

  if (error || !data) return [];

  const mapped: EligibleLipForRemittance[] = (data || []).map((lip: any) => {
    const officialAmount = Number(lip.official_amount) || 0;
    let alreadyVerifiedUtPaid = 0;

    (lip.ut_remittance_items || []).forEach((ri: any) => {
      if (ri.ut_remittances?.status === "verified") {
        alreadyVerifiedUtPaid += Number(ri.amount) || 0;
      }
    });

    const outstandingUtAmount = Math.max(0, officialAmount - alreadyVerifiedUtPaid);

    let isInvoicePaid = false;
    let invoiceStatus = "unpaid";

    const invList = lip.invoices || [];
    const inv = invList.find((i: any) => i.status !== "cancelled") || invList[0];

    if (inv) {
      let invTotal = 0;
      (inv.invoice_items || []).forEach((item: any) => {
        const amt = Number(item.amount) || 0;
        if (item.item_type === "discount") {
          if (item.approval_status === "approved" || !item.approval_status) invTotal -= amt;
        } else {
          invTotal += amt;
        }
      });

      let verifiedAllocated = 0;
      (inv.payment_allocations || []).forEach((alloc: any) => {
        if (alloc.student_payments?.status === "verified") {
          verifiedAllocated += Number(alloc.amount) || 0;
        }
      });

      const remainingBalance = Math.max(0, invTotal - verifiedAllocated);
      if (inv.status === "paid" || (invTotal > 0 && remainingBalance <= 0)) {
        isInvoicePaid = true;
        invoiceStatus = "paid";
      } else {
        invoiceStatus = inv.status || "unpaid";
      }
    }

    return {
      id: lip.id,
      registrationId: lip.registration_id,
      lipNumber: lip.lip_number,
      registrationNumber: lip.registrations?.registration_number || "-",
      studentName: lip.registrations?.students?.full_name || "Mahasiswa",
      studentNim: lip.registrations?.students?.nim || null,
      officialAmount,
      alreadyVerifiedUtPaid,
      outstandingUtAmount,
      isInvoicePaid,
      invoiceStatus,
    };
  });

  // Filter only LIPs that still have outstanding liability > 0
  return mapped.filter((lip) => lip.outstandingUtAmount > 0);
}
