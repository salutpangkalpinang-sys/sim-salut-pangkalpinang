"use client";

import { useState } from "react";
import {
  CandidateNimEligibilitySummary,
  RegistrationInvoiceOption,
} from "@/types/nim-submission";
import { recordNimSubmissionAction, assignOfficialNimAction } from "@/features/students/nim-actions";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Send,
  GraduationCap,
  FileCheck2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

function formatRupiah(amount: number): string {
  return "Rp " + (amount || 0).toLocaleString("id-ID");
}

interface CandidateNimPanelProps {
  summary: CandidateNimEligibilitySummary;
  canManage: boolean;
}

export function CandidateNimPanel({ summary, canManage }: { summary: CandidateNimEligibilitySummary; canManage: boolean }) {
  const router = useRouter();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    summary.selectedOption?.invoiceId || ""
  );

  // Modal / Form state for Catat Pengajuan ke UT
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionDate, setSubmissionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [refNumber, setRefNumber] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Modal / Form state for Input NIM Resmi
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [officialNim, setOfficialNim] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Active option evaluated
  const currentOption: RegistrationInvoiceOption | undefined =
    summary.registrationOptions.find((opt) => opt.invoiceId === selectedInvoiceId) ||
    summary.selectedOption ||
    summary.registrationOptions[0];

  // Determine stage (1, 2, 3, or 4)
  // Stage 4: NIM resmi sudah dicatat
  // Stage 3: Sudah diajukan ke UT — menunggu NIM
  // Stage 2: Syarat finansial terpenuhi
  // Stage 1: Belum memenuhi syarat finansial
  let currentStage: 1 | 2 | 3 | 4 = 1;

  if (summary.hasActiveNIM) {
    currentStage = 4;
  } else if (summary.activeSubmission) {
    currentStage = 3;
  } else if (currentOption && currentOption.isEligible) {
    currentStage = 2;
  } else {
    currentStage = 1;
  }

  // Handle Action 1: Catat Pengajuan ke UT
  const handleSubmitRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOption) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const res = await recordNimSubmissionAction({
      studentId: summary.studentId,
      registrationId: currentOption.registrationId,
      invoiceId: currentOption.invoiceId,
      submissionDate,
      referenceNumber: refNumber || undefined,
      notes: submitNotes || undefined,
    });

    setIsSubmitting(false);

    if (res.error) {
      setSubmitError(res.error);
    } else {
      setIsSubmitModalOpen(false);
      router.refresh();
    }
  };

  // Handle Action 2: Input NIM Resmi
  const handleAssignNim = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNim = officialNim.trim();
    if (!cleanNim) {
      setAssignError("NIM resmi wajib diisi.");
      return;
    }

    setIsAssigning(true);
    setAssignError(null);

    const res = await assignOfficialNimAction({
      studentId: summary.studentId,
      nim: cleanNim,
      reason: assignReason || undefined,
    });

    setIsAssigning(false);

    if (res.error) {
      setAssignError(res.error);
    } else {
      setIsAssignModalOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />
            <span>Alur Pengajuan & Penerbitan NIM Resmi</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Evaluasi pemenuhan komisi SALUT per invoice dan pencatatan nomor induk mahasiswa
          </p>
        </div>

        {/* Global Error Banner */}
        {summary.queryError && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-[11px]">
            <XCircle className="w-3.5 h-3.5" />
            <span>{summary.queryError}</span>
          </div>
        )}
      </div>

      {/* Stepper Indicator */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {/* Step 1 */}
        <div
          className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition ${
            currentStage === 1
              ? "bg-amber-50/70 border-amber-300 text-amber-900"
              : currentStage > 1
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : "bg-slate-50/50 border-slate-200 text-slate-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tahap 1</span>
            {currentStage > 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : currentStage === 1 ? (
              <Clock className="w-4 h-4 text-amber-600" />
            ) : null}
          </div>
          <span className="font-semibold text-[11px]">Belum Memenuhi Finansial</span>
        </div>

        {/* Step 2 */}
        <div
          className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition ${
            currentStage === 2
              ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 ring-1 ring-emerald-300"
              : currentStage > 2
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : "bg-slate-50/50 border-slate-200 text-slate-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tahap 2</span>
            {currentStage > 2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : currentStage === 2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : null}
          </div>
          <span className="font-semibold text-[11px]">Syarat Finansial Terpenuhi</span>
        </div>

        {/* Step 3 */}
        <div
          className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition ${
            currentStage === 3
              ? "bg-blue-50/80 border-blue-300 text-blue-900 ring-1 ring-blue-300"
              : currentStage > 3
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : "bg-slate-50/50 border-slate-200 text-slate-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tahap 3</span>
            {currentStage > 3 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : currentStage === 3 ? (
              <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
            ) : null}
          </div>
          <span className="font-semibold text-[11px]">Diajukan ke UT</span>
        </div>

        {/* Step 4 */}
        <div
          className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition ${
            currentStage === 4
              ? "bg-purple-50/80 border-purple-300 text-purple-900 ring-1 ring-purple-300"
              : "bg-slate-50/50 border-slate-200 text-slate-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tahap 4</span>
            {currentStage === 4 && <GraduationCap className="w-4 h-4 text-purple-600" />}
          </div>
          <span className="font-semibold text-[11px]">NIM Resmi Dicatat</span>
        </div>
      </div>

      {/* Invoice Selector (if multiple registrations/invoices exist) */}
      {summary.registrationOptions.length > 1 && !summary.hasActiveNIM && !summary.activeSubmission && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <label className="text-[11px] font-medium text-slate-700 block">
            Pilih Registrasi & Invoice yang Dinilai Kelayakannya:
          </label>
          <div className="flex flex-wrap gap-2">
            {summary.registrationOptions.map((opt) => (
              <button
                key={opt.invoiceId}
                type="button"
                onClick={() => setSelectedInvoiceId(opt.invoiceId)}
                className={`px-3 py-1.5 rounded text-[11px] font-mono border transition ${
                  (currentOption?.invoiceId === opt.invoiceId)
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {opt.registrationNumber} ({opt.invoiceNumber})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Financial Breakdown Card */}
      {currentOption ? (
        <div className="bg-slate-50/60 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="text-xs">
              <span className="text-slate-500">Evaluasi Tagihan: </span>
              <span className="font-mono font-semibold text-slate-800">
                {currentOption.invoiceNumber}
              </span>{" "}
              <span className="text-slate-400">({currentOption.registrationNumber})</span>
            </div>
            <div className="text-[11px] font-medium">
              Status Tagihan:{" "}
              <span className="font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {currentOption.invoiceStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Kewajiban SALUT */}
            <div className="bg-white p-3 rounded border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Kewajiban Layanan SALUT</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatRupiah(currentOption.requiredSalutFee)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                (Komponen service_fee resmi)
              </span>
            </div>

            {/* Terbayar Netto */}
            <div className="bg-white p-3 rounded border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Terbayar Netto (PCA Posted)</span>
              <span
                className={`font-mono font-bold text-sm ${
                  currentOption.netSalutPaid >= currentOption.requiredSalutFee
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {formatRupiah(currentOption.netSalutPaid)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                (Alokasi dikurangi reversal)
              </span>
            </div>

            {/* Status Kelayakan Finansial */}
            <div className="bg-white p-3 rounded border border-slate-200 flex flex-col justify-between">
              <span className="text-[11px] text-slate-500 block">Kelayakan Finansial</span>
              <div className="flex items-center gap-1.5 mt-1">
                {currentOption.isEligible ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terpenuhi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Belum Terpenuhi
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reversal Warning if applicable */}
          {summary.activeSubmission && currentOption.netSalutPaid < currentOption.requiredSalutFee && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <span className="font-semibold block">
                  Peringatan Finansial: Pembayaran Komisi Ditarik / Direversal
                </span>
                <span className="text-[11px] text-red-700">
                  Pengajuan ke UT telah dicatat sebelumnya, namun saat ini saldo komisi SALUT netto (
                  {formatRupiah(currentOption.netSalutPaid)}) berada di bawah kewajiban (
                  {formatRupiah(currentOption.requiredSalutFee)}). Catatan pengajuan tetap disimpan
                  untuk riwayat audit.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded text-center text-slate-500 text-xs">
          Belum ada registrasi aktif atau invoice valid untuk calon mahasiswa ini.
        </div>
      )}

      {/* Active Submission Details Banner (Stage 3) */}
      {summary.activeSubmission && !summary.hasActiveNIM && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Berkas Admisi Telah Diajukan ke Universitas Terbuka</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-800 font-mono text-[10px] uppercase font-semibold">
              Menunggu Penerbitan NIM
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-700 font-mono">
            <div>
              <span className="text-slate-500 block">Tanggal Pengajuan:</span>
              <span>{summary.activeSubmission.submissionDate}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Nomor Referensi UT:</span>
              <span>{summary.activeSubmission.referenceNumber || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Petugas Pengaju:</span>
              <span>{summary.activeSubmission.submittedByName || "Petugas SALUT"}</span>
            </div>
          </div>

          {summary.activeSubmission.notes && (
            <div className="text-[11px] text-slate-600 pt-1 border-t border-blue-200">
              <span className="text-slate-500 font-medium">Catatan: </span>
              <span>{summary.activeSubmission.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Completed State Banner (Stage 4) */}
      {summary.hasActiveNIM && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-700" />
            <div>
              <h3 className="font-bold text-purple-950 text-sm">
                NIM Resmi Telah Terbit:{" "}
                <span className="font-mono text-purple-800">{summary.studentNim}</span>
              </h3>
              <p className="text-[11px] text-purple-800">
                Status mahasiswa aktif pada record yang sama. Seluruh riwayat transaksi registrasi,
                invoice, dan pembayaran tetap utuh.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
          {/* Action 1: Catat Pengajuan ke UT (Only when eligible & not yet submitted & no NIM) */}
          {!summary.hasActiveNIM && !summary.activeSubmission && (
            <button
              type="button"
              disabled={!currentOption?.isEligible}
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Catat Pengajuan ke UT</span>
            </button>
          )}

          {/* Action 2: Input NIM Resmi (Available anytime for authorized roles or after submission) */}
          {!summary.hasActiveNIM && (
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-2 shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Input NIM Resmi</span>
            </button>
          )}
        </div>
      )}

      {/* MODAL 1: Dialog Catat Pengajuan ke UT */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <span>Catat Pengajuan Berkas ke UT</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini <strong className="text-slate-800">hanya mencatat pengajuan eksternal</strong> yang telah dilakukan petugas di luar aplikasi (bukan mengirim berkas atau integrasi API ke UT). Syarat finansial pemenuhan komisi SALUT telah terpenuhi.
            </p>

            {submitError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitRecording} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Tanggal Pengajuan ke UT *
                </label>
                <input
                  type="date"
                  required
                  value={submissionDate}
                  onChange={(e) => setSubmissionDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Nomor Referensi / Tanda Terima UT (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: ADM-UT-2026-0081"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Catatan Pengajuan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Berkas ijazah dan formulir admisi terverifikasi"
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Dialog Input NIM Resmi */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span>Penerbitan & Input NIM Resmi</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              NIM resmi yang diterbitkan UT akan disimpan pada record mahasiswa ini (UUID tetap).
              Status calon otomatis bermutasi menjadi <span className="font-semibold text-purple-700">AKTIF</span>.
              Awalan angka 0 dipertahankan secara utuh.
            </p>

            {assignError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignNim} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Nomor Induk Mahasiswa (NIM) Resmi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 0487654321"
                  value={officialNim}
                  onChange={(e) => setOfficialNim(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Masukkan NIM resmi sesuai dokumen UT. Nol di depan (misal: 04...) dipertahankan secara utuh.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Penerbitan NIM resmi UT periode 2026/2027"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {isAssigning ? "Menyimpan..." : "Tetapkan NIM & Aktifkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
