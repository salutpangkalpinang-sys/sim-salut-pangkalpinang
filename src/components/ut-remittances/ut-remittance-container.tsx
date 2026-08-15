"use client";

import { useState } from "react";
import { UtRemittance, EligibleLipForRemittance } from "@/types/ut-remittance";
import { UtRemittanceTable } from "@/components/ut-remittances/ut-remittance-table";
import { UtRemittanceFormModal } from "@/components/ut-remittances/ut-remittance-form-modal";
import { UtRemittanceVoidDialog } from "@/components/ut-remittances/ut-remittance-void-dialog";
import { RoleCode } from "@/lib/auth/types";
import { Building2, Plus, Search, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface UtRemittanceContainerProps {
  initialRemittances: UtRemittance[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  userRole: RoleCode;
  cashAccounts: { id: string; code: string; name: string }[];
  eligibleLips: EligibleLipForRemittance[];
}

export function UtRemittanceContainer({
  initialRemittances,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  userRole,
  cashAccounts,
  eligibleLips,
}: UtRemittanceContainerProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(initialPage);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [voidingRemittance, setVoidingRemittance] = useState<UtRemittance | null>(null);

  const canMutate = userRole === "owner" || userRole === "finance_admin";

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
    router.refresh();
  };

  const filteredRemittances = initialRemittances.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = r.remittanceNumber.toLowerCase().includes(q);
      const refMatch = r.referenceNumber?.toLowerCase().includes(q) || false;
      if (!numMatch && !refMatch) return false;
    }
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Setoran / Pembayaran SALUT ke UT</span>
          </h1>
          <p className="text-xs text-slate-500">
            Pencatatan penyetoran uang resmi kewajiban UT per dokumen LIP, verifikasi, dan audit kewajiban UT
          </p>
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Setoran UT Baru</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No. Setoran UT, Ref..."
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
            <option value="pending_verification">Menunggu Verifikasi</option>
            <option value="verified">Terverifikasi</option>
            <option value="rejected">Ditolak</option>
            <option value="voided">Dibatalkan (Void)</option>
          </select>

          <button
            type="button"
            onClick={handleResetFilters}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-lg transition shadow-xs"
            title="Reset Filter"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table Component */}
      <UtRemittanceTable
        remittances={filteredRemittances}
        total={initialTotal}
        page={page}
        limit={initialLimit}
        totalPages={initialTotalPages}
        userRole={userRole}
        onPageChange={(newPage) => setPage(newPage)}
        onRequestVoid={(rem) => setVoidingRemittance(rem)}
      />

      {/* Form Modal */}
      {isFormOpen && (
        <UtRemittanceFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => router.refresh()}
          cashAccounts={cashAccounts}
          eligibleLips={eligibleLips}
        />
      )}

      {/* Void Dialog */}
      {voidingRemittance && (
        <UtRemittanceVoidDialog
          remittance={voidingRemittance}
          isOpen={Boolean(voidingRemittance)}
          onClose={() => setVoidingRemittance(null)}
          onSuccess={() => router.refresh()}
          userRole={userRole}
        />
      )}
    </div>
  );
}
