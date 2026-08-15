"use client";

import { useState, useTransition } from "react";
import { AuditLogItem, AuditSummary, AuditFilter, PaginatedAuditResult } from "@/types/audit";
import { fetchAuditLogsAction, fetchAuditSummaryAction } from "@/features/audit/actions";
import { AuditSummaryCards } from "./audit-summary-cards";
import { AuditFilterBar } from "./audit-filter-bar";
import { AuditTable } from "./audit-table";
import { AuditDetailModal } from "./audit-detail-modal";
import { History, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditListContainerProps {
  initialResult: PaginatedAuditResult;
  initialSummary: AuditSummary;
}

export function AuditListContainer({
  initialResult,
  initialSummary,
}: AuditListContainerProps) {
  const [result, setResult] = useState<PaginatedAuditResult>(initialResult);
  const [summary, setSummary] = useState<AuditSummary>(initialSummary);
  const [filter, setFilter] = useState<AuditFilter>({
    search: "",
    module: "ALL",
    action: "ALL",
    role: "ALL",
    startDate: "",
    endDate: "",
    page: 1,
    pageSize: 15,
  });

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshData = (newFilter?: AuditFilter) => {
    const activeFilter = newFilter !== undefined ? newFilter : filter;
    startTransition(async () => {
      const [updatedResult, updatedSummary] = await Promise.all([
        fetchAuditLogsAction(activeFilter),
        fetchAuditSummaryAction(),
      ]);
      setResult(updatedResult as PaginatedAuditResult);
      setSummary(updatedSummary);
    });
  };

  const handleFilterChange = (newFilter: AuditFilter) => {
    setFilter(newFilter);
    refreshData(newFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= result.totalPages) {
      const updatedFilter = { ...filter, page: newPage };
      setFilter(updatedFilter);
      refreshData(updatedFilter);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Main Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0 font-bold">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Audit Log Global (Jejak Aktivitas Sistem)
            </h1>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Catatan histori transaksional dan aktivitas sensitif pengelola SALUT Pangkalpinang lintas seluruh modul akademik dan keuangan. Berada dalam perlindungan *Read-Only Immutability*.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refreshData()}
            disabled={isPending}
            className="px-3.5 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 font-medium"
            title="Refresh Data Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-purple-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <AuditSummaryCards summary={summary} />

      {/* Search & Filter Bar */}
      <AuditFilterBar filter={filter} onFilterChange={handleFilterChange} />

      {/* Audit Table */}
      <AuditTable logs={result.data} onSelectLog={(log) => setSelectedLog(log)} />

      {/* Server-Side Pagination Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Menampilkan <strong className="text-slate-900">{result.data.length}</strong> dari{" "}
          <strong className="text-slate-900">{result.totalCount}</strong> total entri audit
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(result.page - 1)}
            disabled={result.page <= 1 || isPending}
            className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-semibold text-slate-800 px-2 font-mono">
            Halaman {result.page} dari {result.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(result.page + 1)}
            disabled={result.page >= result.totalPages || isPending}
            className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Read-Only Detail Modal */}
      <AuditDetailModal
        item={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
