"use client";

import { useEffect, useState } from "react";
import { createUserAction } from "@/features/users/actions";
import { UserPlus, X, ShieldAlert, CheckCircle2, Eye, EyeOff } from "lucide-react";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function UserFormModal({ isOpen, onClose, onSuccess }: UserFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createUserAction(null, formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else if (res?.success && res.message) {
        onSuccess(res.message);
        onClose();
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("unexpected response was received from the server")) {
        setErrorMessage(
          "Gagal menghubungi server atau sesi login telah kedaluwarsa. Silakan refresh halaman dan pastikan Anda login sebagai Owner."
        );
      } else {
        setErrorMessage(msg || "Terjadi kesalahan saat menyimpan data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>Tambah / Invite Pengguna Internal</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label htmlFor="fullName" className="block font-semibold text-slate-700 mb-1">
              Nama Lengkap Pengguna <span className="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              placeholder="Contoh: Ahmad Subagyo, S.E."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label htmlFor="email" className="block font-semibold text-slate-700 mb-1">
              Username atau Email Login <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="text"
              required
              pattern="^[a-zA-Z0-9._%+\-]+(@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})?$"
              title="Masukkan username tanpa spasi (misal: admin_yolan) atau email valid"
              placeholder="Contoh: ahmad (atau ahmad@salut-pangkalpinang.ac.id)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Username <strong>tidak boleh ada spasi</strong> (misal: <code>yolanda</code> atau <code>admin_yolan</code>). Jika tanpa <code>@</code>, otomatis menjadi <code>@salut-pangkalpinang.ac.id</code>.
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block font-semibold text-slate-700 mb-1">
              Password Login <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={12}
                placeholder="Minimal 12 karakter kombinasi alfanumerik & simbol"
                className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Password wajib diisi minimal 12 karakter untuk memenuhi standar keamanan akses institusi.
            </p>
          </div>

          <div>
            <label htmlFor="role" className="block font-semibold text-slate-700 mb-1">
              Peran Hak Akses (Role) <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue="admin"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="admin">Admin (Akses Penuh ke Seluruh Menu & Fitur)</option>
              <option value="academic_admin">Admin Akademik (Kelola Mahasiswa, Registrasi & LIP)</option>
              <option value="finance_admin">Admin Keuangan / Kasir (Kelola Bayar, UT & Kas)</option>
              <option value="viewer">Viewer / Auditor (Akses Lihat Data & Laporan Saja)</option>
            </select>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium rounded-lg transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Pengguna</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
