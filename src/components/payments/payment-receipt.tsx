"use client";

import { PaymentReceiptData } from "@/types/payment";
import { Printer, CheckCircle2, Scissors } from "lucide-react";

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
        <div className="text-xs text-slate-500">
          Kuitansi Pembayaran Resmi SIM-SALUT (Ukuran Hemat 1/2 A4 / A5)
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

      {/* Printable Receipt Card (Compact 1/2 A4 Layout) */}
      <div className="bg-white text-slate-900 rounded-xl p-6 print:p-0 shadow-xl border border-slate-200 relative overflow-hidden text-xs space-y-3.5 print:shadow-none print:border-none print:max-w-full">
        {/* Void Watermark Overlay */}
        {isVoid && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
            <div className="text-red-600/20 font-black text-5xl transform -rotate-12 border-4 border-red-600/20 px-6 py-2 rounded-2xl tracking-widest">
              DIBATALKAN / VOID
            </div>
          </div>
        )}

        {/* Header SALUT Kop */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
          <div className="space-y-0.5">
            <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
              {headerName}
            </h1>
            <p className="text-[10px] text-slate-600 font-medium leading-tight">
              Sentra Layanan Universitas Terbuka — Kota Pangkalpinang
            </p>
            <p className="text-[9px] text-slate-500 leading-tight">
              {receiptAddress}
            </p>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 inline-block">
              KUITANSI PEMBAYARAN
            </div>
            <p className="text-xs font-mono font-bold text-slate-900">
              {receiptData.transactionNumber}
            </p>
          </div>
        </div>

        {/* Receipt Content Metadata */}
        <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-200 pb-2.5">
          <div className="space-y-1">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-semibold block">Telah Diterima Dari</span>
              <span className="font-bold text-slate-900 text-xs">{receiptData.studentName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-semibold block">NIM / No. Registrasi</span>
              <span className="font-mono text-slate-800 text-[10px]">
                {receiptData.studentNim || "Calon Mahasiswa"} ({receiptData.registrationNumber})
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-semibold block">Periode Akademik</span>
              <span className="text-slate-800 text-[10px]">{receiptData.academicPeriodName}</span>
            </div>
          </div>

          <div className="space-y-1 text-right">
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-semibold block">Tanggal Pembayaran</span>
              <span className="font-mono text-slate-800 text-[10px]">{formattedPaidAt}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[9px] uppercase font-semibold block">Metode Pembayaran</span>
              <span className="font-medium text-slate-800 text-[10px]">{receiptData.paymentMethodName}</span>
            </div>
            {receiptData.referenceNumber && (
              <div>
                <span className="text-slate-500 text-[9px] uppercase font-semibold block">No. Referensi / Bank</span>
                <span className="font-mono text-slate-800 text-[10px]">{receiptData.referenceNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Allocation Table */}
        <div className="space-y-1">
          <h3 className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">
            Rincian Alokasi Tagihan Invoice
          </h3>
          <table className="w-full text-left text-[11px] border border-slate-200 rounded overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[9px]">
              <tr>
                <th className="px-3 py-1.5">No. Invoice Tagihan</th>
                <th className="px-3 py-1.5 text-right">Total Invoice</th>
                <th className="px-3 py-1.5 text-right">Pembayaran Ini</th>
                <th className="px-3 py-1.5 text-right">Sisa Tagihan Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-normal">
              <tr>
                <td className="px-3 py-1.5 font-mono font-bold text-slate-900">
                  {receiptData.invoiceNumber}
                </td>
                <td className="px-3 py-1.5 font-mono text-right">
                  Rp {receiptData.invoiceTotalAmount.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-1.5 font-mono font-bold text-emerald-700 text-right">
                  Rp {receiptData.amount.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-1.5 font-mono font-bold text-slate-900 text-right">
                  Rp {receiptData.remainingBalance.toLocaleString("id-ID")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terbilang & Amount Box */}
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Jumlah Pembayaran Diterima</span>
            <div className="text-lg font-black font-mono text-slate-900">
              Rp {receiptData.amount.toLocaleString("id-ID")}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>VERIFIED RESMI</span>
          </div>
        </div>

        {/* Signature & Verifier Footer */}
        <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4 items-end text-xs">
          <div className="text-left text-[9px] text-slate-500 space-y-0.5">
            <p><strong>Catatan:</strong></p>
            <p>1. Bukti pembayaran ini adalah dokumen sah pengganti kuitansi fisik.</p>
            <p>2. Harap simpan bukti kuitansi ini untuk keperluan administrasi akademik.</p>
          </div>

          <div className="space-y-4 text-center">
            <div className="text-[10px] text-slate-600 leading-tight">
              Pangkalpinang, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              <br />
              <strong className="text-slate-800">Kasir / Petugas Keuangan SALUT</strong>
            </div>

            <div className="font-bold text-slate-900 underline font-mono text-[11px]">
              {receiptData.verifierName || "Petugas Keuangan SALUT"}
            </div>
          </div>
        </div>

        {/* Cut Line Indicator (Only Visible on Print) */}
        <div className="hidden print:flex items-center gap-2 pt-3 text-[9px] text-slate-400 font-mono select-none">
          <Scissors className="w-3 h-3 text-slate-400 rotate-90 shrink-0" />
          <span className="shrink-0">Gunting / Potong Kertas 1/2 A4 (Ukuran A5)</span>
          <div className="flex-1 border-b border-dashed border-slate-300"></div>
        </div>
      </div>
    </div>
  );
}
