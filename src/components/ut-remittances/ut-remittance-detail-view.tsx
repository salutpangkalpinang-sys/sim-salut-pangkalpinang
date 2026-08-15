"use client";

import { useState } from "react";
import { UtRemittance } from "@/types/ut-remittance";
import { UtRemittanceVoidDialog } from "@/components/ut-remittances/ut-remittance-void-dialog";
import { verifyUtRemittanceAction, rejectUtRemittanceAction } from "@/features/ut-remittances/actions";
import { RoleCode } from "@/lib/auth/types";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, Ban, ExternalLink, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

interface UtRemittanceDetailViewProps {
  remittance: UtRemittance;
  userRole: RoleCode;
}

export function UtRemittanceDetailView({
  remittance,
  userRole,
}: UtRemittanceDetailViewProps) {
  const router = useRouter();

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canVerify = userRole === "owner" || userRole === "finance_admin";
  const isOwner = userRole === "owner";

  const formattedPaidAt = new Date(remittance.paidAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleVerify = async () => {
    if (!confirm(`Verifikasi Setoran UT ${remittance.remittanceNumber}?`)) return;
    setIsSubmitting(true);
    try {
      const res = await verifyUtRemittanceAction(remittance.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
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
      const res = await rejectUtRemittanceAction({
        remittanceId: remittance.id,
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
          href="/setoran-ut"
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Setoran UT</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-blue-600 tracking-tight">
                {remittance.remittanceNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  remittance.status === "verified"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : remittance.status === "rejected"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : remittance.status === "voided"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {remittance.status === "verified"
                  ? "Terverifikasi"
                  : remittance.status === "rejected"
                  ? "Ditolak"
                  : remittance.status === "voided"
                  ? "Dibatalkan (Void)"
                  : "Menunggu Verifikasi"}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Total Setoran UT: <strong className="text-emerald-600 font-mono">Rp {remittance.amount.toLocaleString("id-ID")}</strong> — Tgl: {formattedPaidAt}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canVerify && remittance.status === "pending_verification" && (
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
                onClick={handleVerify}
                disabled={isSubmitting}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verifikasi Setoran</span>
              </button>
            </>
          )}

          {canVerify && remittance.status === "verified" && (
            <button
              type="button"
              onClick={() => setIsVoidDialogOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold rounded-lg transition"
            >
              <Ban className="w-4 h-4" />
              <span>{isOwner && remittance.voidRequest ? "Review Void Request" : "Ajukan Void"}</span>
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
          <h3 className="font-bold text-red-700 uppercase tracking-wider text-xs">Penolakan Verifikasi Setoran UT</h3>
          <textarea
            required
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan verifikasi setoran UT..."
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
        {/* Left Column: Details & Proof */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
              Rincian Setoran UT
            </h2>
            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block text-[11px]">Total Setoran</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  Rp {remittance.amount.toLocaleString("id-ID")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Tanggal Setor</span>
                <span className="font-mono text-slate-800">{formattedPaidAt}</span>
              </div>
              {remittance.cashAccountName && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Sumber Rekening Kas</span>
                  <span className="text-slate-800">{remittance.cashAccountName}</span>
                </div>
              )}
              {remittance.referenceNumber && (
                <div>
                  <span className="text-slate-500 block text-[11px]">No. Referensi Bank</span>
                  <span className="font-mono text-slate-800">{remittance.referenceNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Proof Viewer Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
              Berkas Bukti Setoran Bank
            </h2>
            {remittance.signedProofUrl ? (
              <div className="space-y-2">
                <a
                  href={remittance.signedProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Berkas Bukti ({remittance.originalFileName || "File"})</span>
                </a>
              </div>
            ) : (
              <p className="text-slate-500 italic">Tidak ada berkas bukti setoran yang dilampirkan.</p>
            )}
          </div>
        </div>

        {/* Right Column: Allocation Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-2">
              Rincian Alokasi Setoran ke Dokumen LIP Kewajiban UT
            </h2>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">No. LIP & Mahasiswa</th>
                    <th className="px-4 py-3">No. Registrasi</th>
                    <th className="px-4 py-3">Resmi UT (LIP)</th>
                    <th className="px-4 py-3 text-right">Alokasi Setoran (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {(remittance.items || []).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-blue-600">{item.lipNumber}</div>
                        <div className="text-[11px] text-slate-900">{item.studentName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {item.registrationNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        Rp {(item.officialAmount || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-right">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Void Dialog */}
      {isVoidDialogOpen && (
        <UtRemittanceVoidDialog
          remittance={remittance}
          isOpen={isVoidDialogOpen}
          onClose={() => setIsVoidDialogOpen(false)}
          onSuccess={() => router.refresh()}
          userRole={userRole}
        />
      )}
    </div>
  );
}
