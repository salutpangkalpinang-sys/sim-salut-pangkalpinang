import { createClient } from "@/lib/supabase/server";
import {
  UtRemittance,
  UtRemittanceItem,
  UtRemittanceVoidRequest,
  EligibleLipForRemittance,
  IneligibleLipItem,
  PaginatedIneligibleLipsResult,
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
        payment_allocations ( amount, student_payments ( status ) ),
        payment_component_allocations ( amount, component_type, entry_type, status )
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
    let alreadyRemittedAmount = 0;

    (lip.ut_remittance_items || []).forEach((ri: any) => {
      const remStatus = ri.ut_remittances?.status;
      const itemAmt = Number(ri.amount) || 0;
      if (remStatus === "verified") {
        alreadyVerifiedUtPaid += itemAmt;
      }
      // RPC Criterion 4: Sisa Tagihan Remittance memperhitungkan pending_verification DAN verified
      if (remStatus === "pending_verification" || remStatus === "verified") {
        alreadyRemittedAmount += itemAmt;
      }
    });

    // RPC: v_outstanding_remittance := v_lip_doc.official_amount - v_already_remitted
    const outstandingUtAmount = Math.max(0, officialAmount - alreadyRemittedAmount);

    let isInvoicePaid = false;
    let invoiceStatus = "unpaid";
    let salutFeeRequired = 0;
    let salutFeePaid = 0;
    let verifiedUtFundAvailable = 0;

    const invList = lip.invoices || [];
    const inv = invList.find((i: any) => i.status !== "cancelled") || invList[0];

    if (inv) {
      invoiceStatus = inv.status || "unpaid";
      // RPC Criterion 3: Wajib inv.status === 'paid' (tidak memakai fallback remainingBalance <= 0)
      isInvoicePaid = inv.status === "paid";

      // RPC Criterion 1: Kewajiban Komisi SALUT dari item_type = 'service_fee'
      (inv.invoice_items || []).forEach((it: any) => {
        if (it.item_type === "service_fee") {
          salutFeeRequired += Number(it.amount) || 0;
        }
      });

      // RPC Criteria 1 & 2: Dihitung dari persisted payment_component_allocations (status = 'posted')
      // Formula: SUM(CASE WHEN entry_type = 'allocation' THEN amount ELSE -amount END)
      (inv.payment_component_allocations || []).forEach((pca: any) => {
        if (pca.status === "posted") {
          const delta = pca.entry_type === "allocation" ? Number(pca.amount) || 0 : -(Number(pca.amount) || 0);
          if (pca.component_type === "service_fee") {
            salutFeePaid += delta;
          } else if (pca.component_type === "ut_liability") {
            verifiedUtFundAvailable += delta;
          }
        }
      });
    }

    const isSalutFeeSatisfied = salutFeeRequired <= 0 || salutFeePaid >= salutFeeRequired;
    const isUtFundSufficient = verifiedUtFundAvailable >= officialAmount;
    const utFundShortage = Math.max(0, officialAmount - verifiedUtFundAvailable);

    // Strict RPC Criteria:
    // 1. Dokumen LIP berstatus 'verified'
    // 2. Komisi SALUT lunas 100% (v_salut_paid >= v_salut_total)
    // 3. Dana UT verified >= official LIP (v_available_ut_fund >= v_lip_doc.official_amount)
    // 4. Invoice mahasiswa berstatus 'paid' (inv.status === 'paid')
    const isRemittanceEligible =
      lip.status === "verified" &&
      isSalutFeeSatisfied &&
      isUtFundSufficient &&
      isInvoicePaid;

    let ineligibilityReason: string | null = null;
    if (!isRemittanceEligible) {
      if (lip.status !== "verified") {
        ineligibilityReason = `Dokumen LIP berstatus ${lip.status} (wajib verified).`;
      } else if (!isSalutFeeSatisfied) {
        ineligibilityReason = `Komisi SALUT belum lunas (terbayar Rp ${salutFeePaid.toLocaleString("id-ID")} dari Rp ${salutFeeRequired.toLocaleString("id-ID")}).`;
      } else if (!isUtFundSufficient) {
        ineligibilityReason = `Dana UT terverifikasi (Rp ${verifiedUtFundAvailable.toLocaleString("id-ID")}) kurang Rp ${utFundShortage.toLocaleString("id-ID")} dari kewajiban LIP (Rp ${officialAmount.toLocaleString("id-ID")}).`;
      } else if (!isInvoicePaid) {
        ineligibilityReason = `Invoice mahasiswa belum lunas (status ${invoiceStatus}).`;
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
      alreadyRemittedAmount,
      outstandingUtAmount,
      isInvoicePaid,
      invoiceStatus,
      salutFeeRequired,
      salutFeePaid,
      isSalutFeeSatisfied,
      verifiedUtFundAvailable,
      isUtFundSufficient,
      utFundShortage,
      isRemittanceEligible,
      ineligibilityReason,
    };
  });

  // Filter only LIPs that still have outstanding liability > 0 (setelah dikurangi pending + verified)
  return mapped.filter((lip) => lip.outstandingUtAmount > 0);
}

