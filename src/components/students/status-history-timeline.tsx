import { StudentStatusHistory } from "@/types/student";
import { History, UserCheck, Calendar } from "lucide-react";

interface StatusHistoryTimelineProps {
  history: StudentStatusHistory[];
}

export function StatusHistoryTimeline({ history }: StatusHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
        Belum ada riwayat perubahan status yang tercatat.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2">
        <History className="w-4 h-4 text-blue-600" />
        <span>Riwayat Perubahan Status (Kronologis)</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {history.map((item) => {
          const effectiveDateStr = new Date(item.effectiveAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={item.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />

              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-slate-500">{item.previousStatusName || "Status Awal"}</span>
                    <span className="text-blue-600">➔</span>
                    <span className="text-emerald-600">{item.newStatusName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{effectiveDateStr}</span>
                  </div>
                </div>

                {item.reason && (
                  <p className="text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded text-xs italic">
                    &ldquo;{item.reason}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <UserCheck className="w-3 h-3 text-slate-400" />
                  <span>Diubah oleh: {item.changedByName || "Sistem"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
