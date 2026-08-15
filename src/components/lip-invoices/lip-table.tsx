"use client";

import { useState } from "react";
import { LipDocument } from "@/types/lip-invoice";
import { getSignedLipUrlAction, verifyLipDocumentAction } from "@/features/lip-invoices/actions";
import { FileText, CheckCircle2, Ban, ExternalLink, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { RoleCode } from "@/lib/auth/types";

interface LipTableProps {
  lipDocuments: LipDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userRole: RoleCode;
  onPageChange: (newPage: number) => void;
  onCancel?: (lip: LipDocument) => void;
  onCreateInvoice?: (lip: LipDocument) => void;
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
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  paid_to_ut: {
    label: "Dibayar ke UT",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "bg-red-50 text-red-700 border-red-200",
  },
};

export function LipTable({
  lipDocuments,
  total,
  page,
  limit,
  totalPages,
  userRole,
  onPageChange,
  onCancel,
  onCreateInvoice,
}: LipTableProps) {
  const [loadingSignedId, setLoadingSignedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "academic_admin";

  const handleOpenSignedFile = async (lip: LipDocument) => {
    setLoadingSignedId(lip.id);
    try {
      const res = await getSignedLipUrlAction(lip.storagePath);
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank");
      } else {
        alert(res.error || "Gagal membuka berkas LIP.");
      }
    } catch (err: any) {
      alert(err.message || "Gagal membuka berkas.");
    } finally {
      setLoadingSignedId(null);
    }
  };

  const handleVerify = async (lip: LipDocument) => {
    if (!confirm(`Verifikasi Dokumen LIP ${lip.lipNumber}? Setelah diverifikasi, nilai nominal resmi tidak dapat diubah lagi.`)) {
      return;
    }
    setVerifyingId(lip.id);
    try {
      const res = await verifyLipDocumentAction(lip.id);
      if (res.error) {
        alert(res.error);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  if (lipDocuments.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Belum Ada Dokumen LIP</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Belum ada berkas fisik LIP yang diunggah ke sistem. Silakan unggah LIP untuk registrasi mahasiswa.
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
                <th className="px-4 py-3">No. LIP & Versi</th>
                <th className="px-4 py-3">Mahasiswa</th>
                <th className="px-4 py-3">No. Registrasi</th>
                <th className="px-4 py-3">Total Resmi UT</th>
                <th className="px-4 py-3">Rincian Komponen</th>
                <th className="px-4 py-3">Status LIP</th>
                <th className="px-4 py-3">Berkas Private</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {lipDocuments.map((lip) => {
                const badge = STATUS_BADGES[lip.status] || STATUS_BADGES.draft;

                return (
                  <tr key={lip.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-medium text-blue-600">
                      <div>{lip.lipNumber}</div>
                      <div className="text-[10px] text-slate-500 font-sans">Versi {lip.version}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{lip.studentName || "Mahasiswa"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        NIM: {lip.studentNim || "Calon"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {lip.registrationNumber || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                      Rp {lip.officialAmount.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] text-slate-700">
                        SPP: Rp {lip.tuitionAmount.toLocaleString("id-ID")}
                      </div>
                      {lip.hasAmountMismatch && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5" title={`Rincian Rp ${lip.componentTotalAmount?.toLocaleString("id-ID")} vs Resmi Rp ${lip.officialAmount.toLocaleString("id-ID")}`}>
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Mismatch Rp {lip.mismatchDifference?.toLocaleString("id-ID")}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold border rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleOpenSignedFile(lip)}
                        disabled={loadingSignedId === lip.id}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{loadingSignedId === lip.id ? "Memuat..." : "Buka File"}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canVerify && lip.status === "pending_verification" && (
                          <button
                            type="button"
                            onClick={() => handleVerify(lip)}
                            disabled={verifyingId === lip.id}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                            title="Verifikasi LIP"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi</span>
                          </button>
                        )}
                        {canVerify && lip.status === "verified" && onCreateInvoice && (
                          <button
                            type="button"
                            onClick={() => onCreateInvoice(lip)}
                            className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition text-[11px] font-semibold shadow-xs"
                            title="Terbitkan Tagihan Invoice"
                          >
                            + Invoice
                          </button>
                        )}
                        {canVerify && lip.status !== "cancelled" && onCancel && (
                          <button
                            type="button"
                            onClick={() => onCancel(lip)}
                            className="p-1 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition"
                            title="Batalkan LIP"
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
            <span className="font-semibold text-slate-800">{total}</span> dokumen LIP
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
    </div>
  );
}
