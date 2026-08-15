"use client";

import { useState } from "react";
import { UtRemittance } from "@/types/ut-remittance";
import { requestUtRemittanceVoidAction, reviewUtRemittanceVoidAction } from "@/features/ut-remittances/actions";
import { RoleCode } from "@/lib/auth/types";
import { X, Ban, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface UtRemittanceVoidDialogProps {
  remittance: UtRemittance;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: RoleCode;
}

export function UtRemittanceVoidDialog({
  remittance,
  isOpen,
  onClose,
  onSuccess,
  userRole,
}: UtRemittanceVoidDialogProps) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isOwner = userRole === "owner";
  const hasPendingVoidReq = remittance.voidRequest && remittance.voidRequest.status === "pending";

  const handleRequestVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Alasan pengajuan void pembatalan wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestUtRemittanceVoidAction({
        remittanceId: remittance.id,
        reason: reason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengajukan void pembatalan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewVoid = async (action: "approve" | "reject") => {
    if (!remittance.voidRequest) return;
    setErrorMsg(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Catatan review persetujuan/penolakan wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await reviewUtRemittanceVoidAction({
        voidRequestId: remittance.voidRequest.id,
        action,
        reviewNotes: reason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses persetujuan void.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {hasPendingVoidReq && isOwner ? "Persetujuan Void Setoran UT (Owner)" : "Pengajuan Void Pembatalan Setoran UT"}
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

        <div className="p-6 space-y-4">
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Transaksi Setoran UT</span>
            <p className="font-mono font-bold text-blue-600">{remittance.remittanceNumber}</p>
            <p className="font-mono font-bold text-emerald-600">
              Rp {remittance.amount.toLocaleString("id-ID")}
            </p>
          </div>

          {hasPendingVoidReq && (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-purple-800 space-y-1">
              <span className="font-bold block">Alasan Pengajuan Void Petugas:</span>
              <p className="italic">&ldquo;{remittance.voidRequest?.reason}&rdquo;</p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              {hasPendingVoidReq && isOwner ? "Catatan Review Owner *" : "Alasan Pengajuan Void Pembatalan *"}
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan pembatalan setoran UT..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {hasPendingVoidReq && isOwner ? (
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReviewVoid("reject")}
                className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 bg-red-50 rounded-lg border border-red-200 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Tolak Void</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReviewVoid("approve")}
                className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Setujui Void (Batal)</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleRequestVoid} className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-300 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan Void"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
