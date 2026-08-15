"use client";

import { useState } from "react";
import { LipDocument, Invoice } from "@/types/lip-invoice";
import { LipTable } from "@/components/lip-invoices/lip-table";
import { InvoiceTable } from "@/components/lip-invoices/invoice-table";
import { LipFormModal } from "@/components/lip-invoices/lip-form-modal";
import { InvoiceFormModal } from "@/components/lip-invoices/invoice-form-modal";
import { RoleCode } from "@/lib/auth/types";
import { FileText, Receipt, Plus, Search, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface LipInvoiceContainerProps {
  initialLips: LipDocument[];
  initialLipTotal: number;
  initialInvoices: Invoice[];
  initialInvoiceTotal: number;
  userRole: RoleCode;
  registrationsOptions: { id: string; registrationNumber: string; studentName: string; studentNim: string | null; academicPeriodName: string }[];
}

export function LipInvoiceContainer({
  initialLips,
  initialLipTotal,
  initialInvoices,
  initialInvoiceTotal,
  userRole,
  registrationsOptions,
}: LipInvoiceContainerProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"lip" | "invoice">("lip");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isLipModalOpen, setIsLipModalOpen] = useState(false);
  const [selectedLipForInvoice, setSelectedLipForInvoice] = useState<LipDocument | null>(null);

  const canMutate = userRole === "owner" || userRole === "academic_admin";

  const filteredLips = initialLips.filter((lip) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = lip.lipNumber.toLowerCase().includes(q);
      const nameMatch = lip.studentName?.toLowerCase().includes(q) || false;
      const regMatch = lip.registrationNumber?.toLowerCase().includes(q) || false;
      if (!numMatch && !nameMatch && !regMatch) return false;
    }
    if (statusFilter && lip.status !== statusFilter) return false;
    return true;
  });

  const filteredInvoices = initialInvoices.filter((inv) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = inv.invoiceNumber.toLowerCase().includes(q);
      const nameMatch = inv.studentName?.toLowerCase().includes(q) || false;
      const lipMatch = inv.lipNumber?.toLowerCase().includes(q) || false;
      if (!numMatch && !nameMatch && !lipMatch) return false;
    }
    if (statusFilter && inv.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Tabs Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>LIP & Tagihan Mahasiswa</span>
          </h1>
          <p className="text-xs text-slate-500">
            Kelola dokumen Lembar Informasi Pembayaran (LIP) UT dan tagihan invoice internal mahasiswa
          </p>
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={() => setIsLipModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Unggah Dokumen LIP Baru</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-slate-200 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setActiveTab("lip");
            setStatusFilter("");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "lip"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Dokumen LIP UT ({initialLipTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("invoice");
            setStatusFilter("");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "invoice"
              ? "border-emerald-600 text-emerald-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Tagihan Invoice ({initialInvoiceTotal})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "lip" ? "Cari No. LIP, NIM, Nama..." : "Cari No. Invoice, NIM, Nama..."}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-xs"
          >
            <option value="">Semua Status</option>
            {activeTab === "lip" ? (
              <>
                <option value="pending_verification">Menunggu Verifikasi</option>
                <option value="verified">Terverifikasi</option>
                <option value="cancelled">Dibatalkan</option>
              </>
            ) : (
              <>
                <option value="unpaid">Belum Dibayar</option>
                <option value="paid">Lunas</option>
                <option value="cancelled">Dibatalkan</option>
              </>
            )}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-lg transition shadow-xs"
            title="Reset Filter"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === "lip" ? (
        <LipTable
          lipDocuments={filteredLips}
          total={initialLipTotal}
          page={1}
          limit={50}
          totalPages={1}
          userRole={userRole}
          onPageChange={() => {}}
          onCreateInvoice={(lip) => setSelectedLipForInvoice(lip)}
        />
      ) : (
        <InvoiceTable
          invoices={filteredInvoices}
          total={initialInvoiceTotal}
          page={1}
          limit={50}
          totalPages={1}
          onPageChange={() => {}}
        />
      )}

      {/* Upload LIP Modal */}
      {isLipModalOpen && (
        <LipFormModal
          isOpen={isLipModalOpen}
          onClose={() => setIsLipModalOpen(false)}
          onSuccess={() => router.refresh()}
          registrationsOptions={registrationsOptions}
        />
      )}

      {/* Create Invoice Modal */}
      {selectedLipForInvoice && (
        <InvoiceFormModal
          lipDocument={selectedLipForInvoice}
          isOpen={Boolean(selectedLipForInvoice)}
          onClose={() => setSelectedLipForInvoice(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
