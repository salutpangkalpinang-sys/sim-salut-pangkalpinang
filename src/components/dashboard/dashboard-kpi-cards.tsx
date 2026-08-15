"use client";

import { DashboardKpiMetrics } from "@/features/dashboard/queries";
import {
  Users,
  UserCheck,
  FileCheck,
  Receipt,
  CreditCard,
  AlertCircle,
  Building2,
  Send,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Wallet,
} from "lucide-react";

interface DashboardKpiCardsProps {
  metrics: DashboardKpiMetrics;
}

export function DashboardKpiCards({ metrics }: DashboardKpiCardsProps) {
  return (
    <div className="space-y-6 text-xs">
      {/* SECTION 1: AKADEMIK */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Akademik & Mahasiswa
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Mahasiswa Aktif</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">{metrics.activeStudents}</p>
            <p className="text-[10px] text-slate-500">Mahasiswa berstatus aktif</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Calon Mahasiswa</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">{metrics.candidateStudents}</p>
            <p className="text-[10px] text-slate-500">Pendaftar baru berstatus calon</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Registrasi Semester</span>
              <FileCheck className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">{metrics.semesterRegistrations}</p>
            <p className="text-[10px] text-slate-500">Registrasi aktif {metrics.selectedPeriodName}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: TAGIHAN & PENERIMAAN MAHASISWA */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Receipt className="w-4 h-4 text-emerald-600" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Tagihan & Penerimaan Mahasiswa
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Total Tagihan</span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">
              Rp {metrics.totalInvoicesBilled.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Derived dari invoice_items aktif</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Penerimaan Mahasiswa</span>
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold font-mono text-emerald-600">
              Rp {metrics.studentPaymentsVerified.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Total pembayaran mahasiswa terverifikasi</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Piutang Mahasiswa</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl font-bold font-mono text-amber-600">
              Rp {metrics.studentReceivables.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Sisa tagihan aktif belum lunas</p>
          </div>
        </div>
      </div>

      {/* SECTION 3: KEWAJIBAN UT & SETORAN */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Kewajiban & Setoran UT
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Kewajiban UT</span>
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">
              Rp {metrics.utLiability.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Bersumber dari LIP official amount</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Setoran ke UT</span>
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold font-mono text-emerald-600">
              Rp {metrics.utRemittancesVerified.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Total setoran UT terverifikasi</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Kewajiban UT Belum Disetor</span>
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xl font-bold font-mono text-red-600">
              Rp {metrics.outstandingUtLiability.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Sisa kewajiban UT yang belum disetor</p>
          </div>
        </div>
      </div>

      {/* SECTION 4: BIAYA LAYANAN SALUT, OPERASIONAL & ARUS KAS BERSIH */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Biaya Layanan, Operasional & Arus Kas
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          {/* Biaya Layanan SALUT Ditagihkan Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-700">Biaya Layanan Ditagihkan</span>
                <div className="group relative cursor-pointer inline-flex items-center">
                  <button
                    type="button"
                    aria-label="Informasi Biaya Layanan SALUT Ditagihkan"
                    className="focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-full p-0.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                  </button>
                  <div
                    role="tooltip"
                    tabIndex={0}
                    className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block group-focus-within:block w-56 p-2.5 bg-slate-900 border border-slate-700 text-slate-100 text-[10px] rounded-lg shadow-xl z-20 leading-snug font-normal"
                  >
                    Total biaya layanan SALUT pada tagihan aktif. Nilai ini merupakan jumlah yang ditagihkan dan belum tentu seluruhnya sudah diterima sebagai kas.
                  </div>
                </div>
              </div>
            </div>
            <p className="text-lg font-bold font-mono text-blue-600">
              Rp {metrics.serviceFeeBilled.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Service fee pada invoice aktif</p>
          </div>

          {/* Pemasukan Operasional */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Pemasukan Operasional</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold font-mono text-emerald-600">
              Rp {metrics.operationalIncomeVerified.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Income operasional terverifikasi</p>
          </div>

          {/* Pengeluaran Operasional */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-slate-700">Pengeluaran Operasional</span>
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-bold font-mono text-amber-600">
              Rp {metrics.operationalExpenseVerified.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Expense operasional terverifikasi</p>
          </div>

          {/* Arus Kas Bersih Card */}
          <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-blue-700">Arus Kas Bersih</span>
                <div className="group relative cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600 hover:text-blue-800" />
                  <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-52 p-2 bg-slate-900 border border-slate-700 text-slate-100 text-[10px] rounded-lg shadow-xl z-20 leading-tight">
                    Pergerakan kas bersih pada periode terpilih. Bukan laba/rugi.
                  </div>
                </div>
              </div>
              <Scale className="w-4 h-4 text-blue-600" />
            </div>
            <p className={`text-lg font-bold font-mono ${metrics.netCashMovement >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Rp {metrics.netCashMovement.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-500">Net Cash Movement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
