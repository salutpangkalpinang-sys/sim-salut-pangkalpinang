import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAuditLogsList, getAuditLogsSummary } from "@/features/audit/queries";
import { AuditListContainer } from "@/components/audit/audit-list-container";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default async function AuditLogPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Server-Side Authorization: Owner and Viewer ONLY
  if (profile.role !== "owner" && profile.role !== "viewer") {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center border border-red-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Akses Dibatasi (403 Forbidden)</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Peran Anda (<strong>{profile.role}</strong>) tidak memiliki izin server-side untuk melihat Audit Log Global. Modul ini hanya dapat diakses oleh **Owner / Pimpinan** dan **Viewer / Auditor**.
        </p>
      </div>
    );
  }

  const [initialResult, initialSummary] = await Promise.all([
    getAuditLogsList(),
    getAuditLogsSummary(),
  ]);

  return (
    <AuditListContainer
      initialResult={initialResult}
      initialSummary={initialSummary}
    />
  );
}
