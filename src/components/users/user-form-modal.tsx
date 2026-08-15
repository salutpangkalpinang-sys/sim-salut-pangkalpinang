"use client";

import { useActionState, useEffect } from "react";
import { createUserAction } from "@/features/users/actions";
import { UserPlus, X, ShieldAlert, CheckCircle2 } from "lucide-react";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function UserFormModal({ isOpen, onClose, onSuccess }: UserFormModalProps) {
  const [state, formAction, isPending] = useActionState(createUserAction, null);

  useEffect(() => {
    if (state?.success && state.message) {
      onSuccess(state.message);
      onClose();
    }
  }, [state, onSuccess, onClose]);

  if (!isOpen) return null;

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
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {state?.error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Form */}
        <form action={formAction} className="p-5 space-y-4 text-xs">
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
              placeholder="Contoh: ahmad (atau ahmad@salut-pangkalpinang.ac.id)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Jika memasukkan username tanpa @, sistem akan otomatis menggunakan domain <code>@salut-pangkalpinang.ac.id</code>.
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
              defaultValue="academic_admin"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="academic_admin">Admin Akademik (Kelola Mahasiswa, Registrasi & LIP)</option>
              <option value="finance_admin">Admin Keuangan / Kasir (Kelola Bayar, UT & Kas)</option>
              <option value="viewer">Viewer / Auditor (Akses Lihat Data & Laporan Saja)</option>
              <option value="owner">Owner / Pimpinan (Akses Penuh & Approval)</option>
            </select>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isPending ? (
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
