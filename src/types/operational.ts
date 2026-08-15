export type OperationalTransactionType = "income" | "expense";
export type OperationalTransactionStatus = "draft" | "pending_verification" | "verified" | "rejected" | "voided";

export interface OperationalCategory {
  id: string;
  code: string | null;
  name: string;
  transactionType: OperationalTransactionType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalTransactionVoidRequest {
  id: string;
  operationalTransactionId: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface OperationalTransaction {
  id: string;
  transactionNumber: string;
  transactionType: OperationalTransactionType;
  categoryId: string;
  cashAccountId: string | null;
  transactionDate: string;
  amount: number;
  description: string;
  referenceNumber: string | null;
  proofStoragePath: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: OperationalTransactionStatus;
  notes: string | null;
  idempotencyKey: string;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;

  // Joined properties
  categoryName?: string;
  cashAccountName?: string | null;
  signedProofUrl?: string | null;
  voidRequest?: OperationalTransactionVoidRequest | null;
}
