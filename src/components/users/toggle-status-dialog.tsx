"use client";

import { useActionState, useEffect } from "react";
import { toggleUserStatusAction } from "@/features/users/actions";
import { UserItem } from "@/types/user";
import { UserCheck, UserX, X, ShieldAlert, CheckCircle2 } from "lucide-react";

interface ToggleStatusDialogProps {
  user: UserItem | null;
  targetIsActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ToggleStatusDialog({
  user,
  targetIsActive,
  isOpen,
  onClose,
  onSuccess,
}: ToggleStatusDialogProps) {
  const [state, formAction, isPending] = useActionState(toggleUserStatusAction, null);

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
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                targetIsActive
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}
            >
              {targetIsActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
            </div>
            <span>{targetIsActive ? "Aktifkan Akses Pengguna" : "Nonaktifkan Akses Pengguna"}</span>
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

        {/* Form Body */}
        <form action={formAction} className="p-5 space-y-4 text-xs">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="isActive" value={targetIsActive ? "true" : "false"} />

          {/* User Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Pengguna Terpilih</span>
            <div className="font-bold text-slate-900 text-sm">{user.fullName}</div>
            <div className="text-slate-500 font-mono text-[11px]">{user.email}</div>
          </div>

          {/* Confirmation Message */}
          <p className="text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin{" "}
            <strong className={targetIsActive ? "text-emerald-700" : "text-red-700"}>
              {targetIsActive ? "mengaktifkan kembali" : "menonaktifkan"}
            </strong>{" "}
            akses pengguna ini ke aplikasi SIM-SALUT Pangkalpinang?
          </p>

          {!targetIsActive && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg leading-relaxed">
              Pengguna yang dinonaktifkan tidak akan dapat login atau melakukan mutasi data. Data histori transaksi pengguna tetap aman dan tersimpan secara permanen.
            </div>
          )}

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
              className={`px-4 py-2 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5 ${
                targetIsActive
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{targetIsActive ? "Ya, Aktifkan Akses" : "Ya, Nonaktifkan Akses"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
