import { Globe, ShieldCheck } from "lucide-react";

export function TimezoneCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
          <Globe className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Card 4 — Sistem — Timezone Sistem</h2>
          <p className="text-[11px] text-slate-500">
            Zona waktu standar operasional dan pelaporan transaksi SIM-SALUT
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Zona Waktu Sistem Standar:</span>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono font-bold rounded-full text-xs">
              Asia/Jakarta (WIB)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Seluruh transaksi keuangan, stempel waktu audit log, dan laporan penerimaan disajikan secara konsisten dalam zona waktu Waktu Indonesia Barat (UTC+7).
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Read-Only MVP</span>
        </span>
      </div>
    </div>
  );
}
