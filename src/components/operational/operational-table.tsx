"use client";

import Link from "next/link";
import { OperationalTransaction } from "@/types/operational";
import { Wallet, Eye, CheckCircle2, Ban, ArrowLeft, ArrowRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { RoleCode } from "@/lib/auth/types";
import { verifyOperationalTransactionAction } from "@/features/operational/actions";
import { useState } from "react";

interface OperationalTableProps {
  transactions: OperationalTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userRole: RoleCode;
  onPageChange: (newPage: number) => void;
  onRequestVoid?: (transaction: OperationalTransaction) => void;
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

export function OperationalTable({
  transactions,
  total,
  page,
  limit,
  totalPages,
  userRole,
  onPageChange,
  onRequestVoid,
}: OperationalTableProps) {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingTx, setVerifyingTx] = useState<OperationalTransaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "finance_admin";

  const handleConfirmVerify = async () => {
    if (!verifyingTx) return;
    setVerifyingId(verifyingTx.id);
    try {
      const res = await verifyOperationalTransactionAction(verifyingTx.id);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setVerifyingTx(null);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <Wallet className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Belum Ada Transaksi Operasional</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Belum ada transaksi pemasukan atau pengeluaran kas operasional yang dicatat ke dalam sistem.
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
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Kategori & Deskripsi</th>
                <th className="px-4 py-3">Sumber Kas & Ref</th>
                <th className="px-4 py-3">Nominal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {transactions.map((txn) => {
                const badge = STATUS_BADGES[txn.status] || STATUS_BADGES.draft;
                const txnDateFormatted = new Date(txn.transactionDate).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const isIncome = txn.transactionType === "income";

                return (
                  <tr key={txn.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      <Link href={`/kas-operasional/${txn.id}`} className="hover:underline">
                        {txn.transactionNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono">
                      {txnDateFormatted}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold border rounded-full ${
                          isIncome
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isIncome ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Pemasukan</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Pengeluaran</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{txn.categoryName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{txn.description}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{txn.cashAccountName || "Kas Operasional"}</div>
                      {txn.referenceNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {txn.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={isIncome ? "text-emerald-600" : "text-amber-600"}>
                        {isIncome ? "+" : "-"} Rp {txn.amount.toLocaleString("id-ID")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold border rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/kas-operasional/${txn.id}`}
                          className="p-1.5 rounded bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition shadow-xs"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {canVerify && txn.status === "pending_verification" && (
                          <button
                            type="button"
                            onClick={() => setVerifyingTx(txn)}
                            disabled={verifyingId === txn.id}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                            title="Verifikasi Transaksi"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi</span>
                          </button>
                        )}
                        {canVerify && txn.status === "verified" && onRequestVoid && (
                          <button
                            type="button"
                            onClick={() => onRequestVoid(txn)}
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
            <span className="font-semibold text-slate-800">{total}</span> transaksi
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
        isOpen={Boolean(verifyingTx)}
        variant="warning"
        title="Verifikasi Transaksi Operasional"
        description={`Apakah Anda yakin ingin memverifikasi transaksi operasional ${verifyingTx?.transactionNumber} (${verifyingTx?.transactionType === "income" ? "Pemasukan" : "Pengeluaran"}) sebesar Rp ${verifyingTx?.amount.toLocaleString("id-ID")}?`}
        confirmText="Ya, Verifikasi"
        cancelText="Batal"
        isLoading={Boolean(verifyingId)}
        onConfirm={handleConfirmVerify}
        onClose={() => setVerifyingTx(null)}
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
