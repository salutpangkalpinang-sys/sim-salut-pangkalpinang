import { RoleCode } from "@/lib/auth/types";

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: RoleCode;
  actorRoleName: string;
  action: string;
  actionLabel: string;
  module: string;
  moduleLabel: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  createdAtWib: string;
}

export interface AuditSummary {
  todayCount: number;
  last7DaysCount: number;
  userChangesCount: number;
  financialActivitiesCount: number;
}

export interface AuditFilter {
  search?: string;
  module?: string; // 'user_management' | 'academic_student' | 'registration' | 'lip_invoice' | 'payments' | 'ut_remittances' | 'operational' | 'ALL'
  action?: string;
  role?: RoleCode | "ALL";
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedAuditResult {
  data: AuditLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
