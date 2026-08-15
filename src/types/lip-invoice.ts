export type LipStatus = "draft" | "pending_verification" | "verified" | "paid_to_ut" | "cancelled";
export type InvoiceStatus = "draft" | "unpaid" | "cancelled" | "partial" | "paid" | "overdue";
export type InvoiceItemType = "ut_liability" | "service_fee" | "internal_fee" | "discount";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface LipDocument {
  id: string;
  registrationId: string;
  lipNumber: string;
  version: number;
  officialAmount: number;
  tuitionAmount: number;
  bookAmount: number;
  shippingAmount: number;
  otherUtAmount: number;
  issuedAt: string | null;
  dueAt: string | null;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: LipStatus;
  notes: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;

  // Computed & Joined properties
  componentTotalAmount?: number;
  hasAmountMismatch?: boolean;
  mismatchDifference?: number;
  registrationNumber?: string;
  studentName?: string;
  studentNim?: string | null;
  academicPeriodName?: string;
  signedUrl?: string | null;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  itemType: InvoiceItemType;
  feeTypeId: string | null;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  sourceType: string;
  sourceId: string | null;
  approvalStatus: ApprovalStatus | null;
  approvalReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  registrationId: string;
  lipDocumentId: string;
  issuedAt: string;
  dueAt: string | null;
  status: InvoiceStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;

  // Joined properties
  registrationNumber?: string;
  studentName?: string;
  studentNim?: string | null;
  academicPeriodName?: string;
  lipNumber?: string;
  lipOfficialAmount?: number;
  totalInvoiceAmount?: number;
  verifiedPaid?: number;
  remainingBalance?: number;
  items?: InvoiceItem[];
}

export interface LipFilterParams {
  search?: string;
  academicPeriodId?: string;
  status?: LipStatus | "";
  registrationId?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceFilterParams {
  search?: string;
  academicPeriodId?: string;
  status?: InvoiceStatus | "";
  registrationId?: string;
  page?: number;
  limit?: number;
}
