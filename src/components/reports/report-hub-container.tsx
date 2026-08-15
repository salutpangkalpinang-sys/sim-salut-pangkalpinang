"use client";

import { useState } from "react";
import { RoleCode } from "@/lib/auth/types";
import {
  BarChart3,
  Download,
  Users,
  Receipt,
  Building2,
  Wallet,
  Search,
  RotateCcw,
  HelpCircle,
} from "lucide-react";

interface ReportHubContainerProps {
  userRole: RoleCode;
  initialTab?: string;
  reportsData: {
    students: any;
    registrations: any;
    invoices: any;
    receivables: any;
    payments: any;
    utRemittances: any;
    utOutstanding: any;
    serviceFees: any;
    operational: any;
    cashFlow: any;
  };
}

export function ReportHubContainer({
  userRole,
  initialTab = "akademik",
  reportsData,
}: ReportHubContainerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const isAcademicAdmin = userRole === "academic_admin";

  const handleExportCsv = (reportType: string) => {
    window.open(`/api/export?report=${reportType}`, "_blank");
  };

  const handleResetFilter = () => {
    setSearchQuery("");
  };

  const renderEmptyState = (hasFilter: boolean) => {
    if (hasFilter) {
      return (
        <tr className="bg-slate-50">
          <td colSpan={10} className="py-8 px-4 text-center">
            <div className="space-y-3 max-w-sm mx-auto">
              <p className="text-slate-700 font-medium text-xs">
                Tidak ada data yang sesuai dengan filter yang dipilih.
              </p>
              <button
                type="button"
                onClick={handleResetFilter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 font-semibold text-xs rounded-lg transition border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr className="bg-slate-50">
        <td colSpan={10} className="py-8 px-4 text-center">
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="text-slate-700 font-medium text-xs">Belum ada data untuk laporan ini.</p>
            <p className="text-[11px] text-slate-500">
              Data akan muncul setelah transaksi atau aktivitas terkait tersedia.
            </p>
          </div>
        </td>
      </tr>
    );
  };

  const filteredStudents = (reportsData.students?.data || []).filter((s: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.nim?.toLowerCase().includes(q) ||
      s.studyProgramName?.toLowerCase().includes(q)
    );
  });

  const filteredRegistrations = (reportsData.registrations?.data || []).filter((r: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.registrationNumber?.toLowerCase().includes(q) ||
      r.studentName?.toLowerCase().includes(q) ||
      r.nim?.toLowerCase().includes(q)
    );
  });

  const filteredInvoices = (reportsData.invoices?.data || []).filter((inv: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.studentName?.toLowerCase().includes(q) ||
      inv.nim?.toLowerCase().includes(q)
    );
  });

  const filteredReceivables = (reportsData.receivables?.data || []).filter((rec: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      rec.invoiceNumber?.toLowerCase().includes(q) ||
      rec.studentName?.toLowerCase().includes(q) ||
      rec.nim?.toLowerCase().includes(q)
    );
  });

  const filteredUtOutstanding = (reportsData.utOutstanding?.data || []).filter((lip: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lip.lipNumber?.toLowerCase().includes(q) ||
      lip.studentName?.toLowerCase().includes(q) ||
      lip.registrationNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner & Search Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-slate-900">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Laporan Bisnis & Keuangan SIM-SALUT</span>
          </h1>
          <p className="text-xs text-slate-500">
            Pusat rekapitulasi data akademik, tagihan, kewajiban UT, kas operasional, dan export CSV
          </p>
        </div>

        {/* Global Search Input Filter */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci laporan..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              title="Reset pencarian"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("akademik")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === "akademik"
              ? "border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Akademik</span>
        </button>

        {!isAcademicAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("tagihan")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeTab === "tagihan"
                  ? "border-emerald-600 text-emerald-600 bg-emerald-50 rounded-t-lg font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Tagihan & Pembayaran</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ut")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeTab === "ut"
                  ? "border-purple-600 text-purple-600 bg-purple-50 rounded-t-lg font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Kewajiban UT</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("operasional")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition whitespace-nowrap ${
                activeTab === "operasional"
                  ? "border-amber-600 text-amber-600 bg-amber-50 rounded-t-lg font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Operasional & Arus Kas</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: AKADEMIK */}
      {activeTab === "akademik" && (
        <div className="space-y-6">
          {/* Laporan Mahasiswa */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Database Mahasiswa</h2>
                <p className="text-[11px] text-slate-500">Rekapitulasi data mahasiswa aktif dan calon mahasiswa (NIK Masked)</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("students")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Mahasiswa</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">NIM</th>
                    <th className="px-3 py-2">Nama Mahasiswa</th>
                    <th className="px-3 py-2">NIK Masked</th>
                    <th className="px-3 py-2">Fakultas</th>
                    <th className="px-3 py-2">Prodi</th>
                    <th className="px-3 py-2">Angkatan</th>
                    <th className="px-3 py-2">Skema</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-600">{s.nim}</td>
                        <td className="px-3 py-2 text-slate-900 font-medium">{s.fullName}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{s.nikMasked}</td>
                        <td className="px-3 py-2">{s.facultyName}</td>
                        <td className="px-3 py-2">{s.studyProgramName}</td>
                        <td className="px-3 py-2 font-mono">{s.entryYear}</td>
                        <td className="px-3 py-2">{s.serviceSchemeName}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {s.statusName}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    renderEmptyState(Boolean(searchQuery.trim()))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Laporan Registrasi */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Registrasi Semester</h2>
                <p className="text-[11px] text-slate-500">Rekapitulasi registrasi semester mahasiswa aktif</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("registrations")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Registrasi</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">No. Registrasi</th>
                    <th className="px-3 py-2">NIM & Mahasiswa</th>
                    <th className="px-3 py-2">Periode Akademik</th>
                    <th className="px-3 py-2">Prodi</th>
                    <th className="px-3 py-2">SKS</th>
                    <th className="px-3 py-2">Estimasi Tarif (Rp)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredRegistrations.length > 0 ? (
                    filteredRegistrations.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-600">{r.registrationNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NIM: {r.nim}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{r.academicPeriodName}</td>
                        <td className="px-3 py-2">{r.studyProgramName}</td>
                        <td className="px-3 py-2 font-mono">{r.totalSks}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-600">
                          Rp {r.feeEstimateAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    renderEmptyState(Boolean(searchQuery.trim()))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAGIHAN & PEMBAYARAN */}
      {activeTab === "tagihan" && !isAcademicAdmin && (
        <div className="space-y-6">
          {/* Laporan Tagihan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Invoice Tagihan Mahasiswa</h2>
                <p className="text-[11px] text-slate-500">Rincian tagihan invoice aktif, pembayaran teralokasi, dan sisa tagihan</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("invoices")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Tagihan</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">No. Invoice</th>
                    <th className="px-3 py-2">NIM & Mahasiswa</th>
                    <th className="px-3 py-2">Periode Akademik</th>
                    <th className="px-3 py-2">Total Tagihan (Rp)</th>
                    <th className="px-3 py-2">Terbayar (Rp)</th>
                    <th className="px-3 py-2">Sisa Tagihan (Rp)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{inv.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NIM: {inv.nim}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{inv.academicPeriodName}</td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          Rp {inv.invoiceTotalAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 font-bold">
                          Rp {inv.verifiedPaidAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-600 font-bold">
                          Rp {inv.remainingBalance.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              inv.paymentStatus === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : inv.paymentStatus === "partial"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {inv.paymentStatus === "paid" ? "Lunas" : inv.paymentStatus === "partial" ? "Sebagian" : "Belum Lunas"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    renderEmptyState(Boolean(searchQuery.trim()))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Laporan Piutang / Tunggakan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Piutang / Tunggakan Mahasiswa</h2>
                <p className="text-[11px] text-slate-500">Khusus invoice aktif yang masih memiliki sisa piutang (&gt; 0)</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("receivables")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Piutang</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">No. Invoice</th>
                    <th className="px-3 py-2">NIM & Mahasiswa</th>
                    <th className="px-3 py-2">Total Tagihan (Rp)</th>
                    <th className="px-3 py-2">Terbayar (Rp)</th>
                    <th className="px-3 py-2">Sisa Piutang (Rp)</th>
                    <th className="px-3 py-2">Jatuh Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredReceivables.length > 0 ? (
                    filteredReceivables.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-amber-600">{r.invoiceNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NIM: {r.nim}</div>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          Rp {r.invoiceTotalAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 font-bold">
                          Rp {r.verifiedPaidAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-600 font-bold">
                          Rp {r.remainingBalance.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {r.dueAt ? new Date(r.dueAt).toLocaleDateString("id-ID") : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    renderEmptyState(Boolean(searchQuery.trim()))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KEWAJIBAN UT */}
      {activeTab === "ut" && !isAcademicAdmin && (
        <div className="space-y-6">
          {/* Laporan Kewajiban UT Belum Disetor */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Kewajiban UT Belum Disetor (Outstanding UT)</h2>
                <p className="text-[11px] text-slate-500">Rincian LIP resmi terverifikasi dan sisa kewajiban yang belum disetor ke UT</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("ut-outstanding")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Outstanding UT</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">No. LIP</th>
                    <th className="px-3 py-2">No. Registrasi</th>
                    <th className="px-3 py-2">NIM & Mahasiswa</th>
                    <th className="px-3 py-2">Resmi UT (LIP)</th>
                    <th className="px-3 py-2">Disetor (Rp)</th>
                    <th className="px-3 py-2">Sisa Kewajiban UT (Rp)</th>
                    <th className="px-3 py-2">Status LIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredUtOutstanding.length > 0 ? (
                    filteredUtOutstanding.map((lip: any) => (
                      <tr key={lip.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-purple-600">{lip.lipNumber}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{lip.registrationNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{lip.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">NIM: {lip.nim}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-900 font-bold">
                          Rp {lip.officialAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 font-bold">
                          Rp {lip.verifiedUtPaid.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 font-mono text-red-600 font-bold">
                          Rp {lip.outstandingUtAmount.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {lip.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    renderEmptyState(Boolean(searchQuery.trim()))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OPERASIONAL & ARUS KAS */}
      {activeTab === "operasional" && !isAcademicAdmin && (
        <div className="space-y-6">
          {/* Laporan Arus Kas Sederhana */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Laporan Arus Kas Sederhana (Cash Flow)</h2>
                <p className="text-[11px] text-slate-500">Rekapitulasi Arus Kas Masuk (Inflow), Arus Kas Keluar (Outflow), dan Net Cash Movement</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv("cash-flow")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Arus Kas</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 border-b border-slate-200 pb-2">
                <span>TOTAL ARUS KAS MASUK (INFLOW)</span>
                <span className="font-mono text-sm">
                  Rp {reportsData.cashFlow.totalInflow.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="pl-4 space-y-1 text-slate-700 text-[11px]">
                <div className="flex justify-between">
                  <span>Penerimaan Mahasiswa Terverifikasi:</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rp {reportsData.cashFlow.verifiedStudentPayments.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pemasukan Operasional Terverifikasi:</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rp {reportsData.cashFlow.verifiedOperationalIncome.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-amber-700 border-b border-slate-200 pb-2 pt-2">
                <span>TOTAL ARUS KAS KELUAR (OUTFLOW)</span>
                <span className="font-mono text-sm">
                  Rp {reportsData.cashFlow.totalOutflow.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="pl-4 space-y-1 text-slate-700 text-[11px]">
                <div className="flex justify-between">
                  <span>Setoran UT Terverifikasi:</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rp {reportsData.cashFlow.verifiedUtRemittances.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pengeluaran Operasional Terverifikasi:</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rp {reportsData.cashFlow.verifiedOperationalExpense.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm font-bold text-blue-700 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1.5">
                  <span>PERGERAKAN ARUS KAS BERSIH (NET CASH MOVEMENT)</span>
                  <div className="group relative cursor-pointer">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-52 p-2 bg-white border border-slate-300 text-slate-700 text-[10px] rounded-lg shadow-xl z-20 font-normal">
                      Pergerakan kas bersih pada periode terpilih. Bukan laba/rugi.
                    </div>
                  </div>
                </div>
                <span className="font-mono text-base text-emerald-700 font-bold">
                  Rp {reportsData.cashFlow.netCashMovement.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
