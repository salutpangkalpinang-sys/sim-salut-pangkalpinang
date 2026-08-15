"use server";

import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAuditLogsList, getAuditLogsSummary } from "./queries";
import { AuditFilter } from "@/types/audit";

export async function fetchAuditLogsAction(filter?: AuditFilter) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "owner" && profile.role !== "viewer")) {
    return {
      error: "Hanya role Owner dan Viewer yang memiliki izin melihat Audit Log.",
      data: [],
      totalCount: 0,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    };
  }

  return await getAuditLogsList(filter);
}

export async function fetchAuditSummaryAction() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "owner" && profile.role !== "viewer")) {
    return {
      todayCount: 0,
      last7DaysCount: 0,
      userChangesCount: 0,
      financialActivitiesCount: 0,
    };
  }

  return await getAuditLogsSummary();
}
