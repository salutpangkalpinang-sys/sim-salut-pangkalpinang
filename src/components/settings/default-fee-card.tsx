import { SalutSettings } from "@/types/settings";
import { Wallet, AlertTriangle } from "lucide-react";

interface DefaultFeeCardProps {
  settings: SalutSettings;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DefaultFeeCard({ settings, disabled, onChange }: DefaultFeeCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Card 3 — Keuangan — Default Biaya Layanan</h2>
          <p className="text-[11px] text-slate-500">
            Nominal awal estimasi biaya layanan SALUT untuk registrasi mahasiswa baru
          </p>
        </div>
      </div>

      {/* Prominent Warning Banner */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-start gap-2.5 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="block text-[11px]">Penting: Immutability Snapshot Keuangan</strong>
          <p className="text-[11px]">
            Perubahan nilai default tidak mengubah tarif atau tagihan yang sudah tersimpan sebelumnya. Histori registrasi dan invoice terdahulu tetap terlindungi secara permanen.
          </p>
        </div>
      </div>

      <div className="max-w-md">
        <label htmlFor="default_salut_fee" className="block font-semibold text-slate-700 mb-1">
          Default Biaya Layanan SALUT (Integer Rupiah) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 font-mono">
            Rp
          </span>
          <input
            id="default_salut_fee"
            name="default_salut_fee"
            type="number"
            min={0}
            step={1}
            required
            disabled={disabled}
            value={settings.default_salut_fee}
            onChange={onChange}
            placeholder="400000"
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Nominal ini akan digunakan sebagai nilai acuan otomatis saat pembuatan registrasi baru. (Contoh: 400000).
        </p>
      </div>
    </div>
  );
}
