"use client";

import { useState } from "react";
import { StudentPayment } from "@/types/payment";
import { PaymentTable } from "@/components/payments/payment-table";
import { PaymentFormModal } from "@/components/payments/payment-form-modal";
import { VoidRequestDialog } from "@/components/payments/void-request-dialog";
import { RoleCode } from "@/lib/auth/types";
import { CreditCard, Plus, Search, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface PaymentListContainerProps {
  initialPayments: StudentPayment[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  userRole: RoleCode;
  options: {
    paymentMethods: { id: string; code: string; name: string; requires_reference: boolean }[];
    cashAccounts: { id: string; code: string; name: string }[];
    invoices: {
      id: string;
      invoiceNumber: string;
      studentId: string;
      studentName: string;
      studentNim: string | null;
      registrationNumber: string;
      invoiceTotalAmount: number;
      verifiedPaid: number;
      remainingBalance: number;
    }[];
  };
  initialStatusFilter?: string;
}

export function PaymentListContainer({
  initialPayments,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  userRole,
  options,
  initialStatusFilter,
}: PaymentListContainerProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "");
  const [methodFilter, setMethodFilter] = useState("");
  const [page, setPage] = useState(initialPage);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<StudentPayment | null>(null);

  const canMutate = userRole === "owner" || userRole === "academic_admin";

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setMethodFilter("");
    setPage(1);
    router.refresh();
  };

  const filteredPayments = initialPayments.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = p.transactionNumber.toLowerCase().includes(q);
      const nameMatch = p.studentName?.toLowerCase().includes(q) || false;
      const refMatch = p.referenceNumber?.toLowerCase().includes(q) || false;
      if (!numMatch && !nameMatch && !refMatch) return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (methodFilter && p.paymentMethodId !== methodFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>Pembayaran Mahasiswa & Verifikasi</span>
          </h1>
          <p className="text-xs text-slate-500">
            Pencatatan penerimaan pembayaran, verifikasi kasir, alokasi tagihan invoice, dan pencetakan kuitansi
          </p>
        </div>

        {canMutate && (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pembayaran Baru</span>
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
            placeholder="Cari No. Transaksi, NIM, Nama, Ref..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-xs"
          >
            <option value="">Semua Metode</option>
            {options.paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-xs"
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
      <PaymentTable
        payments={filteredPayments}
        total={initialTotal}
        page={page}
        limit={initialLimit}
        totalPages={initialTotalPages}
        userRole={userRole}
        onPageChange={(newPage) => setPage(newPage)}
        onRequestVoid={(p) => setVoidingPayment(p)}
      />

      {/* Payment Form Modal */}
      {isFormOpen && (
        <PaymentFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => router.refresh()}
          options={options}
        />
      )}

      {/* Void Request Dialog */}
      {voidingPayment && (
        <VoidRequestDialog
          payment={voidingPayment}
          isOpen={Boolean(voidingPayment)}
          onClose={() => setVoidingPayment(null)}
          onSuccess={() => router.refresh()}
          userRole={userRole}
        />
      )}
    </div>
  );
}
