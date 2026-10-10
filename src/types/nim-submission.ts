export interface NimSubmission {
  id: string;
  studentId: string;
  registrationId: string;
  invoiceId: string;
  status: "submitted" | "completed" | "cancelled";
  submissionDate: string;
  referenceNumber: string | null;
  notes: string | null;
  submittedBy: string;
  submittedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationInvoiceOption {
  registrationId: string;
  registrationNumber: string;
  academicPeriodName?: string;
  studyProgramName?: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  requiredSalutFee: number;
  netSalutPaid: number;
  hasReversal: boolean;
  isEligible: boolean;
}

export interface CandidateNimEligibilitySummary {
  studentId: string;
  studentNim: string | null;
  studentStatus: string;
  hasActiveNIM: boolean;
  activeSubmission: NimSubmission | null;
  latestCompletedSubmission: NimSubmission | null;
  registrationOptions: RegistrationInvoiceOption[];
  selectedOption: RegistrationInvoiceOption | null;
  queryError?: string;
}
