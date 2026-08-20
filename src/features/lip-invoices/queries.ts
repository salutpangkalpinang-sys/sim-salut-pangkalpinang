import { createClient } from "@/lib/supabase/server";
import {
  LipDocument,
  Invoice,
  InvoiceItem,
  LipFilterParams,
  InvoiceFilterParams,
} from "@/types/lip-invoice";

export async function getLipDocumentsList(params: LipFilterParams = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("lip_documents")
    .select(
      `
      *,
      registrations (
        registration_number,
        academic_periods ( name ),
        students ( nim, full_name )
      ),
      invoices (
        invoice_number,
        status
      )
    `,
      { count: "exact" }
    );

  if (params.registrationId) {
    query = query.eq("registration_id", params.registrationId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`lip_number.ilike.${s}`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching LIP documents:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: LipDocument[] = (data || []).map((item: any) => {
    const tuition = Number(item.tuition_amount) || 0;
    const book = Number(item.book_amount) || 0;
    const shipping = Number(item.shipping_amount) || 0;
    const other = Number(item.other_ut_amount) || 0;
    const official = Number(item.official_amount) || 0;
    const componentTotalAmount = tuition + book + shipping + other;
    const hasAmountMismatch = componentTotalAmount !== official;
    const mismatchDifference = Math.abs(componentTotalAmount - official);

    const activeInv = (item.invoices || []).find((inv: any) => inv.status !== "cancelled");
    const hasActiveInvoice = Boolean(activeInv);
    const activeInvoiceNumber = activeInv?.invoice_number || null;

    return {
      id: item.id,
      registrationId: item.registration_id,
      lipNumber: item.lip_number,
      version: item.version,
      officialAmount: official,
      tuitionAmount: tuition,
      bookAmount: book,
      shippingAmount: shipping,
      otherUtAmount: other,
      issuedAt: item.issued_at,
      dueAt: item.due_at,
      storagePath: item.storage_path,
      originalFileName: item.original_file_name,
      mimeType: item.mime_type,
      fileSize: Number(item.file_size),
      status: item.status,
      notes: item.notes,
      verifiedAt: item.verified_at,
      verifiedBy: item.verified_by,
      cancelledAt: item.cancelled_at,
      cancelledBy: item.cancelled_by,
      cancellationReason: item.cancellation_reason,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      componentTotalAmount,
      hasAmountMismatch,
      mismatchDifference,
      registrationNumber: item.registrations?.registration_number,
      studentName: item.registrations?.students?.full_name,
      studentNim: item.registrations?.students?.nim,
      academicPeriodName: item.registrations?.academic_periods?.name,
      hasActiveInvoice,
      activeInvoiceNumber,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { data: mappedData, total, page, limit, totalPages };
}

export async function getInvoicesList(params: InvoiceFilterParams = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("invoices")
    .select(
      `
      *,
      lip_documents ( lip_number, official_amount ),
      registrations (
        registration_number,
        academic_periods ( name ),
        students ( nim, full_name )
      ),
      invoice_items ( amount, item_type, approval_status ),
      payment_allocations (

        amount,
        student_payments ( status )
      )
    `,
      { count: "exact" }
    );

  if (params.registrationId) {
    query = query.eq("registration_id", params.registrationId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`invoice_number.ilike.${s}`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching invoices:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: Invoice[] = (data || []).map((item: any) => {
    // Calculate Total Invoice Amount = SUM(positive items) - SUM(approved discount items)
    const items = item.invoice_items || [];
    let totalInvoiceAmount = 0;
    items.forEach((it: any) => {
      const amt = Number(it.amount) || 0;
      if (it.item_type === "discount") {
        if (it.approval_status === "approved") {
          totalInvoiceAmount -= amt;
        }
      } else {
        totalInvoiceAmount += amt;
      }
    });

    let verifiedPaid = 0;
    (item.payment_allocations || []).forEach((pa: any) => {
      if (pa.student_payments?.status === "verified") {
        verifiedPaid += Number(pa.amount) || 0;
      }
    });

    const remainingBalance = Math.max(0, totalInvoiceAmount - verifiedPaid);

    let derivedStatus: "unpaid" | "partial" | "paid" | "cancelled" = item.status;
    if (item.status !== "cancelled") {
      if (verifiedPaid >= totalInvoiceAmount && totalInvoiceAmount > 0) {
        derivedStatus = "paid";
      } else if (verifiedPaid > 0) {
        derivedStatus = "partial";
      } else {
        derivedStatus = "unpaid";
      }
    }

    return {
      id: item.id,
      invoiceNumber: item.invoice_number,
      registrationId: item.registration_id,
      lipDocumentId: item.lip_document_id,
      issuedAt: item.issued_at,
      dueAt: item.due_at,
      status: derivedStatus,
      notes: item.notes,
      cancelledAt: item.cancelled_at,
      cancelledBy: item.cancelled_by,
      cancellationReason: item.cancellation_reason,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      registrationNumber: item.registrations?.registration_number,
      studentName: item.registrations?.students?.full_name,
      studentNim: item.registrations?.students?.nim,
      academicPeriodName: item.registrations?.academic_periods?.name,
      lipNumber: item.lip_documents?.lip_number,
      lipOfficialAmount: Number(item.lip_documents?.official_amount) || 0,
      totalInvoiceAmount: Math.max(0, totalInvoiceAmount),
      verifiedPaid,
      remainingBalance,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { data: mappedData, total, page, limit, totalPages };
}

export async function getLipDocumentById(id: string): Promise<LipDocument | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lip_documents")
    .select(
      `
      *,
      registrations (
        registration_number,
        academic_periods ( name ),
        students ( nim, full_name )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const item: any = data;

  const tuition = Number(item.tuition_amount) || 0;
  const book = Number(item.book_amount) || 0;
  const shipping = Number(item.shipping_amount) || 0;
  const other = Number(item.other_ut_amount) || 0;
  const official = Number(item.official_amount) || 0;
  const componentTotalAmount = tuition + book + shipping + other;
  const hasAmountMismatch = componentTotalAmount !== official;
  const mismatchDifference = Math.abs(componentTotalAmount - official);

  // Generate signed URL (60 seconds short-lived) for private storage access
  let signedUrl: string | null = null;
  if (item.storage_path) {
    const { data: signedData } = await supabase.storage
      .from("lip-documents")
      .createSignedUrl(item.storage_path, 60);
    signedUrl = signedData?.signedUrl || null;
  }

  return {
    id: item.id,
    registrationId: item.registration_id,
    lipNumber: item.lip_number,
    version: item.version,
    officialAmount: official,
    tuitionAmount: tuition,
    bookAmount: book,
    shippingAmount: shipping,
    otherUtAmount: other,
    issuedAt: item.issued_at,
    dueAt: item.due_at,
    storagePath: item.storage_path,
    originalFileName: item.original_file_name,
    mimeType: item.mime_type,
    fileSize: Number(item.file_size),
    status: item.status,
    notes: item.notes,
    verifiedAt: item.verified_at,
    verifiedBy: item.verified_by,
    cancelledAt: item.cancelled_at,
    cancelledBy: item.cancelled_by,
    cancellationReason: item.cancellation_reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    componentTotalAmount,
    hasAmountMismatch,
    mismatchDifference,
    signedUrl,
    registrationNumber: item.registrations?.registration_number,
    studentName: item.registrations?.students?.full_name,
    studentNim: item.registrations?.students?.nim,
    academicPeriodName: item.registrations?.academic_periods?.name,
  };
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      lip_documents ( lip_number, official_amount ),
      registrations (
        registration_number,
        academic_periods ( name ),
        students ( nim, full_name )
      ),
      invoice_items (
        id,
        invoice_id,
        item_type,
        fee_type_id,
        description,
        quantity,
        unit_amount,
        amount,
        source_type,
        source_id,
        approval_status,
        approval_reason,
        approved_by,
        approved_at,
        created_at,
        created_by,
        fee_types ( name, code )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const item: any = data;

  const items: InvoiceItem[] = (item.invoice_items || []).map((it: any) => ({
    id: it.id,
    invoiceId: it.invoice_id,
    itemType: it.item_type,
    feeTypeId: it.fee_type_id,
    description: it.description,
    quantity: it.quantity,
    unitAmount: Number(it.unit_amount),
    amount: Number(it.amount),
    sourceType: it.source_type,
    sourceId: it.source_id,
    approvalStatus: it.approval_status,
    approvalReason: it.approval_reason,
    approvedBy: it.approved_by,
    approvedAt: it.approved_at,
    createdAt: it.created_at,
    createdBy: it.created_by,
  }));

  let totalInvoiceAmount = 0;
  items.forEach((it) => {
    if (it.itemType === "discount") {
      if (it.approvalStatus === "approved") {
        totalInvoiceAmount -= it.amount;
      }
    } else {
      totalInvoiceAmount += it.amount;
    }
  });

  return {
    id: item.id,
    invoiceNumber: item.invoice_number,
    registrationId: item.registration_id,
    lipDocumentId: item.lip_document_id,
    issuedAt: item.issued_at,
    dueAt: item.due_at,
    status: item.status,
    notes: item.notes,
    cancelledAt: item.cancelled_at,
    cancelledBy: item.cancelled_by,
    cancellationReason: item.cancellation_reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    registrationNumber: item.registrations?.registration_number,
    studentName: item.registrations?.students?.full_name,
    studentNim: item.registrations?.students?.nim,
    academicPeriodName: item.registrations?.academic_periods?.name,
    lipNumber: item.lip_documents?.lip_number,
    lipOfficialAmount: Number(item.lip_documents?.official_amount) || 0,
    totalInvoiceAmount: Math.max(0, totalInvoiceAmount),
    items,
  };
}

export async function getRegistrationLipAndInvoices(registrationId: string) {
  const [lipsRes, invoicesRes] = await Promise.all([
    getLipDocumentsList({ registrationId, limit: 50 }),
    getInvoicesList({ registrationId, limit: 50 }),
  ]);

  return {
    lipDocuments: lipsRes.data,
    invoices: invoicesRes.data,
  };
}
