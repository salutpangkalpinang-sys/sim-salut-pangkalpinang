import { Settings, ShieldCheck, Eye } from "lucide-react";

interface SettingsHeaderBannerProps {
  isOwner: boolean;
  roleName: string;
}

export function SettingsHeaderBanner({ isOwner, roleName }: SettingsHeaderBannerProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0 font-bold">
          <Settings className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pengaturan Sistem (System Settings)
            </h1>
            {!isOwner && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Eye className="w-3 h-3" />
                <span>Mode Lihat Saja</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Konfigurasi parameter operasional resmi SIM-SALUT, informasi kop kuitansi, dan default estimasi biaya layanan untuk pendaftaran baru.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            isOwner
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-slate-100 text-slate-700 border-slate-300"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Akses Peran: {roleName}</span>
        </span>
      </div>
    </div>
  );
}
