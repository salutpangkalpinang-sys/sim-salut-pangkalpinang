export type PaymentStatus = "draft" | "pending_verification" | "verified" | "rejected" | "voided";
export type VoidRequestStatus = "pending" | "approved" | "rejected";

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  createdAt: string;
  createdBy: string | null;

  // Joined properties
  invoiceNumber?: string;
  invoiceTotalAmount?: number;
  registrationNumber?: string;
}

export interface PaymentVoidRequest {
  id: string;
  paymentId: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: VoidRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;

  // Joined properties
  requestedByName?: string;
  reviewedByName?: string;
}

export interface StudentPayment {
  id: string;
  transactionNumber: string;
  studentId: string;
  paidAt: string;
  amount: number;
  paymentMethodId: string;
  cashAccountId: string | null;
  referenceNumber: string | null;
  proofStoragePath: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  status: PaymentStatus;
  notes: string | null;
  receivedBy: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string | null;
  createdBy: string | null;
  updatedBy: string | null;

  // Computed & Joined properties
  studentName?: string;
  studentNim?: string | null;
  paymentMethodName?: string;
  cashAccountName?: string | null;
  allocatedAmountTotal?: number;
  unallocatedAmount?: number;
  signedProofUrl?: string | null;
  allocations?: PaymentAllocation[];
  voidRequest?: PaymentVoidRequest | null;
}

export interface PaymentFilterParams {
  search?: string;
  studentId?: string;
  invoiceId?: string;
  status?: PaymentStatus | "";
  paymentMethodId?: string;
  page?: number;
  limit?: number;
}

export interface PaymentReceiptData {
  transactionNumber: string;
  paidAt: string;
  studentName: string;
  studentNim: string | null;
  paymentMethodName: string;
  referenceNumber: string | null;
  amount: number;
  status: PaymentStatus;
  invoiceNumber: string;
  registrationNumber: string;
  academicPeriodName: string;
  invoiceTotalAmount: number;
  cumulativeVerifiedPaid: number;
  remainingBalance: number;
  verifierName: string | null;
  serviceFeeTotal?: number;
  serviceFeePaid?: number;
  serviceFeeRemaining?: number;
  utLiabilityTotal?: number;
  utLiabilityPaid?: number;
  utLiabilityRemaining?: number;
  receiptHeaderName?: string;
  receiptAddress?: string;
  receiptLeaderName?: string;
  receiptFooter?: string;
}
