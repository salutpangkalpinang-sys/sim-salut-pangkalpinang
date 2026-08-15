"use client";

import { Invoice } from "@/types/lip-invoice";
import { Receipt, Eye, ArrowLeft, ArrowRight } from "lucide-react";

interface InvoiceTableProps {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onSelectInvoice?: (inv: Invoice) => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  unpaid: {
    label: "Belum Dibayar",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  paid: {
    label: "Lunas",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partial: {
    label: "Sebagian",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function InvoiceTable({
  invoices,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  onSelectInvoice,
}: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <Receipt className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Belum Ada Tagihan Invoice</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Belum ada tagihan invoice mahasiswa yang diterbitkan dari LIP terverifikasi.
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
                <th className="px-4 py-3">No. Invoice</th>
                <th className="px-4 py-3">Mahasiswa</th>
                <th className="px-4 py-3">No. Registrasi</th>
                <th className="px-4 py-3">No. LIP Resmi</th>
                <th className="px-4 py-3">Resmi UT (LIP)</th>
                <th className="px-4 py-3">Total Tagihan</th>
                <th className="px-4 py-3">Terbayar Verified</th>
                <th className="px-4 py-3">Sisa Tagihan</th>
                <th className="px-4 py-3">Status Tagihan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {invoices.map((inv) => {
                const badge = STATUS_BADGES[inv.status] || STATUS_BADGES.unpaid;
                const verifiedPaid = inv.verifiedPaid || 0;
                const remaining = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, (inv.totalInvoiceAmount || 0) - verifiedPaid);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{inv.studentName || "Mahasiswa"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        NIM: {inv.studentNim || "Calon"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {inv.registrationNumber || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {inv.lipNumber || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      Rp {(inv.lipOfficialAmount || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      Rp {(inv.totalInvoiceAmount || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                      Rp {verifiedPaid.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-600">
                      Rp {remaining.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold border rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onSelectInvoice && (
                        <button
                          type="button"
                          onClick={() => onSelectInvoice(inv)}
                          className="p-1.5 rounded bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition shadow-xs"
                          title="Lihat Breakdown Rincian Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
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
            <span className="font-semibold text-slate-800">{total}</span> invoice
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
