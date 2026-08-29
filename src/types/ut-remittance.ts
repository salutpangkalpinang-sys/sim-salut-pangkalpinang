export type UtRemittanceStatus = "draft" | "pending_verification" | "verified" | "rejected" | "voided";

export interface UtRemittanceItem {
  id: string;
  remittanceId: string;
  registrationId: string;
  lipDocumentId: string;
  amount: number;
  createdAt: string;
  createdBy: string | null;

  // Joined properties
  lipNumber?: string;
  officialAmount?: number;
  alreadyVerifiedUtPaid?: number;
  outstandingUtAmount?: number;
  registrationNumber?: string;
  studentName?: string;
  studentNim?: string | null;
}

export interface UtRemittanceVoidRequest {
  id: string;
  remittanceId: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface UtRemittance {
  id: string;
  remittanceNumber: string;
  paidAt: string;
  amount: number;
  cashAccountId: string | null;
  referenceNumber: string | null;
  proofStoragePath: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: UtRemittanceStatus;
  notes: string | null;
  receivedBy: string | null;
  idempotencyKey: string | null;
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

  // Joined & Computed properties
  cashAccountName?: string | null;
  signedProofUrl?: string | null;
  items?: UtRemittanceItem[];
  voidRequest?: UtRemittanceVoidRequest | null;
}

export interface EligibleLipForRemittance {
  id: string;
  registrationId: string;
  lipNumber: string;
  registrationNumber: string;
  studentName: string;
  studentNim: string | null;
  officialAmount: number;
  alreadyVerifiedUtPaid: number;
  outstandingUtAmount: number;
  isInvoicePaid?: boolean;
  invoiceStatus?: string;
}
