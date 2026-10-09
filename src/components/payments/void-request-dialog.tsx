"use client";

import { useState } from "react";
import { StudentPayment } from "@/types/payment";
import { requestPaymentVoidAction, reviewPaymentVoidAction } from "@/features/payments/actions";
import { RoleCode } from "@/lib/auth/types";
import { X, Ban, AlertCircle, CheckCircle2, XCircle, Clock, User, FileText, ShieldAlert } from "lucide-react";

interface VoidRequestDialogProps {
  payment: StudentPayment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  userRole: RoleCode;
  currentUserId?: string;
}

export function VoidRequestDialog({
  payment,
  isOpen,
  onClose,
  onSuccess,
  userRole,
  currentUserId,
}: VoidRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const voidReq = payment.voidRequest;
  const hasPendingVoidReq = Boolean(voidReq && voidReq.status === "pending");
  const isSelfRequester = Boolean(currentUserId && voidReq?.requestedBy === currentUserId);
  const canReview = isOwnerOrAdmin && !isSelfRequester && hasPendingVoidReq;

  // Format request date if exists
  const formattedRequestedAt = voidReq?.requestedAt
    ? new Date(voidReq.requestedAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const handleRequestVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Alasan pengajuan void pembatalan wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPaymentVoidAction({
        paymentId: payment.id,
        reason: reason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const msg = "Pengajuan void pembatalan transaksi berhasil dikirim dan menunggu pemeriksaan.";
        setSuccessMsg(msg);
        setTimeout(() => {
          onSuccess(msg);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengajukan void pembatalan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewVoid = async (action: "approve" | "reject") => {
    if (!voidReq) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!reviewNotes.trim() || reviewNotes.trim().length < 3) {
      setErrorMsg(
        action === "approve"
          ? "Catatan review persetujuan wajib diisi (minimal 3 karakter)."
          : "Catatan alasan penolakan void wajib diisi (minimal 3 karakter)."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await reviewPaymentVoidAction({
        voidRequestId: voidReq.id,
        action,
        reviewNotes: reviewNotes.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        const msg =
          action === "approve"
            ? "Pengajuan void disetujui. Transaksi pembayaran telah dibatalkan."
            : "Pengajuan void telah ditolak.";
        setSuccessMsg(msg);
        setTimeout(() => {
          onSuccess(msg);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses review void.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden text-xs text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {hasPendingVoidReq
                ? canReview
                  ? "Review Void Pembayaran (Pemeriksa)"
                  : "Detail Pengajuan Void (Menunggu Pemeriksaan)"
                : "Pengajuan Void Pembatalan Transaksi"}
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

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            data-testid="dialog-success-message"
            className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 font-medium"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Payment Summary Info */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Ringkasan Transaksi Pembayaran
            </span>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-blue-600 text-sm">{payment.transactionNumber}</p>
                <p className="font-medium text-slate-800">{payment.studentName} {payment.studentNim ? `(${payment.studentNim})` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-emerald-600 text-sm">
                  Rp {payment.amount.toLocaleString("id-ID")}
                </p>
                <p className="text-[11px] text-slate-500">{payment.paymentMethodName}</p>
              </div>
            </div>
          </div>

          {/* Pending Void Request Details (View or Review mode) */}
          {hasPendingVoidReq && voidReq && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-700" />
                  Rincian Pengajuan Void Aktif
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-200 text-purple-900">
                  Menunggu Pemeriksaan
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-purple-900">
                  <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <div>
                    <span className="text-purple-600/90 block text-[10px]">Pengaju:</span>
                    <strong className="font-semibold">{voidReq.requestedByName || "Staff / Kasir"}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-purple-900">
                  <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <div>
                    <span className="text-purple-600/90 block text-[10px]">Waktu Pengajuan:</span>
                    <span className="font-medium">{formattedRequestedAt}</span>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[10px] text-purple-700 block font-medium">Alasan Pengajuan Void:</span>
                <p className="text-purple-950 bg-white/70 border border-purple-200 rounded p-2 italic mt-0.5 leading-relaxed">
                  &ldquo;{voidReq.reason}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Maker-Checker Warning when Requester Views */}
          {hasPendingVoidReq && isSelfRequester && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2 shadow-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="block font-semibold">Prinsip Maker-Checker:</strong>
                Anda adalah pemohon pengajuan void ini. Pengajuan Anda sedang menunggu pemeriksaan oleh Owner atau Admin lain. Anda tidak dapat menyetujui void yang Anda ajukan sendiri ataupun mengajukan ulang sebelum ada keputusan.
              </div>
            </div>
          )}

          {/* Form Content Depending on Mode */}
          {hasPendingVoidReq ? (
            canReview ? (
              /* Reviewer Form */
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Catatan Hasil Pemeriksaan (Owner / Admin) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Masukkan catatan pertimbangan persetujuan atau alasan penolakan void..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting || Boolean(successMsg)}
                    onClick={() => handleReviewVoid("reject")}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 bg-red-50 rounded-lg border border-red-200 disabled:opacity-50 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak Void</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || Boolean(successMsg)}
                    onClick={() => handleReviewVoid("approve")}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui Void</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Read-Only View Mode for Requester or Other Non-Reviewer */
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-white border border-slate-300 rounded-lg transition"
                >
                  Tutup
                </button>
              </div>
            )
          ) : (
            /* New Void Request Form (Only when no pending void exists) */
            <form onSubmit={handleRequestVoid} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Alasan Pengajuan Void Pembatalan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan detail mengapa transaksi pembayaran ini perlu dibatalkan (salah rekening, nominal keliru, dsb)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-300 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || Boolean(successMsg)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan Void"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
