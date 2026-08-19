"use client";

import { useState } from "react";
import { OperationalTransaction } from "@/types/operational";
import { OperationalVoidDialog } from "@/components/operational/operational-void-dialog";
import { verifyOperationalTransactionAction, rejectOperationalTransactionAction } from "@/features/operational/actions";
import { RoleCode } from "@/lib/auth/types";
import Link from "next/link";
import { ArrowLeft, Wallet, CheckCircle2, Ban, ExternalLink, ShieldAlert, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "@/components/ui/confirm-modal";

interface OperationalDetailViewProps {
  transaction: OperationalTransaction;
  userRole: RoleCode;
}

export function OperationalDetailView({
  transaction,
  userRole,
}: OperationalDetailViewProps) {
  const router = useRouter();

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "finance_admin";
  const isOwner = userRole === "owner";
  const isIncome = transaction.transactionType === "income";

  const formattedTxnDate = new Date(transaction.transactionDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleConfirmVerify = async () => {
    setIsSubmitting(true);
    try {
      const res = await verifyOperationalTransactionAction(transaction.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setShowVerifyModal(false);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      setErrorMsg("Alasan penolakan minimal 3 karakter.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await rejectOperationalTransactionAction({
        transactionId: transaction.id,
        reason: rejectReason.trim(),
      });
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setShowRejectForm(false);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/kas-operasional"
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Kas & Operasional</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-blue-600 tracking-tight">
                {transaction.transactionNumber}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  isIncome
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                <span>{isIncome ? "Pemasukan Operasional" : "Pengeluaran Operasional"}</span>
              </span>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  transaction.status === "verified"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : transaction.status === "rejected"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : transaction.status === "voided"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {transaction.status === "verified"
                  ? "Terverifikasi"
                  : transaction.status === "rejected"
                  ? "Ditolak"
                  : transaction.status === "voided"
                  ? "Dibatalkan (Void)"
                  : "Menunggu Verifikasi"}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Deskripsi: <strong className="text-slate-900">{transaction.description}</strong> — Nominal:{" "}
              <strong className={isIncome ? "text-emerald-600 font-mono" : "text-amber-600 font-mono"}>
                Rp {transaction.amount.toLocaleString("id-ID")}
              </strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canVerify && transaction.status === "pending_verification" && (
            <>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 font-semibold transition"
              >
                Tolak
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyModal(true)}
                disabled={isSubmitting}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verifikasi Transaksi</span>
              </button>
            </>
          )}

          {canVerify && transaction.status === "verified" && (
            <button
              type="button"
              onClick={() => setIsVoidDialogOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold rounded-lg transition"
            >
              <Ban className="w-4 h-4" />
              <span>{isOwner && transaction.voidRequest ? "Review Void Request" : "Ajukan Void"}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rejection Form Modal */}
      {showRejectForm && (
        <form onSubmit={handleReject} className="bg-white border border-red-200 p-4 rounded-xl space-y-3 shadow-sm">
          <h3 className="font-bold text-red-700 uppercase tracking-wider text-xs">Penolakan Verifikasi Transaksi Operasional</h3>
          <textarea
            required
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan verifikasi transaksi operasional..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 shadow-xs"
            >
              Konfirmasi Penolakan
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Rincian Details */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
              Rincian Transaksi
            </h2>
            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block text-[11px]">Kategori</span>
                <span className="font-semibold text-slate-900">{transaction.categoryName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nominal</span>
                <span className={`font-mono font-bold text-sm ${isIncome ? "text-emerald-600" : "text-amber-600"}`}>
                  Rp {transaction.amount.toLocaleString("id-ID")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Tanggal Transaksi</span>
                <span className="font-mono text-slate-800">{formattedTxnDate}</span>
              </div>
              {transaction.cashAccountName && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Sumber Rekening Kas</span>
                  <span className="text-slate-800">{transaction.cashAccountName}</span>
                </div>
              )}
              {transaction.referenceNumber && (
                <div>
                  <span className="text-slate-500 block text-[11px]">No. Referensi Bank / Struk</span>
                  <span className="font-mono text-slate-800">{transaction.referenceNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Left Column (Main Info) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reject Form */}
          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">Form Penolakan Transaksi</h3>
              <form onSubmit={handleReject} className="space-y-3">
                <textarea
                  rows={2}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Alasan penolakan..."
                  className="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white border border-slate-300 rounded-lg transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition"
                  >
                    Konfirmasi Tolak
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Void Request Alert */}
          {transaction.voidRequest && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>Pengajuan Pembatalan (Void) Aktif</span>
              </div>
              <p className="text-xs text-purple-800">Alasan: {transaction.voidRequest.reason}</p>
            </div>
          )}

          {/* Overview Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
              Rincian Informasi Transaksi
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Kategori</span>
                <span className="font-semibold text-slate-900">{transaction.categoryName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Akun Kas</span>
                <span className="font-semibold text-slate-900">{transaction.cashAccountName || "Kas Operasional"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Nomor Referensi</span>
                <span className="font-mono font-semibold text-slate-900">{transaction.referenceNumber || "-"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Dibuat Oleh</span>
                <span className="font-medium text-slate-900">{transaction.createdBy || "-"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tanggal Dibuat</span>
                <span className="font-medium text-slate-900">{formattedTxnDate}</span>
              </div>
              {transaction.verifiedBy && (
                <div>
                  <span className="text-slate-500 block">Diverifikasi Oleh</span>
                  <span className="font-medium text-slate-900">{transaction.verifiedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Notes */}
          {transaction.notes && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-sm">
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
                Catatan Transaksi
              </h2>
              <p className="text-slate-800 leading-relaxed">{transaction.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column: Proof */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
              Berkas Bukti
            </h2>
            {transaction.signedProofUrl ? (
              <a
                href={transaction.signedProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Lihat Berkas ({transaction.originalFileName || "File"})</span>
              </a>
            ) : (
              <p className="text-slate-500 italic">Tidak ada lampiran.</p>
            )}
          </div>
        </div>
      </div>

      {/* Void Dialog */}
      {isVoidDialogOpen && (
        <OperationalVoidDialog
          transaction={transaction}
          isOpen={isVoidDialogOpen}
          onClose={() => setIsVoidDialogOpen(false)}
          onSuccess={() => router.refresh()}
          userRole={userRole}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showVerifyModal}
        variant="warning"
        title="Verifikasi Transaksi Operasional"
        description={`Apakah Anda yakin ingin memverifikasi transaksi operasional ${transaction.transactionNumber}?`}
        confirmText="Ya, Verifikasi"
        cancelText="Batal"
        isLoading={isSubmitting}
        onConfirm={handleConfirmVerify}
        onClose={() => setShowVerifyModal(false)}
      />
    </div>
  );
}
