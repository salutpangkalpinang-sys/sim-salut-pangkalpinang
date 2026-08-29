"use client";

import { useState } from "react";
import { StudentPayment, PaymentReceiptData } from "@/types/payment";
import { PaymentReceipt } from "@/components/payments/payment-receipt";
import { VoidRequestDialog } from "@/components/payments/void-request-dialog";
import { verifyStudentPaymentAction, rejectStudentPaymentAction } from "@/features/payments/actions";
import { RoleCode } from "@/lib/auth/types";
import Link from "next/link";
import { ArrowLeft, CreditCard, CheckCircle2, Ban, ExternalLink, ShieldAlert, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface PaymentDetailViewProps {
  payment: StudentPayment;
  receiptData: PaymentReceiptData | null;
  userRole: RoleCode;
}

export function PaymentDetailView({
  payment,
  receiptData,
  userRole,
}: PaymentDetailViewProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"detail" | "receipt">("detail");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "finance_admin";
  const isOwner = userRole === "owner";

  const formattedPaidAt = new Date(payment.paidAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleConfirmVerify = async () => {
    setIsSubmitting(true);
    try {
      const res = await verifyStudentPaymentAction(payment.id);
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
      const res = await rejectStudentPaymentAction({
        paymentId: payment.id,
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
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/pembayaran"
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Pembayaran</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
            <CreditCard className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-emerald-600 tracking-tight">
                {payment.transactionNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  payment.status === "verified"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : payment.status === "rejected"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : payment.status === "voided"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {payment.status === "verified"
                  ? "Terverifikasi"
                  : payment.status === "rejected"
                  ? "Ditolak"
                  : payment.status === "voided"
                  ? "Dibatalkan (Void)"
                  : "Menunggu Verifikasi"}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {payment.studentName} ({payment.studentNim || "Calon Mahasiswa"}) — Nominal: <strong className="text-emerald-600 font-mono">Rp {payment.amount.toLocaleString("id-ID")}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canVerify && payment.status === "pending_verification" && (
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
                <span>Verifikasi</span>
              </button>
            </>
          )}

          {canVerify && payment.status === "verified" && (
            <button
              type="button"
              onClick={() => setIsVoidDialogOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold rounded-lg transition"
            >
              <Ban className="w-4 h-4" />
              <span>{isOwner && payment.voidRequest ? "Review Void Request" : "Ajukan Void"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 font-semibold print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("detail")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "detail"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Detail Transaksi & Alokasi</span>
        </button>

        {receiptData && (
          <button
            type="button"
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
              activeTab === "receipt"
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Kuitansi Resmi</span>
          </button>
        )}
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
          <h3 className="font-bold text-red-700 uppercase tracking-wider text-xs">Penolakan Verifikasi Pembayaran</h3>
          <textarea
            required
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan verifikasi pembayaran..."
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

      {activeTab === "receipt" && receiptData ? (
        <PaymentReceipt receiptData={receiptData} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          {/* Left Column: Transaction Details */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
                Rincian Transaksi
              </h2>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 block text-[11px]">Mahasiswa</span>
                  <Link href={`/mahasiswa/${payment.studentId}`} className="font-bold text-slate-900 hover:text-blue-600 transition">
                    {payment.studentName}
                  </Link>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Nominal Pembayaran</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    Rp {payment.amount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Tanggal Bayar</span>
                  <span className="font-mono text-slate-800">{formattedPaidAt}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Metode Pembayaran</span>
                  <span className="text-slate-800">{payment.paymentMethodName}</span>
                </div>
                {payment.referenceNumber && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">No. Referensi / Bank</span>
                    <span className="font-mono text-slate-800">{payment.referenceNumber}</span>
                  </div>
                )}
                {payment.cashAccountName && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">Rekening Kas Penerima</span>
                    <span className="text-slate-800">{payment.cashAccountName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Proof Viewer Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
                Berkas Bukti Pembayaran
              </h2>
              {payment.signedProofUrl ? (
                <div className="space-y-2">
                  <a
                    href={payment.signedProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka Berkas Bukti ({payment.originalFileName || "File"})</span>
                  </a>
                </div>
              ) : (
                <p className="text-slate-500 italic">Tidak ada berkas bukti bayar yang dilampirkan.</p>
              )}
            </div>
          </div>

          {/* Right Column: Allocation Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
                Alokasi Pembayaran ke Invoice
              </h2>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">No. Invoice Tagihan</th>
                      <th className="px-4 py-3 text-right">Alokasi Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {(payment.allocations || []).map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">
                          {alloc.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-right">
                          Rp {alloc.amount.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Priority Component Breakdown Banner */}
              {receiptData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Rincian Prioritas Alokasi Komponen Tagihan
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Priority 1: Service Fee */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>1. Jasa Layanan SALUT (Prioritas Utuh)</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                          (receiptData.serviceFeeRemaining || 0) <= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : (receiptData.serviceFeePaid || 0) > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {(receiptData.serviceFeeRemaining || 0) <= 0
                            ? "Lunas"
                            : (receiptData.serviceFeePaid || 0) > 0
                            ? "Terbayar Sebagian"
                            : "Belum Dibayar"}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        Rp {(receiptData.serviceFeePaid || 0).toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 font-normal text-xs">
                          / Rp {(receiptData.serviceFeeTotal || 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {/* Priority 2: UT Liability */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>2. Iuran / Biaya UT (Setoran UT)</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                          (receiptData.utLiabilityRemaining || 0) <= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : (receiptData.utLiabilityPaid || 0) > 0
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {(receiptData.utLiabilityRemaining || 0) <= 0
                            ? "Lunas"
                            : (receiptData.utLiabilityPaid || 0) > 0
                            ? "Terbayar Sebagian"
                            : "Belum Dibayar"}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        Rp {(receiptData.utLiabilityPaid || 0).toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 font-normal text-xs">
                          / Rp {(receiptData.utLiabilityTotal || 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Overpayment Summary Banner */}
              {payment.unallocatedAmount && payment.unallocatedAmount > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1 shadow-xs">
                  <strong className="block font-bold">Kelebihan Pembayaran (Overpayment):</strong>
                  <p>
                    Nominal Rp {payment.unallocatedAmount.toLocaleString("id-ID")} belum dialokasikan ke tagihan manapun dan tetap tercatat utuh sebagai saldo deposit/kredit mahasiswa.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Void Dialog */}
      {isVoidDialogOpen && (
        <VoidRequestDialog
          payment={payment}
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
        title="Verifikasi Transaksi Pembayaran"
        description={`Apakah Anda yakin ingin memverifikasi transaksi pembayaran ${payment.transactionNumber} dari mahasiswa ${payment.studentName} sebesar Rp ${payment.amount.toLocaleString("id-ID")}?`}
        confirmText="Ya, Verifikasi"
        cancelText="Batal"
        isLoading={isSubmitting}
        onConfirm={handleConfirmVerify}
        onClose={() => setShowVerifyModal(false)}
      />
    </div>
  );
}
