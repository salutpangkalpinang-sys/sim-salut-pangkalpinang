import { RoleCode } from "@/lib/auth/types";

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  roleName: string;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface UserSummary {
  totalUsers: number;
  ownerCount: number;
  academicAdminCount: number;
  financeAdminCount: number;
  viewerCount: number;
  inactiveCount: number;
}

export interface UserFilter {
  search?: string;
  role?: RoleCode | "ALL";
  status?: "ACTIVE" | "INACTIVE" | "ALL";
}

export interface AuditEventPayload {
  actorUserId: string;
  action: "user_invited" | "user_created" | "user_role_changed" | "user_deactivated" | "user_reactivated";
  entityType: "user" | "profile" | "role";
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  reason?: string;
  metadata?: Record<string, unknown> | null;
}
