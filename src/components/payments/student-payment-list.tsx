import Link from "next/link";
import { StudentPayment } from "@/types/payment";
import { CreditCard, Eye } from "lucide-react";

interface StudentPaymentListProps {
  payments: StudentPayment[];
}

export function StudentPaymentList({ payments }: StudentPaymentListProps) {
  if (payments.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
        Belum ada riwayat transaksi pembayaran yang tercatat untuk mahasiswa ini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2">
        <CreditCard className="w-4 h-4 text-emerald-600" />
        <span>Riwayat Transaksi Pembayaran ({payments.length})</span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2">No. Transaksi</th>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Metode & Ref</th>
              <th className="px-3 py-2">Nominal</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {payments.map((p) => {
              const paidDateFormatted = new Date(p.paidAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-medium text-blue-600">
                    <Link href={`/pembayaran/${p.id}`} className="hover:underline">
                      {p.transactionNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">{paidDateFormatted}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{p.paymentMethodName}</div>
                    {p.referenceNumber && (
                      <div className="text-[10px] text-slate-400 font-mono">Ref: {p.referenceNumber}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-600">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                        p.status === "verified"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : p.status === "voided"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/pembayaran/${p.id}`}
                      className="p-1 rounded bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition inline-block border border-slate-200 shadow-xs"
                      title="Lihat Detail Transaksi"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
