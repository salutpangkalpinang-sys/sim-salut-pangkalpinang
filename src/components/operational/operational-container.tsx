"use client";

import { useState } from "react";
import { OperationalTransaction, OperationalCategory } from "@/types/operational";
import { OperationalTable } from "@/components/operational/operational-table";
import { OperationalFormModal } from "@/components/operational/operational-form-modal";
import { OperationalVoidDialog } from "@/components/operational/operational-void-dialog";
import { RoleCode } from "@/lib/auth/types";
import { Wallet, Search, RotateCcw, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface OperationalContainerProps {
  initialTransactions: OperationalTransaction[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  userRole: RoleCode;
  cashAccounts: { id: string; code: string; name: string }[];
  categories: OperationalCategory[];
}

export function OperationalContainer({
  initialTransactions,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  userRole,
  cashAccounts,
  categories,
}: OperationalContainerProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(initialPage);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDefaultType, setFormDefaultType] = useState<"income" | "expense">("expense");
  const [voidingTransaction, setVoidingTransaction] = useState<OperationalTransaction | null>(null);

  const canMutate = userRole === "owner" || userRole === "finance_admin";

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setPage(1);
    router.refresh();
  };

  const handleOpenForm = (type: "income" | "expense") => {
    setFormDefaultType(type);
    setIsFormOpen(true);
  };

  const filteredTransactions = initialTransactions.filter((t) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = t.transactionNumber.toLowerCase().includes(q);
      const descMatch = t.description.toLowerCase().includes(q);
      const refMatch = t.referenceNumber?.toLowerCase().includes(q) || false;
      if (!numMatch && !descMatch && !refMatch) return false;
    }
    if (typeFilter && t.transactionType !== typeFilter) return false;
    if (categoryFilter && t.categoryId !== categoryFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <span>Kas & Transaksi Operasional SALUT</span>
          </h1>
          <p className="text-xs text-slate-500">
            Pencatatan arus kas operasional (pemasukan & pengeluaran internal), verifikasi, dan audit transaksi
          </p>
        </div>

        {canMutate && (
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => handleOpenForm("income")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Pemasukan Operasional</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenForm("expense")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Pengeluaran Operasional</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No. Transaksi, Deskripsi, Ref..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCategoryFilter("");
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-xs"
          >
            <option value="">Semua Jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-xs"
          >
            <option value="">Semua Kategori</option>
            {categories
              .filter((c) => !typeFilter || c.transactionType === typeFilter)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.transactionType === "income" ? "Income" : "Expense"})
                </option>
              ))}
          </select>

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
      <OperationalTable
        transactions={filteredTransactions}
        total={initialTotal}
        page={page}
        limit={initialLimit}
        totalPages={initialTotalPages}
        userRole={userRole}
        onPageChange={(newPage) => setPage(newPage)}
        onRequestVoid={(txn) => setVoidingTransaction(txn)}
      />

      {/* Form Modal */}
      {isFormOpen && (
        <OperationalFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => router.refresh()}
          cashAccounts={cashAccounts}
          categories={categories}
          defaultType={formDefaultType}
        />
      )}

      {/* Void Dialog */}
      {voidingTransaction && (
        <OperationalVoidDialog
          transaction={voidingTransaction}
          isOpen={Boolean(voidingTransaction)}
          onClose={() => setVoidingTransaction(null)}
          onSuccess={() => router.refresh()}
          userRole={userRole}
        />
      )}
    </div>
  );
}
