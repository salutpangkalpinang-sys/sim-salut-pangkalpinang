"use client";

import { useState } from "react";
import { Student } from "@/types/student";
import { deleteStudentAction } from "@/features/students/actions";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteStudentDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteStudentDialog({
  student,
  isOpen,
  onClose,
  onSuccess,
}: DeleteStudentDialogProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleDelete = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await deleteStudentAction(student.id);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem saat menghapus mahasiswa.";
      setErrorMsg(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900 p-6 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>

          <div className="space-y-1.5 pr-4">
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              Konfirmasi Hapus Mahasiswa
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data mahasiswa ini secara permanen dari sistem?
            </p>
          </div>
        </div>

        {/* Detail Ringkasan Target */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 text-[11px]">Nama Lengkap</span>
            <span className="font-bold text-slate-900">{student.fullName}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 text-[11px]">NIM</span>
            <span className="font-mono font-semibold text-slate-800">
              {student.nim || <span className="text-slate-400 italic">Calon Mahasiswa</span>}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 text-[11px]">Program Studi</span>
            <span className="text-slate-700">{student.studyProgramName || "-"}</span>
          </div>
        </div>

        {/* Warning Callout */}
        <p className="mt-3 text-[11px] text-amber-700 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/60 leading-relaxed">
          Tindakan ini akan menghapus registrasi semester dan snapshot biaya terkait secara kaskade, serta mencatat entri pada log audit. Tindakan ini tidak dapat dibatalkan.
        </p>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Permanen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
