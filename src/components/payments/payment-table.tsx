"use client";

import Link from "next/link";
import { StudentPayment } from "@/types/payment";
import { CreditCard, Eye, CheckCircle2, Ban, Printer, ArrowLeft, ArrowRight } from "lucide-react";
import { RoleCode } from "@/lib/auth/types";
import { verifyStudentPaymentAction } from "@/features/payments/actions";
import { useState } from "react";

interface PaymentTableProps {
  payments: StudentPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userRole: RoleCode;
  onPageChange: (newPage: number) => void;
  onRequestVoid?: (payment: StudentPayment) => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  verified: {
    label: "Terverifikasi",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  pending_verification: {
    label: "Menunggu Verifikasi",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  rejected: {
    label: "Ditolak",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  voided: {
    label: "Dibatalkan (Void)",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

import { ConfirmModal } from "@/components/ui/confirm-modal";

export function PaymentTable({
  payments,
  total,
  page,
  limit,
  totalPages,
  userRole,
  onPageChange,
  onRequestVoid,
}: PaymentTableProps) {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<StudentPayment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "academic_admin";

  const handleConfirmVerify = async () => {
    if (!verifyingPayment) return;
    setVerifyingId(verifyingPayment.id);
    try {
      const res = await verifyStudentPaymentAction(verifyingPayment.id);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setVerifyingPayment(null);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  if (payments.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <CreditCard className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Belum Ada Transaksi Pembayaran</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Belum ada pembayaran mahasiswa yang dicatat ke dalam sistem. Silakan buat transaksi pembayaran baru.
        </p>
      </div>
    );
  }

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Mahasiswa</th>
                <th className="px-4 py-3">Tgl Bayar</th>
                <th className="px-4 py-3">Nominal Bayar</th>
                <th className="px-4 py-3">Metode & Ref</th>
                <th className="px-4 py-3">Invoice Alokasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {payments.map((p) => {
                const badge = STATUS_BADGES[p.status] || STATUS_BADGES.draft;
                const paidDateFormatted = new Date(p.paidAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const firstAlloc = p.allocations && p.allocations.length > 0 ? p.allocations[0] : null;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      <Link href={`/pembayaran/${p.id}`} className="hover:underline">
                        {p.transactionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{p.studentName || "Mahasiswa"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        NIM: {p.studentNim || "Calon"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono">
                      {paidDateFormatted}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                      Rp {p.amount.toLocaleString("id-ID")}
                      {p.unallocatedAmount && p.unallocatedAmount > 0 ? (
                        <div className="text-[10px] text-amber-600 font-sans font-normal">
                          Overpay: Rp {p.unallocatedAmount.toLocaleString("id-ID")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div>{p.paymentMethodName || "Metode"}</div>
                      {p.referenceNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {p.referenceNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {firstAlloc ? (
                        <div>
                          <div>{firstAlloc.invoiceNumber}</div>
                          <div className="text-[10px] text-emerald-600">
                            Rp {firstAlloc.amount.toLocaleString("id-ID")}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold border rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/pembayaran/${p.id}`}
                          className="p-1.5 rounded bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition shadow-xs"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {p.status === "verified" && (
                          <Link
                            href={`/pembayaran/${p.id}`}
                            className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                            title="Buka Kuitansi Pembayaran Resmi"
                            aria-label={`Buka kuitansi pembayaran ${p.transactionNumber}`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        {p.status === "voided" && (
                          <Link
                            href={`/pembayaran/${p.id}`}
                            className="p-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                            title="Buka Kuitansi Historis (Dibatalkan / Void)"
                            aria-label={`Buka kuitansi historis dibatalkan ${p.transactionNumber}`}
                          >
                            <Printer className="w-3.5 h-3.5 opacity-70" />
                          </Link>
                        )}
                        {canVerify && p.status === "pending_verification" && (
                          <button
                            type="button"
                            onClick={() => setVerifyingPayment(p)}
                            disabled={verifyingId === p.id}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                            title="Verifikasi Pembayaran"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi</span>
                          </button>
                        )}
                        {canVerify && p.status === "verified" && onRequestVoid && (
                          <button
                            type="button"
                            onClick={() => onRequestVoid(p)}
                            className="p-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                            title="Ajukan Void Pembatalan"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
            <span className="font-semibold text-slate-800">{endRecord}</span> dari{" "}
            <span className="font-semibold text-slate-800">{total}</span> pembayaran
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs text-slate-500 px-2">
                Halaman <strong className="text-slate-800">{page}</strong> dari{" "}
                <strong className="text-slate-800">{totalPages}</strong>
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <span>Berikutnya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Verification Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(verifyingPayment)}
        variant="warning"
        title="Verifikasi Transaksi Pembayaran"
        description={`Apakah Anda yakin ingin memverifikasi transaksi pembayaran ${verifyingPayment?.transactionNumber} sebesar Rp ${verifyingPayment?.amount.toLocaleString("id-ID")}?`}
        confirmText="Ya, Verifikasi"
        cancelText="Batal"
        isLoading={Boolean(verifyingId)}
        onConfirm={handleConfirmVerify}
        onClose={() => setVerifyingPayment(null)}
      />

      {/* Error Message Modal */}
      <ConfirmModal
        isOpen={Boolean(errorMessage)}
        variant="danger"
        title="Terjadi Kesalahan"
        description={errorMessage || ""}
        confirmText="Tutup"
        cancelText=""
        onConfirm={() => setErrorMessage(null)}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
