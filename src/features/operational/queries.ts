import { createClient } from "@/lib/supabase/server";
import {
  OperationalTransaction,
  OperationalCategory,
  OperationalTransactionVoidRequest,
  OperationalTransactionType,
} from "@/types/operational";

export async function getOperationalCategoriesList(
  type?: OperationalTransactionType
): Promise<OperationalCategory[]> {
  const supabase = await createClient();

  let query = supabase
    .from("operational_categories")
    .select("*")
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("transaction_type", type);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    transactionType: item.transaction_type,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

export async function getOperationalTransactionsList(params: {
  page?: number;
  limit?: number;
  search?: string;
  transactionType?: string;
  categoryId?: string;
  cashAccountId?: string;
  status?: string;
} = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("operational_transactions")
    .select(
      `
      *,
      operational_categories ( name ),
      cash_accounts ( name ),
      operational_transaction_void_requests (
        id,
        status,
        reason,
        requested_at,
        review_notes
      )
    `,
      { count: "exact" }
    );

  if (params.transactionType) {
    query = query.eq("transaction_type", params.transactionType);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.cashAccountId) {
    query = query.eq("cash_account_id", params.cashAccountId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(
      `transaction_number.ilike.${s},description.ilike.${s},reference_number.ilike.${s}`
    );
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching operational transactions:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: OperationalTransaction[] = (data || []).map((item: any) => {
    const voidReqData =
      item.operational_transaction_void_requests &&
      item.operational_transaction_void_requests.length > 0
        ? item.operational_transaction_void_requests[
            item.operational_transaction_void_requests.length - 1
          ]
        : null;

    const voidRequest: OperationalTransactionVoidRequest | null = voidReqData
      ? {
          id: voidReqData.id,
          operationalTransactionId: item.id,
          requestedBy: voidReqData.requested_by,
          requestedAt: voidReqData.requested_at,
          reason: voidReqData.reason,
          status: voidReqData.status,
          reviewedBy: voidReqData.reviewed_by,
          reviewedAt: voidReqData.reviewed_at,
          reviewNotes: voidReqData.review_notes,
          createdAt: voidReqData.created_at,
        }
      : null;

    return {
      id: item.id,
      transactionNumber: item.transaction_number,
      transactionType: item.transaction_type,
      categoryId: item.category_id,
      cashAccountId: item.cash_account_id,
      transactionDate: item.transaction_date,
      amount: Number(item.amount) || 0,
      description: item.description,
      referenceNumber: item.reference_number,
      proofStoragePath: item.proof_storage_path,
      originalFileName: item.original_file_name,
      mimeType: item.mime_type,
      fileSize: item.file_size ? Number(item.file_size) : null,
      status: item.status,
      notes: item.notes,
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
      categoryName: item.operational_categories?.name || "Kategori",
      cashAccountName: item.cash_accounts?.name || null,
      voidRequest,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return { data: mappedData, total, page, limit, totalPages };
}

export async function getOperationalTransactionById(
  id: string
): Promise<OperationalTransaction | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("operational_transactions")
    .select(
      `
      *,
      operational_categories ( name ),
      cash_accounts ( name ),
      operational_transaction_void_requests (
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

  let signedProofUrl: string | null = null;
  if (item.proof_storage_path) {
    const { data: signedData } = await supabase.storage
      .from("operational-proofs")
      .createSignedUrl(item.proof_storage_path, 60);
    signedProofUrl = signedData?.signedUrl || null;
  }

  const voidReqData =
    item.operational_transaction_void_requests &&
    item.operational_transaction_void_requests.length > 0
      ? item.operational_transaction_void_requests[
          item.operational_transaction_void_requests.length - 1
        ]
      : null;

  const voidRequest: OperationalTransactionVoidRequest | null = voidReqData
    ? {
        id: voidReqData.id,
        operationalTransactionId: item.id,
        requestedBy: voidReqData.requested_by,
        requestedAt: voidReqData.requested_at,
        reason: voidReqData.reason,
        status: voidReqData.status,
        reviewedBy: voidReqData.reviewed_by,
        reviewedAt: voidReqData.reviewed_at,
        reviewNotes: voidReqData.review_notes,
        createdAt: voidReqData.created_at,
      }
    : null;

  return {
    id: item.id,
    transactionNumber: item.transaction_number,
    transactionType: item.transaction_type,
    categoryId: item.category_id,
    cashAccountId: item.cash_account_id,
    transactionDate: item.transaction_date,
    amount: Number(item.amount) || 0,
    description: item.description,
    referenceNumber: item.reference_number,
    proofStoragePath: item.proof_storage_path,
    originalFileName: item.original_file_name,
    mimeType: item.mime_type,
    fileSize: item.file_size ? Number(item.file_size) : null,
    status: item.status,
    notes: item.notes,
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
    categoryName: item.operational_categories?.name || "Kategori",
    cashAccountName: item.cash_accounts?.name || null,
    signedProofUrl,
    voidRequest,
  };
}