/**
 * Server-side search & pagination for Ineligible LIPs (Belum Memenuhi Syarat Setoran UT).
 * Provides exact total count, summary count, and 20-row paginated data with multi-field search.
 */
export async function getIneligibleLipsPaginated(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedIneligibleLipsResult> {
  const allLips = await getEligibleLipsForRemittance();

  // Filter only ineligible lips
  let ineligibleList: IneligibleLipItem[] = allLips
    .filter((lip) => !lip.isRemittanceEligible)
    .map((lip) => ({
      id: lip.id,
      registrationId: lip.registrationId,
      lipNumber: lip.lipNumber,
      registrationNumber: lip.registrationNumber,
      studentName: lip.studentName,
      studentNim: lip.studentNim,
      officialAmount: lip.officialAmount,
      verifiedUtFundAvailable: lip.verifiedUtFundAvailable ?? 0,
      utFundShortage: lip.utFundShortage ?? Math.max(0, lip.officialAmount - (lip.verifiedUtFundAvailable ?? 0)),
      salutFeeRequired: lip.salutFeeRequired ?? 0,
      salutFeePaid: lip.salutFeePaid ?? 0,
      invoiceStatus: lip.invoiceStatus ?? "unpaid",
      ineligibilityReason: lip.ineligibilityReason || "Belum memenuhi kriteria setoran UT.",
    }));

  // Server-side multi-field search filter
  if (params.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    ineligibleList = ineligibleList.filter((item) => {
      const nameMatch = item.studentName.toLowerCase().includes(q);
      const nimMatch = (item.studentNim || "").toLowerCase().includes(q);
      const regMatch = item.registrationNumber.toLowerCase().includes(q);
      const lipMatch = item.lipNumber.toLowerCase().includes(q);
      return nameMatch || nimMatch || regMatch || lipMatch;
    });
  }

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 20;
  const total = ineligibleList.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = ineligibleList.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Server-side summary count for ineligible LIPs.
 * Returns exact count of documents not eligible for remittance.
 */
export async function getIneligibleLipsSummaryCount(): Promise<number> {
  const allLips = await getEligibleLipsForRemittance();
  return allLips.filter((lip) => !lip.isRemittanceEligible).length;
}

/**
 * Server-side search for eligible LIPs in the combobox dropdown.
 * Strictly returns only eligible LIPs (`isRemittanceEligible === true`),
 * limited to top results (default max 50) for fast UX with thousands of records.
 */
export async function searchEligibleLipsForCombobox(params: {
  query?: string;
  limit?: number;
}): Promise<EligibleLipForRemittance[]> {
  const allLips = await getEligibleLipsForRemittance();
  let eligibleOnly = allLips.filter((lip) => lip.isRemittanceEligible);

  if (params.query && params.query.trim()) {
    const q = params.query.trim().toLowerCase();
    eligibleOnly = eligibleOnly.filter((lip) => {
      const nameMatch = lip.studentName.toLowerCase().includes(q);
      const nimMatch = (lip.studentNim || "").toLowerCase().includes(q);
      const regMatch = lip.registrationNumber.toLowerCase().includes(q);
      const lipMatch = lip.lipNumber.toLowerCase().includes(q);
      return nameMatch || nimMatch || regMatch || lipMatch;
    });
  }

  const maxLimit = params.limit && params.limit > 0 ? params.limit : 50;
  return eligibleOnly.slice(0, maxLimit);
}
