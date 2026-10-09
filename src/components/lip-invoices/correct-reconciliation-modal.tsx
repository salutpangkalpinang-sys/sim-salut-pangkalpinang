"use client";

import { useState, useRef } from "react";
import { Invoice } from "@/types/lip-invoice";
import { correctReconciledLipAction } from "@/features/lip-invoices/actions";
import { X, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatThousandInput, parseThousandInput } from "@/lib/utils/ut-tariffs";

interface FrozenPayload {
  key: string;
  lipDocumentId: string;
  expectedReconciliationId: string;
  tuitionAmount: number;
  bookAmount: number;
  shippingAmount: number;
  otherUtAmount: number;
  correctionReason: string;
}

interface CorrectReconciliationModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CorrectReconciliationModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: CorrectReconciliationModalProps) {
  // Komponen input terpisah
  const [tuitionAmount, setTuitionAmount] = useState<number>(0);
  const [bookAmount, setBookAmount] = useState<number>(0);
  const [shippingAmount, setShippingAmount] = useState<number>(0);
  const [otherUtAmount, setOtherUtAmount] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Seluruh request pertama dibekukan (frozen) agar saat retry setelah timeout memakai payload & key yang persis sama
  const frozenRequestRef = useRef<FrozenPayload | null>(null);

  if (!isOpen) return null;

  // 1. Data SEBELUM koreksi diambil murni dari invoice & dokumen LIP aktual (tanpa estimasi atau angka tebakan)
  const prevUtOfficial = Number(invoice.lipOfficialAmount ?? invoice.officialLipAmount ?? 0);
  const salutServiceFee = 400000; // Komisi SALUT selalu tetap Rp 400.000
  const prevTotalBilled = Number(invoice.totalInvoiceAmount ?? 0);
  const currentVerifiedPaid = Number(invoice.verifiedPaid ?? 0);
  const prevRemaining = invoice.remainingBalance !== undefined 
    ? Number(invoice.remainingBalance) 
    : Math.max(0, prevTotalBilled - currentVerifiedPaid);

  // 2. Data SESUDAH koreksi dihitung dari input aktif atau request yang dibekukan
  const effectivePayload = frozenRequestRef.current || {
    tuitionAmount,
    bookAmount,
    shippingAmount,
    otherUtAmount,
    correctionReason,
  };

  const totalNewUt = effectivePayload.tuitionAmount + effectivePayload.bookAmount + effectivePayload.shippingAmount + effectivePayload.otherUtAmount;
  const estimatedNewTotal = totalNewUt + salutServiceFee;
  const remainingEstimate = Math.max(0, estimatedNewTotal - currentVerifiedPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Mencegah double submit ganda

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!invoice.lipDocumentId) {
      setErrorMsg("Invoice ini tidak memiliki dokumen LIP yang terkait.");
      return;
    }

    if (!invoice.activeReconciliationId) {
      setErrorMsg("ID rekonsiliasi aktif tidak ditemukan pada invoice ini.");
      return;
    }

    // Jika ini adalah request pertama, bekukan seluruh payload dan generate idempotency key sekali
    if (!frozenRequestRef.current) {
      const activeTotalUt = tuitionAmount + bookAmount + shippingAmount + otherUtAmount;
      if (activeTotalUt <= 0) {
        setErrorMsg("Total komponen biaya UT baru harus lebih besar dari Rp 0.");
        return;
      }

      if (correctionReason.trim().length < 5) {
        setErrorMsg("Alasan koreksi wajib diisi minimal 5 karakter untuk jejak audit.");
        return;
      }

      frozenRequestRef.current = {
        key: crypto.randomUUID(),
        lipDocumentId: invoice.lipDocumentId,
        expectedReconciliationId: invoice.activeReconciliationId,
        tuitionAmount,
        bookAmount,
        shippingAmount,
        otherUtAmount,
        correctionReason: correctionReason.trim(),
      };
    }

    const payload = frozenRequestRef.current;
    setIsSubmitting(true);

