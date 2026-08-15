import { AuditLogItem } from "@/types/audit";
import { RoleCode } from "@/lib/auth/types";
import { Clock, Eye, ShieldAlert } from "lucide-react";

interface AuditTableProps {
  logs: AuditLogItem[];
  onSelectLog: (log: AuditLogItem) => void;
}

const ROLE_BADGES: Record<RoleCode, { label: string; badgeStyle: string }> = {
  owner: {
    label: "Owner",
    badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
  },
  academic_admin: {
    label: "Admin Akademik",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  finance_admin: {
    label: "Admin Keuangan",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
  },
  viewer: {
    label: "Viewer / Auditor",
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

const MODULE_STYLES: Record<string, string> = {
  user_management: "bg-purple-50 text-purple-700 border-purple-200",
  academic_student: "bg-blue-50 text-blue-700 border-blue-200",
  registration: "bg-indigo-50 text-indigo-700 border-indigo-200",
  lip_invoice: "bg-teal-50 text-teal-700 border-teal-200",
  payments: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ut_remittances: "bg-cyan-50 text-cyan-700 border-cyan-200",
  operational: "bg-amber-50 text-amber-700 border-amber-200",
};

export function AuditTable({ logs, onSelectLog }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center border border-slate-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Tidak Ada Log Aktivitas</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Tidak ditemukan riwayat jejak audit yang sesuai dengan kata kunci pencarian, modul, atau filter rentang tanggal yang Anda pilih.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3.5">Waktu (WIB)</th>
              <th className="px-4 py-3.5">Pengguna / Actor</th>
              <th className="px-4 py-3.5">Modul & Aksi</th>
              <th className="px-4 py-3.5">Entity & ID</th>
              <th className="px-4 py-3.5">Ringkasan Aktivitas</th>
              <th className="px-4 py-3.5 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {logs.map((log) => {
              const roleMeta = ROLE_BADGES[log.actorRole] || ROLE_BADGES.viewer;
              const moduleStyle = MODULE_STYLES[log.module] || "bg-slate-100 text-slate-700 border-slate-300";

              return (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="hover:bg-slate-50 transition cursor-pointer"
                >
                  {/* Waktu (WIB) */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-900 font-medium font-mono text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>{log.createdAtWib}</span>
                    </div>
                  </td>

                  {/* Pengguna / Actor */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{log.actorName}</span>
                        <span className={`px-2 py-0.2 text-[10px] font-semibold rounded-full border ${roleMeta.badgeStyle}`}>
                          {roleMeta.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.actorEmail}</div>
                    </div>
                  </td>

                  {/* Modul & Aksi */}
                  <td className="px-4 py-3.5 space-y-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${moduleStyle}`}
                    >
                      <span>{log.moduleLabel}</span>
                    </span>
                    <div className="font-semibold text-slate-800 text-[11px]">
                      {log.actionLabel}
                    </div>
                  </td>

                  {/* Entity & ID */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="font-mono text-[11px] text-slate-800 font-medium">
                      {log.entityType}
                    </div>
                    {log.entityId && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.entityId}
                      </div>
                    )}
                  </td>

                  {/* Ringkasan Aktivitas */}
                  <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={log.summary}>
                    {log.summary}
                  </td>

                  {/* Read-Only Detail Button */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
