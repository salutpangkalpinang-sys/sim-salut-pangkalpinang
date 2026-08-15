"use client";

import { useState } from "react";
import { Registration } from "@/types/registration";
import { cancelRegistrationAction } from "@/features/registrations/actions";
import { X, Ban, AlertCircle } from "lucide-react";

interface CancelRegistrationDialogProps {
  registration: Registration;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelRegistrationDialog({
  registration,
  isOpen,
  onClose,
  onSuccess,
}: CancelRegistrationDialogProps) {
  const [cancellationReason, setCancellationReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cancellationReason.trim() || cancellationReason.trim().length < 3) {
      setErrorMsg("Alasan pembatalan registrasi wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await cancelRegistrationAction({
        registrationId: registration.id,
        cancellationReason: cancellationReason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membatalkan registrasi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Konfirmasi Pembatalan Registrasi
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 block">No. Registrasi</span>
            <p className="font-mono font-bold text-blue-600">{registration.registrationNumber}</p>
            <p className="font-medium text-slate-900">{registration.studentName}</p>
            <p className="text-[11px] text-slate-500">{registration.academicPeriodName}</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg leading-relaxed">
            <strong>Catatan Keamanan:</strong> Pembatalan registrasi tidak akan menghapus data histori atau snapshot tarif. Status registrasi akan diubah menjadi &ldquo;Dibatalkan&rdquo;.
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Alasan Pembatalan Registrasi <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Contoh: Pengajuan pembatalan semester oleh mahasiswa atau salah memilih skema..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-300 rounded-lg transition"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {isSubmitting ? "Membatalkan..." : "Konfirmasi Pembatalan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
