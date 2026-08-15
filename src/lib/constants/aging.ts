export const AGING_THRESHOLDS = {
  NEW_MAX_DAYS: 2, // 0 - 2 hari -> BARU
  ATTENTION_MAX_DAYS: 7, // 3 - 7 hari -> PERLU PERHATIAN
  // > 7 hari / overdue -> URGENT
} as const;

export type PriorityLevel = "BARU" | "PERLU_PERHATIAN" | "URGENT";

export function getPriorityLevel(createdAtISO: string, isOverdue: boolean = false): PriorityLevel {
  if (isOverdue) return "URGENT";

  try {
    const now = Date.now();
    const created = new Date(createdAtISO).getTime();
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    if (diffDays <= AGING_THRESHOLDS.NEW_MAX_DAYS) return "BARU";
    if (diffDays <= AGING_THRESHOLDS.ATTENTION_MAX_DAYS) return "PERLU_PERHATIAN";
    return "URGENT";
  } catch {
    return "PERLU_PERHATIAN";
  }
}

export function getPriorityBadgeMeta(priority: PriorityLevel): {
  label: string;
  badgeStyle: string;
} {
  switch (priority) {
    case "BARU":
      return {
        label: "Baru",
        badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "PERLU_PERHATIAN":
      return {
        label: "Perlu Perhatian",
        badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "URGENT":
      return {
        label: "Urgent",
        badgeStyle: "bg-red-50 text-red-700 border-red-200 font-bold animate-pulse",
      };
  }
}
