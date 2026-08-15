import { SalutSettings } from "@/types/settings";
import { Building2 } from "lucide-react";

interface SalutIdentityCardProps {
  settings: SalutSettings;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function SalutIdentityCard({ settings, disabled, onChange }: SalutIdentityCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Card 1 — Identitas SALUT</h2>
          <p className="text-[11px] text-slate-500">
            Informasi identitas resmi lembaga Sentra Layanan Universitas Terbuka
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nama SALUT */}
        <div>
          <label htmlFor="salut_name" className="block font-semibold text-slate-700 mb-1">
            Nama Singkat SALUT <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_name"
            name="salut_name"
            type="text"
            required
            disabled={disabled}
            value={settings.salut_name}
            onChange={onChange}
            placeholder="Contoh: SALUT Pangkalpinang"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Nama Resmi */}
        <div>
          <label htmlFor="salut_official_name" className="block font-semibold text-slate-700 mb-1">
            Nama Resmi Instansi <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_official_name"
            name="salut_official_name"
            type="text"
            required
            disabled={disabled}
            value={settings.salut_official_name}
            onChange={onChange}
            placeholder="Contoh: Sentra Layanan Universitas Terbuka Pangkalpinang"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Alamat */}
        <div className="md:col-span-2">
          <label htmlFor="salut_address" className="block font-semibold text-slate-700 mb-1">
            Alamat Kantor Resmi <span className="text-red-500">*</span>
          </label>
          <textarea
            id="salut_address"
            name="salut_address"
            rows={2}
            required
            disabled={disabled}
            value={settings.salut_address}
            onChange={onChange}
            placeholder="Contoh: Jl. Utama No. 12, Pangkalpinang"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Kota */}
        <div>
          <label htmlFor="salut_city" className="block font-semibold text-slate-700 mb-1">
            Kota / Kabupaten <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_city"
            name="salut_city"
            type="text"
            required
            disabled={disabled}
            value={settings.salut_city}
            onChange={onChange}
            placeholder="Pangkalpinang"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Provinsi */}
        <div>
          <label htmlFor="salut_province" className="block font-semibold text-slate-700 mb-1">
            Provinsi
          </label>
          <input
            id="salut_province"
            name="salut_province"
            type="text"
            disabled={disabled}
            value={settings.salut_province}
            onChange={onChange}
            placeholder="Kepulauan Bangka Belitung"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Kode Pos */}
        <div>
          <label htmlFor="salut_postal_code" className="block font-semibold text-slate-700 mb-1">
            Kode Pos
          </label>
          <input
            id="salut_postal_code"
            name="salut_postal_code"
            type="text"
            disabled={disabled}
            value={settings.salut_postal_code}
            onChange={onChange}
            placeholder="33111"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* WhatsApp */}
        <div>
          <label htmlFor="salut_whatsapp" className="block font-semibold text-slate-700 mb-1">
            Nomor WhatsApp Contact SALUT <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_whatsapp"
            name="salut_whatsapp"
            type="text"
            required
            disabled={disabled}
            value={settings.salut_whatsapp}
            onChange={onChange}
            placeholder="081234567890"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="salut_email" className="block font-semibold text-slate-700 mb-1">
            Email Resmi SALUT <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_email"
            name="salut_email"
            type="email"
            required
            disabled={disabled}
            value={settings.salut_email}
            onChange={onChange}
            placeholder="info@salut-pangkalpinang.ac.id"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>

        {/* Nama Pimpinan */}
        <div>
          <label htmlFor="salut_leader_name" className="block font-semibold text-slate-700 mb-1">
            Nama Pimpinan / Direktur SALUT <span className="text-red-500">*</span>
          </label>
          <input
            id="salut_leader_name"
            name="salut_leader_name"
            type="text"
            required
            disabled={disabled}
            value={settings.salut_leader_name}
            onChange={onChange}
            placeholder="Drs. H. Ahmad Subagyo, M.M."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
