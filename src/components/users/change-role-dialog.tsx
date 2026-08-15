"use client";

import { useActionState, useEffect, useState } from "react";
import { changeUserRoleAction } from "@/features/users/actions";
import { UserItem } from "@/types/user";
import { RoleCode } from "@/lib/auth/types";
import { ShieldCheck, X, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";

interface ChangeRoleDialogProps {
  user: UserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const ROLE_LABELS: Record<RoleCode, string> = {
  owner: "Owner / Pimpinan",
  academic_admin: "Admin Akademik",
  finance_admin: "Admin Keuangan / Kasir",
  viewer: "Viewer / Auditor",
};

export function ChangeRoleDialog({
  user,
  isOpen,
  onClose,
  onSuccess,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<RoleCode>("academic_admin");
  const [state, formAction, isPending] = useActionState(changeUserRoleAction, null);

  useEffect(() => {
    if (user) {
      // Default new role selection to a different role if currently owner
      setSelectedRole(user.role === "owner" ? "academic_admin" : "owner");
    }
  }, [user]);

  useEffect(() => {
    if (state?.success && state.message) {
      onSuccess(state.message);
      onClose();
    }
  }, [state, onSuccess, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Ubah Peran Hak Akses (Role)</span>
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

        {/* User Card & Role Selection Form */}
        <form action={formAction} className="p-5 space-y-4 text-xs">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="newRole" value={selectedRole} />

          {/* Targeted User Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Pengguna Terpilih</span>
            <div className="font-bold text-slate-900 text-sm">{user.fullName}</div>
            <div className="text-slate-500 font-mono text-[11px]">{user.email}</div>
          </div>

          {/* Role Comparison Visual Banner */}
          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] text-purple-600 font-mono block">Role Saat Ini</span>
              <span className="font-bold text-slate-800">{ROLE_LABELS[user.role]}</span>
            </div>

            <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />

            <div className="space-y-0.5 text-right">
              <span className="text-[10px] text-purple-600 font-mono block">Role Baru Baru</span>
              <span className="font-bold text-purple-700">{ROLE_LABELS[selectedRole]}</span>
            </div>
          </div>

          {/* Role Selection Dropdown */}
          <div>
            <label htmlFor="selectRole" className="block font-semibold text-slate-700 mb-1">
              Pilih Role Baru Pengguna <span className="text-red-500">*</span>
            </label>
            <select
              id="selectRole"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleCode)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition font-medium"
            >
              <option value="owner">Owner / Pimpinan (Akses Penuh & Approval)</option>
              <option value="academic_admin">Admin Akademik (Kelola Mahasiswa & Registrasi)</option>
              <option value="finance_admin">Admin Keuangan / Kasir (Kelola Bayar & Kas)</option>
              <option value="viewer">Viewer / Auditor (Akses Lihat Saja)</option>
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
              disabled={isPending || user.role === selectedRole}
              className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 font-semibold rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Perubahan Role</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
