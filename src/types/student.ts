export interface Student {
  id: string;
  nim: string | null;
  nik: string | null;
  fullName: string;
  birthPlace: string | null;
  birthDate: string | null;
  gender: "L" | "P" | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  entryYear: number | null;
  facultyId: string | null;
  studyLevelId: string | null;
  studyProgramId: string | null;
  serviceSchemeId: string | null;
  statusId: string;
  statusEffectiveAt: string;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;

  // Joined Master Relations
  facultyName?: string;
  facultyCode?: string;
  studyLevelName?: string;
  studyLevelCode?: string;
  studyProgramName?: string;
  studyProgramCode?: string;
  serviceSchemeName?: string;
  serviceSchemeCode?: string;
  statusName?: string;
  statusCode?: string;
}

export interface StudentStatusHistory {
  id: string;
  studentId: string;
  previousStatusId: string | null;
  newStatusId: string;
  effectiveAt: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;

  // Joined Relations
  previousStatusName?: string;
  newStatusName?: string;
  changedByName?: string;
}

export interface StudentFilterParams {
  search?: string;
  facultyId?: string;
  studyProgramId?: string;
  entryYear?: number;
  serviceSchemeId?: string;
  statusId?: string;
  isCalon?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "fullName" | "nim" | "entryYear" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface MasterOption {
  id: string;
  code: string;
  name: string;
}
