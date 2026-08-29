import { createClient } from "@/lib/supabase/server";
import { calculateInvoicePaymentAllocation } from "@/lib/utils/payment-allocation";
import {
  StudentPayment,
  PaymentAllocation,
  PaymentVoidRequest,
  PaymentFilterParams,
  PaymentReceiptData,
} from "@/types/payment";

export async function getPaymentsList(params: PaymentFilterParams = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("student_payments")
    .select(
      `
      *,
      students ( nim, full_name ),
      payment_methods ( name, code ),
      cash_accounts ( name ),
      payment_allocations (
        id,
        invoice_id,
        amount,
        invoices ( invoice_number )
      ),
      payment_void_requests (
        id,
        status,
        reason,
        requested_at,
        review_notes
      )
    `,
      { count: "exact" }
    );

  if (params.studentId) {
    query = query.eq("student_id", params.studentId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.paymentMethodId) {
    query = query.eq("payment_method_id", params.paymentMethodId);
  }
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`transaction_number.ilike.${s},reference_number.ilike.${s}`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching student payments:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: StudentPayment[] = (data || []).map((item: any) => {
    const amount = Number(item.amount) || 0;
    const allocations: PaymentAllocation[] = (item.payment_allocations || []).map((pa: any) => ({
      id: pa.id,
      paymentId: item.id,
      invoiceId: pa.invoice_id,
      amount: Number(pa.amount) || 0,
      createdAt: pa.created_at,
      createdBy: pa.created_by,
      invoiceNumber: pa.invoices?.invoice_number,
    }));

    const allocatedAmountTotal = allocations.reduce((acc, a) => acc + a.amount, 0);
    const unallocatedAmount = Math.max(0, amount - allocatedAmountTotal);

    const voidReqData = item.payment_void_requests && item.payment_void_requests.length > 0
      ? item.payment_void_requests[item.payment_void_requests.length - 1]
      : null;

    const voidRequest: PaymentVoidRequest | null = voidReqData ? {
      id: voidReqData.id,
      paymentId: item.id,
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
      transactionNumber: item.transaction_number,
      studentId: item.student_id,
      paidAt: item.paid_at,
      amount,
      paymentMethodId: item.payment_method_id,
      cashAccountId: item.cash_account_id,
      referenceNumber: item.reference_number,
      proofStoragePath: item.proof_storage_path,
      originalFileName: item.original_file_name,
      mimeType: item.mime_type,
      fileSize: item.file_size ? Number(item.file_size) : null,
      status: item.status,
      notes: item.notes,
      receivedBy: item.received_by,
      submittedAt: item.submitted_at,
      verifiedAt: item.verified_at,
      verifiedBy: item.verified_by,
      rejectedAt: item.rejected_at,
      rejectedBy: item.rejected_by,
      rejectionReason: item.rejection_reason,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      studentName: item.students?.full_name,
      studentNim: item.students?.nim,
      paymentMethodName: item.payment_methods?.name,
      cashAccountName: item.cash_accounts?.name,
      allocatedAmountTotal,
      unallocatedAmount,
      allocations,
      voidRequest,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { data: mappedData, total, page, limit, totalPages };
}

export async function getPaymentById(id: string): Promise<StudentPayment | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_payments")
    .select(
      `
      *,
      students ( nim, full_name ),
      payment_methods ( name, code ),
      cash_accounts ( name ),
      payment_allocations (
        id,
        invoice_id,
        amount,
        invoices (
          invoice_number,
          lip_documents ( official_amount ),
          registrations ( registration_number )
        )
      ),
      payment_void_requests (
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

  const amount = Number(item.amount) || 0;
  const allocations: PaymentAllocation[] = (item.payment_allocations || []).map((pa: any) => ({
    id: pa.id,
    paymentId: item.id,
    invoiceId: pa.invoice_id,
    amount: Number(pa.amount) || 0,
    createdAt: pa.created_at,
    createdBy: pa.created_by,
    invoiceNumber: pa.invoices?.invoice_number,
    registrationNumber: pa.invoices?.registrations?.registration_number,
  }));

  const allocatedAmountTotal = allocations.reduce((acc, a) => acc + a.amount, 0);
  const unallocatedAmount = Math.max(0, amount - allocatedAmountTotal);

  let signedProofUrl: string | null = null;
  if (item.proof_storage_path) {
    const { data: signedData } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(item.proof_storage_path, 60);
    signedProofUrl = signedData?.signedUrl || null;
  }

  const voidReqData = item.payment_void_requests && item.payment_void_requests.length > 0
    ? item.payment_void_requests[item.payment_void_requests.length - 1]
    : null;

  const voidRequest: PaymentVoidRequest | null = voidReqData ? {
    id: voidReqData.id,
    paymentId: item.id,
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
    transactionNumber: item.transaction_number,
    studentId: item.student_id,
    paidAt: item.paid_at,
    amount,
    paymentMethodId: item.payment_method_id,
    cashAccountId: item.cash_account_id,
    referenceNumber: item.reference_number,
    proofStoragePath: item.proof_storage_path,
    originalFileName: item.original_file_name,
    mimeType: item.mime_type,
    fileSize: item.file_size ? Number(item.file_size) : null,
    status: item.status,
    notes: item.notes,
    receivedBy: item.received_by,
    submittedAt: item.submitted_at,
    verifiedAt: item.verified_at,
    verifiedBy: item.verified_by,
    rejectedAt: item.rejected_at,
    rejectedBy: item.rejected_by,
    rejectionReason: item.rejection_reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    studentName: item.students?.full_name,
    studentNim: item.students?.nim,
    paymentMethodName: item.payment_methods?.name,
    cashAccountName: item.cash_accounts?.name,
    allocatedAmountTotal,
    unallocatedAmount,
    signedProofUrl,
    allocations,
    voidRequest,
  };
}

export async function getStudentPaymentsHistory(studentId: string): Promise<StudentPayment[]> {
  const res = await getPaymentsList({ studentId, limit: 50 });
  return res.data;
}

export async function getPaymentReceiptData(paymentId: string): Promise<PaymentReceiptData | null> {
  const payment = await getPaymentById(paymentId);
  if (!payment) return null;

  const firstAllocation = payment.allocations && payment.allocations.length > 0 ? payment.allocations[0] : null;
  if (!firstAllocation) return null;

  const supabase = await createClient();

  // Fetch target invoice details & verifier name
  const { data: invData } = await supabase
    .from("invoices")
    .select(
      `
      invoice_number,
      registrations (
        registration_number,
        academic_periods ( name )
      ),
      invoice_items ( amount, item_type, approval_status ),
      payment_allocations (
        amount,
        student_payments ( status )
      )
    `
    )
    .eq("id", firstAllocation.invoiceId)
    .single();

  if (!invData) return null;
  const item: any = invData;

  // Calculate invoice total amount
  let invoiceTotalAmount = 0;
  (item.invoice_items || []).forEach((it: any) => {
    const amt = Number(it.amount) || 0;
    if (it.item_type === "discount") {
      if (it.approval_status === "approved") invoiceTotalAmount -= amt;
    } else {
      invoiceTotalAmount += amt;
    }
  });

  // Calculate cumulative verified paid amount for this invoice
  let cumulativeVerifiedPaid = 0;
  (item.payment_allocations || []).forEach((pa: any) => {
    if (pa.student_payments?.status === "verified") {
      cumulativeVerifiedPaid += Number(pa.amount) || 0;
    }
  });

  const allocBreakdown = calculateInvoicePaymentAllocation(item.invoice_items || [], cumulativeVerifiedPaid);

  const remainingBalance = Math.max(0, allocBreakdown.invoiceTotalAmount - cumulativeVerifiedPaid);

  let verifierName: string | null = null;
  if (payment.verifiedBy) {
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", payment.verifiedBy).single();
    verifierName = prof?.full_name || null;
  }

  let settings = null;
  try {
    const { getAppSettings } = await import("@/features/settings/queries");
    settings = await getAppSettings();
  } catch {
    // Fallback if settings query fails
  }

  return {
    transactionNumber: payment.transactionNumber,
    paidAt: payment.paidAt,
    studentName: payment.studentName || "Mahasiswa",
    studentNim: payment.studentNim || null,
    paymentMethodName: payment.paymentMethodName || "Metode Bayar",
    referenceNumber: payment.referenceNumber,
    amount: payment.amount,
    status: payment.status,
    invoiceNumber: item.invoice_number,
    registrationNumber: item.registrations?.registration_number || "-",
    academicPeriodName: item.registrations?.academic_periods?.name || "-",
    invoiceTotalAmount: allocBreakdown.invoiceTotalAmount,
    cumulativeVerifiedPaid,
    remainingBalance,
    verifierName,
    serviceFeeTotal: allocBreakdown.serviceFeeTotal,
    serviceFeePaid: allocBreakdown.serviceFeePaid,
    serviceFeeRemaining: allocBreakdown.serviceFeeRemaining,
    utLiabilityTotal: allocBreakdown.utLiabilityTotal,
    utLiabilityPaid: allocBreakdown.utLiabilityPaid,
    utLiabilityRemaining: allocBreakdown.utLiabilityRemaining,
    receiptHeaderName: settings?.receipt_header_name || "SALUT MEGA CENDEKIA",
    receiptAddress: settings?.receipt_address || "Jl. Utama No. 12, Pangkalpinang, Bangka Belitung",
    receiptLeaderName: settings?.receipt_leader_name || "Drs. H. Ahmad Subagyo, M.M.",
    receiptFooter: settings?.receipt_footer || undefined,
  };
}

export async function getPaymentMasterOptions() {
  const supabase = await createClient();

  const [methodsRes, accountsRes, invoicesRes] = await Promise.all([
    supabase.from("payment_methods").select("id, code, name, requires_reference").eq("is_active", true).order("name"),
    supabase.from("cash_accounts").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("invoices").select(
      `
      id,
      invoice_number,
      registration_id,
      status,
      registrations ( student_id, registration_number, students ( id, nim, full_name ) ),
      lip_documents ( official_amount ),
      invoice_items ( amount, item_type, approval_status ),
      payment_allocations ( amount, student_payments ( status ) )
    `
    ).neq("status", "cancelled"),
  ]);

  const invoicesMapped = (invoicesRes.data || []).map((inv: any) => {
    let invoiceTotalAmount = 0;
    (inv.invoice_items || []).forEach((it: any) => {
      const amt = Number(it.amount) || 0;
      if (it.item_type === "discount") {
        if (it.approval_status === "approved") invoiceTotalAmount -= amt;
      } else {
        invoiceTotalAmount += amt;
      }
    });

    let verifiedPaid = 0;
    (inv.payment_allocations || []).forEach((pa: any) => {
      if (pa.student_payments?.status === "verified") {
        verifiedPaid += Number(pa.amount) || 0;
      }
    });

    const remainingBalance = Math.max(0, invoiceTotalAmount - verifiedPaid);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      studentId: inv.registrations?.students?.id,
      studentName: inv.registrations?.students?.full_name,
      studentNim: inv.registrations?.students?.nim,
      registrationNumber: inv.registrations?.registration_number,
      invoiceTotalAmount,
      verifiedPaid,
      remainingBalance,
    };
  });

  return {
    paymentMethods: (methodsRes.data || []) as { id: string; code: string; name: string; requires_reference: boolean }[],
    cashAccounts: (accountsRes.data || []) as { id: string; code: string; name: string }[],
    invoices: invoicesMapped,
  };
}
