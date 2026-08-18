"use client";

import { PaymentReceiptData } from "@/types/payment";
import { Printer, CheckCircle2 } from "lucide-react";

interface PaymentReceiptProps {
  receiptData: PaymentReceiptData;
}

export function PaymentReceipt({ receiptData }: PaymentReceiptProps) {
  const isVoid = receiptData.status === "voided";

  const handlePrint = () => {
    window.print();
  };

  const formattedPaidAt = new Date(receiptData.paidAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const headerName = receiptData.receiptHeaderName || "SALUT MEGA CENDEKIA";
  const receiptAddress = receiptData.receiptAddress || "Jl. Utama No. 12, Pangkalpinang, Bangka Belitung";

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="text-xs text-slate-400">
          Kuitansi Pembayaran Resmi SIM-SALUT
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md transition"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Kuitansi Resmi</span>
        </button>
      </div>

      {/* Printable Receipt Card */}
      <div className="bg-white text-slate-900 rounded-xl p-8 shadow-xl border border-slate-200 relative overflow-hidden text-xs space-y-6 print:shadow-none print:border-none print:p-0">
        {/* Void Watermark Overlay */}
        {isVoid && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
            <div className="text-red-600/20 font-black text-6xl md:text-8xl transform -rotate-12 border-8 border-red-600/20 px-8 py-4 rounded-3xl tracking-widest">
              DIBATALKAN / VOID
            </div>
          </div>
        )}

        {/* Header SALUT Kop */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
              {headerName}
            </h1>
            <p className="text-[11px] text-slate-600 font-medium">
              Sentra Layanan Universitas Terbuka — Kota Pangkalpinang
            </p>
            <p className="text-[10px] text-slate-500">
              {receiptAddress}
            </p>
          </div>

          <div className="text-right space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-3 py-1 rounded border border-blue-200 inline-block">
              KUITANSI PEMBAYARAN
            </div>
            <p className="text-xs font-mono font-bold text-slate-900">
              {receiptData.transactionNumber}
            </p>
          </div>
        </div>

        {/* Receipt Content Metadata */}
        <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-4">
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">Telah Diterima Dari</span>
              <span className="font-bold text-slate-900 text-sm">{receiptData.studentName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">NIM / No. Registrasi</span>
              <span className="font-mono text-slate-800">
                {receiptData.studentNim || "Calon Mahasiswa"} ({receiptData.registrationNumber})
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">Periode Akademik</span>
              <span className="text-slate-800">{receiptData.academicPeriodName}</span>
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">Tanggal Pembayaran</span>
              <span className="font-mono text-slate-800">{formattedPaidAt}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">Metode Pembayaran</span>
              <span className="font-medium text-slate-800">{receiptData.paymentMethodName}</span>
            </div>
            {receiptData.referenceNumber && (
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold block">No. Referensi / Bank</span>
                <span className="font-mono text-slate-800">{receiptData.referenceNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Allocation Table */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase text-slate-700 tracking-wider">
            Rincian Alokasi Tagihan Invoice
          </h3>
          <table className="w-full text-left text-xs border border-slate-200 rounded overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">No. Invoice Tagihan</th>
                <th className="px-3 py-2 text-right">Total Invoice</th>
                <th className="px-3 py-2 text-right">Pembayaran Ini</th>
                <th className="px-4 py-2 text-right">Sisa Tagihan Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-normal">
              <tr>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                  {receiptData.invoiceNumber}
                </td>
                <td className="px-3 py-2.5 font-mono text-right">
                  Rp {receiptData.invoiceTotalAmount.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-emerald-700 text-right">
                  Rp {receiptData.amount.toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-2.5 font-mono font-bold text-slate-900 text-right">
                  Rp {receiptData.remainingBalance.toLocaleString("id-ID")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terbilang & Amount Box */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">Jumlah Pembayaran Diterima</span>
            <div className="text-xl font-black font-mono text-slate-900">
              Rp {receiptData.amount.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>PEMBAYARAN VERIFIED RESMI</span>
          </div>
        </div>

        {/* Signature & Verifier Footer */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
          <div className="text-left text-[11px] text-slate-500 space-y-1">
            <p><strong>Catatan:</strong></p>
            <p>1. Bukti pembayaran ini adalah dokumen sah pengganti kuitansi fisik.</p>
            <p>2. Harap simpan bukti kuitansi ini untuk keperluan administrasi akademik.</p>
          </div>

          <div className="space-y-8">
            <div className="text-slate-600">
              Pangkalpinang, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              <br />
              <strong className="text-slate-800">Kasir / Petugas Keuangan SALUT</strong>
            </div>

            <div className="font-bold text-slate-900 underline font-mono">
              {receiptData.verifierName || "Petugas Keuangan SALUT"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
