"use client";

import { useState } from "react";
import { Student, MasterOption } from "@/types/student";
import { changeStudentStatusAction } from "@/features/students/actions";
import { X, RefreshCw, AlertCircle } from "lucide-react";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface StatusChangeDialogProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  statuses: MasterOption[];
}

export function StatusChangeDialog({
  student,
  isOpen,
  onClose,
  onSuccess,
  statuses,
}: StatusChangeDialogProps) {
  const [newStatusId, setNewStatusId] = useState(student.statusId);
  const [effectiveAt, setEffectiveAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newStatusId === student.statusId) {
      setErrorMsg("Pilih status baru yang berbeda dari status saat ini.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Alasan perubahan status wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await changeStudentStatusAction({
        studentId: student.id,
        newStatusId,
        effectiveAt: new Date(effectiveAt).toISOString(),
        reason: reason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengubah status mahasiswa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Ubah Status Mahasiswa
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 mb-1 font-medium">
              Nama Mahasiswa
            </label>
            <p className="font-semibold text-slate-900">{student.fullName}</p>
            <p className="text-[11px] text-slate-500 font-mono">
              NIM: {student.nim || "Calon Mahasiswa"}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Status Saat Ini
            </label>
            <span className="inline-block px-2.5 py-1 text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-800 rounded-md">
              {student.statusName || student.statusCode}
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Status Baru <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={newStatusId}
              onChange={(e) => setNewStatusId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <DatePickerId
            label="Tanggal Efektif Status Baru"
            value={effectiveAt}
            onChange={(iso) => setEffectiveAt(iso)}
          />

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Alasan Perubahan Status <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Pengajuan cuti akademik disetujui untuk semester Ganjil..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition border border-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {isSubmitting ? "Menyimpan..." : "Update Status & Catat History"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
