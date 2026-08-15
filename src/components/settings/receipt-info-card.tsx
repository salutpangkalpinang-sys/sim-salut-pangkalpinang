import { SalutSettings } from "@/types/settings";
import { Receipt } from "lucide-react";

interface ReceiptInfoCardProps {
  settings: SalutSettings;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function ReceiptInfoCard({ settings, disabled, onChange }: ReceiptInfoCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
          <Receipt className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Card 2 — Dokumen & Kuitansi</h2>
          <p className="text-[11px] text-slate-500">
            Pengaturan kop dan catatan footer kuitansi resmi pembayaran mahasiswa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Header Name */}
        <div>
          <label htmlFor="receipt_header_name" className="block font-semibold text-slate-700 mb-1">
            Nama Kop Kuitansi <span className="text-red-500">*</span>
          </label>
          <input
            id="receipt_header_name"
            name="receipt_header_name"
            type="text"
            required
            disabled={disabled}
            value={settings.receipt_header_name}
            onChange={onChange}
            placeholder="SALUT PANGKALPINANG"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Leader Name */}
        <div>
          <label htmlFor="receipt_leader_name" className="block font-semibold text-slate-700 mb-1">
            Nama Penanggung Jawab Kuitansi <span className="text-red-500">*</span>
          </label>
          <input
            id="receipt_leader_name"
            name="receipt_leader_name"
            type="text"
            required
            disabled={disabled}
            value={settings.receipt_leader_name}
            onChange={onChange}
            placeholder="Drs. H. Ahmad Subagyo, M.M."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label htmlFor="receipt_address" className="block font-semibold text-slate-700 mb-1">
            Alamat yang Tampil pada Kuitansi <span className="text-red-500">*</span>
          </label>
          <input
            id="receipt_address"
            name="receipt_address"
            type="text"
            required
            disabled={disabled}
            value={settings.receipt_address}
            onChange={onChange}
            placeholder="Jl. Utama No. 12, Pangkalpinang, Bangka Belitung"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* WhatsApp */}
        <div>
          <label htmlFor="receipt_whatsapp" className="block font-semibold text-slate-700 mb-1">
            WhatsApp Kontak Kuitansi <span className="text-red-500">*</span>
          </label>
          <input
            id="receipt_whatsapp"
            name="receipt_whatsapp"
            type="text"
            required
            disabled={disabled}
            value={settings.receipt_whatsapp}
            onChange={onChange}
            placeholder="081234567890"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="receipt_email" className="block font-semibold text-slate-700 mb-1">
            Email Kontak Kuitansi <span className="text-red-500">*</span>
          </label>
          <input
            id="receipt_email"
            name="receipt_email"
            type="email"
            required
            disabled={disabled}
            value={settings.receipt_email}
            onChange={onChange}
            placeholder="keuangan@salut-pangkalpinang.ac.id"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Footer Text */}
        <div className="md:col-span-2">
          <label htmlFor="receipt_footer" className="block font-semibold text-slate-700 mb-1">
            Catatan Footer Kuitansi (Bisa Multi-line)
          </label>
          <textarea
            id="receipt_footer"
            name="receipt_footer"
            rows={3}
            disabled={disabled}
            value={settings.receipt_footer}
            onChange={onChange}
            placeholder="1. Bukti pembayaran ini adalah dokumen sah pengganti kuitansi fisik."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
