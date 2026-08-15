"use client";

import Link from "next/link";
import { CreditCard, AlertTriangle, FileText, Building2, ArrowRight } from "lucide-react";

interface DashboardWidgetsProps {
  latestPayments: {
    id: string;
    transactionNumber: string;
    studentName: string;
    studentNim: string | null;
    paidAt: string;
    amount: number;
    paymentMethodName: string;
    status: string;
  }[];
  overdueInvoices: {
    id: string;
    invoiceNumber: string;
    studentName: string;
    studentNim: string | null;
    dueAt: string;
    invoiceTotalAmount: number;
    remainingBalance: number;
  }[];
  pendingLips: {
    id: string;
    lipNumber: string;
    studentName: string;
    studentNim: string | null;
    registrationNumber: string;
    officialAmount: number;
    createdAt: string;
  }[];
  outstandingUtPriority: {
    id: string;
    lipNumber: string;
    studentName: string;
    studentNim: string | null;
    registrationNumber: string;
    officialAmount: number;
    verifiedUtPaid: number;
    outstandingUtAmount: number;
  }[];
}

export function DashboardWidgets({
  latestPayments,
  overdueInvoices,
  pendingLips,
  outstandingUtPriority,
}: DashboardWidgetsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
      {/* WIDGET 1: PEMBAYARAN MAHASISWA TERBARU */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
              Pembayaran Mahasiswa Terbaru
            </h3>
          </div>
          <Link
            href="/pembayaran"
            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {latestPayments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {latestPayments.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition">
                <div>
                  <div className="font-mono font-bold text-blue-600">{p.transactionNumber}</div>
                  <div className="text-slate-800 font-medium">{p.studentName}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(p.paidAt).toLocaleDateString("id-ID")} — {p.paymentMethodName}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-emerald-600">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 text-[9px] font-semibold rounded-full border ${
                      p.status === "verified"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {p.status === "verified" ? "Terverifikasi" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic py-4 text-center">Belum ada pembayaran recorded.</p>
        )}
      </div>

      {/* WIDGET 2: TAGIHAN JATUH TEMPO */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
              Tagihan Jatuh Tempo (Overdue)
            </h3>
          </div>
          <Link
            href="/lip-tagihan"
            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {overdueInvoices.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {overdueInvoices.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition">
                <div>
                  <div className="font-mono font-bold text-amber-600">{inv.invoiceNumber}</div>
                  <div className="text-slate-800 font-medium">{inv.studentName}</div>
                  <div className="text-[10px] text-red-600 font-mono">
                    Jatuh Tempo: {new Date(inv.dueAt).toLocaleDateString("id-ID")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">
                    Rp {inv.remainingBalance.toLocaleString("id-ID")}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Total: Rp {inv.invoiceTotalAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic py-4 text-center">Tidak ada tagihan jatuh tempo.</p>
        )}
      </div>

      {/* WIDGET 3: LIP MENUNGGU VERIFIKASI */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
              LIP Menunggu Verifikasi
            </h3>
          </div>
          <Link
            href="/lip-tagihan"
            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Kelola LIP</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {pendingLips.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pendingLips.map((lip) => (
              <div key={lip.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition">
                <div>
                  <div className="font-mono font-bold text-blue-600">{lip.lipNumber}</div>
                  <div className="text-slate-800 font-medium">{lip.studentName}</div>
                  <div className="text-[10px] text-slate-500">Reg: {lip.registrationNumber}</div>
                </div>
                <div className="text-right font-mono font-bold text-amber-600">
                  Rp {lip.officialAmount.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic py-4 text-center">Tidak ada LIP menunggu verifikasi.</p>
        )}
      </div>

      {/* WIDGET 4: OUTSTANDING UT PRIORITY */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
              Kewajiban UT Belum Disetor (Prioritas)
            </h3>
          </div>
          <Link
            href="/setoran-ut"
            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Catat Setoran</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {outstandingUtPriority.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {outstandingUtPriority.map((ut) => (
              <div key={ut.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition">
                <div>
                  <div className="font-mono font-bold text-purple-600">{ut.lipNumber}</div>
                  <div className="text-slate-800 font-medium">{ut.studentName}</div>
                  <div className="text-[10px] text-slate-500">
                    Disetor: Rp {ut.verifiedUtPaid.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-red-600">
                    Rp {ut.outstandingUtAmount.toLocaleString("id-ID")}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Official: Rp {ut.officialAmount.toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic py-4 text-center">Seluruh kewajiban UT telah lunas disetor.</p>
        )}
      </div>
    </div>
  );
}