    try {
      // Mengirimkan request yang dibekukan secara identik (key, komponen biaya, alasan, LIP ID, dan expected reconciliation ID)
      const res = await correctReconciledLipAction({
        lipDocumentId: payload.lipDocumentId,
        expectedReconciliationId: payload.expectedReconciliationId,
        newTuitionAmount: payload.tuitionAmount,
        newBookAmount: payload.bookAmount,
        newShippingAmount: payload.shippingAmount,
        newOtherUtAmount: payload.otherUtAmount,
        correctionReason: payload.correctionReason,
        idempotencyKey: payload.key,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Koreksi rekonsiliasi LIP berhasil diproses dengan aman.");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(
        err.message || "Terjadi kendala jaringan/timeout. Silakan klik tombol coba lagi untuk retry dengan payload & idempotency key yang sama."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFrozen = Boolean(frozenRequestRef.current);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Koreksi Rekonsiliasi Tagihan LIP
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {invoice.invoiceNumber} • {invoice.studentName} ({invoice.studentNim || "No NIM"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Warning / Guard Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Prosedur Koreksi Resmi Berbasis Audit</span>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Prosedur ini akan membatalkan rekonsiliasi lama secara atomik, menerbitkan rekonsiliasi baru, 
                membalik penyesuaian shortage lama, serta menjaga pembayaran terverifikasi Rp {currentVerifiedPaid.toLocaleString("id-ID")} dan 
                komisi SALUT Rp {salutServiceFee.toLocaleString("id-ID")} tetap utuh.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isFrozen && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px]">
              🔒 <strong>Payload Dibekukan untuk Retry:</strong> Permintaan ini sedang memakai Idempotency Key <code>{frozenRequestRef.current?.key.slice(0, 8)}...</code> dengan nominal terkunci agar tidak terjadi mutasi ganda.
            </div>
          )}

          {/* Rincian Komponen Biaya Resmi UT */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Komponen Biaya Resmi UT Baru (Dari Lembar LIP)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  SPP / UKT UT (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formatThousandInput(isFrozen ? frozenRequestRef.current!.tuitionAmount : tuitionAmount)}
                  onChange={(e) => setTuitionAmount(parseThousandInput(e.target.value))}
                  disabled={isSubmitting || isFrozen}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Pengiriman Bahan Ajar (Rp)
                </label>
                <input
                  type="text"
                  value={formatThousandInput(isFrozen ? frozenRequestRef.current!.shippingAmount : shippingAmount)}
                  onChange={(e) => setShippingAmount(parseThousandInput(e.target.value))}
                  disabled={isSubmitting || isFrozen}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Bahan Ajar / Buku (Rp)
                </label>
                <input
                  type="text"
                  value={formatThousandInput(isFrozen ? frozenRequestRef.current!.bookAmount : bookAmount)}
                  onChange={(e) => setBookAmount(parseThousandInput(e.target.value))}
                  disabled={isSubmitting || isFrozen}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Lainnya / UT (Rp)
                </label>
                <input
                  type="text"
                  value={formatThousandInput(isFrozen ? frozenRequestRef.current!.otherUtAmount : otherUtAmount)}
                  onChange={(e) => setOtherUtAmount(parseThousandInput(e.target.value))}
                  disabled={isSubmitting || isFrozen}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Alasan Koreksi */}
          <div className="text-xs space-y-1">
            <label className="block text-slate-600 font-medium">
              Alasan Koreksi (Jejak Rekam Audit) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={isFrozen ? frozenRequestRef.current!.correctionReason : correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              disabled={isSubmitting || isFrozen}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none disabled:bg-slate-100"
              placeholder="Contoh: Penyesuaian tagihan LIP resmi UT sesuai lembar fisik..."
              required
            />
          </div>

          {/* Tabel Perbandingan Finansial Sebelum & Sesudah (Berdasarkan Angka Aktual) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-2 font-semibold text-slate-700 flex justify-between">
              <span>Perbandingan Finansial Tagihan</span>
              {isFrozen && (
                <span className="font-mono text-[11px] text-blue-700 font-semibold">Key: {frozenRequestRef.current?.key.slice(0, 8)}...</span>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-3 p-2.5 bg-white">
                <span className="text-slate-500">Komponen Biaya</span>
                <span className="text-slate-600 font-medium text-center">Sebelum Koreksi</span>
                <span className="text-slate-900 font-semibold text-right">Setelah Koreksi</span>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-slate-50/50">
                <span className="text-slate-600">Kewajiban Resmi UT</span>
                <span className="font-mono text-slate-600 text-center">Rp {prevUtOfficial.toLocaleString("id-ID")}</span>
                <span className="font-mono font-semibold text-emerald-700 text-right">Rp {totalNewUt.toLocaleString("id-ID")}</span>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-white">
                <span className="text-slate-600">Komisi SALUT (Tetap)</span>
                <span className="font-mono text-slate-600 text-center">Rp {salutServiceFee.toLocaleString("id-ID")}</span>
                <span className="font-mono font-semibold text-blue-700 text-right">Rp {salutServiceFee.toLocaleString("id-ID")}</span>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-blue-50/40 font-semibold">
                <span className="text-slate-800">Total Tagihan (Billed)</span>
                <span className="font-mono text-slate-700 text-center">Rp {prevTotalBilled.toLocaleString("id-ID")}</span>
                <span className="font-mono text-blue-800 text-right">Rp {estimatedNewTotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-white">
                <span className="text-emerald-700 font-medium">Pembayaran Terverifikasi</span>
                <span className="font-mono text-emerald-700 text-center">Rp {currentVerifiedPaid.toLocaleString("id-ID")}</span>
                <span className="font-mono text-emerald-700 text-right">Rp {currentVerifiedPaid.toLocaleString("id-ID")} (Tetap)</span>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-amber-50/60 font-bold">
                <span className="text-amber-900">Sisa Tagihan (Balance Due)</span>
                <span className="font-mono text-amber-700 text-center">Rp {prevRemaining.toLocaleString("id-ID")}</span>
                <span className="font-mono text-amber-900 text-right">Rp {remainingEstimate.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Koreksi...</span>
                </>
              ) : isFrozen ? (
                <span>Coba Lagi (Retry Request)</span>
              ) : (
                <span>Eksekusi Koreksi Rekonsiliasi</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
