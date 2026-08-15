export type RegistrationStatus = "draft" | "active" | "cancelled";

export interface RegistrationType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface RegistrationFeeSnapshot {
  id: string;
  registrationId: string;
  sourceFeeRateId: string | null;
  feeTypeId: string;
  feeNameSnapshot: string;
  calculationType: "FIXED" | "PER_SKS" | "per_semester" | "per_sks";
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  sourceSnapshot: string;
  notes: string | null;
  createdAt: string;

  // Joined relations
  feeTypeName?: string;
  feeTypeCode?: string;
  feeTypeCategory?: string;
}

export interface Registration {
  id: string;
  registrationNumber: string;
  studentId: string;
  academicPeriodId: string;
  registrationTypeId: string;
  studyProgramId: string;
  serviceSchemeId: string;
  credits: number;
  status: RegistrationStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;

  // Joined relations
  studentNim?: string | null;
  studentName?: string;
  academicPeriodName?: string;
  academicPeriodCode?: string;
  registrationTypeName?: string;
  registrationTypeCode?: string;
  studyProgramName?: string;
  studyProgramCode?: string;
  serviceSchemeName?: string;
  serviceSchemeCode?: string;
  totalEstimateAmount?: number;
  feeSnapshots?: RegistrationFeeSnapshot[];
}

export interface RegistrationFilterParams {
  search?: string;
  academicPeriodId?: string;
  registrationTypeId?: string;
  studyProgramId?: string;
  serviceSchemeId?: string;
  status?: RegistrationStatus | "";
  studentId?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "registrationNumber" | "studentName" | "academicPeriod";
  sortOrder?: "asc" | "desc";
}

export interface CandidateFeeRate {
  id: string;
  feeTypeId: string;
  feeTypeName: string;
  feeTypeCode: string;
  feeTypeCategory: string;
  name: string;
  calculationType: "FIXED" | "PER_SKS";
  unitAmount: number;
  source: string;
  isPerSks: boolean;
}
