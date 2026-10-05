"use client";

import { AuditFilter } from "@/types/audit";
import { RoleCode } from "@/lib/auth/types";
import { Search, Filter, RotateCcw } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface AuditFilterBarProps {
  filter: AuditFilter;
  onFilterChange: (newFilter: AuditFilter) => void;
}

export function AuditFilterBar({ filter, onFilterChange }: AuditFilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, search: e.target.value, page: 1 });
  };

  const handleModuleChange = (val: string) => {
    onFilterChange({ ...filter, module: val, page: 1 });
  };

  const handleRoleChange = (val: string) => {
    onFilterChange({ ...filter, role: val as RoleCode | "ALL", page: 1 });
  };

  const handleReset = () => {
    onFilterChange({
      search: "",
      module: "ALL",
      role: "ALL",
      startDate: "",
      endDate: "",
      page: 1,
      pageSize: 15,
    });
  };

  const hasActiveFilters = Boolean(
    filter.search ||
      (filter.module && filter.module !== "ALL") ||
      (filter.role && filter.role !== "ALL") ||
      filter.startDate ||
      filter.endDate
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 text-xs">
      {/* Top Bar: Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filter.search || ""}
          onChange={handleSearchChange}
          placeholder="Cari berdasarkan nama pengguna, email, entity ID, atau kata kunci ringkasan..."
          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
        />
      </div>

      {/* Bottom Bar: Filters & Date Pickers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Module Filter */}
          <div className="flex items-center gap-1 min-w-[200px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <SearchableSelect
              options={[
                { value: "ALL", label: "Semua Modul" },
                { value: "user_management", label: "Pengguna & Hak Akses" },
                { value: "academic_student", label: "Akademik & Mahasiswa" },
                { value: "registration", label: "Registrasi Semester" },
                { value: "lip_invoice", label: "LIP & Tagihan" },
                { value: "payments", label: "Pembayaran Mahasiswa" },
                { value: "ut_remittances", label: "Setoran UT" },
                { value: "operational", label: "Kas & Operasional" },
              ]}
              value={filter.module || "ALL"}
              onChange={handleModuleChange}
              placeholder="Pilih Modul..."
              size="sm"
              colorScheme="purple"
              className="w-full"
            />
          </div>

          {/* Role Filter */}
          <div className="min-w-[170px]">
            <SearchableSelect
              options={[
                { value: "ALL", label: "Semua Peran Actor" },
                { value: "owner", label: "Owner / Pimpinan" },
                { value: "academic_admin", label: "Admin Akademik" },
                { value: "finance_admin", label: "Admin Keuangan" },
                { value: "viewer", label: "Viewer / Auditor" },
              ]}
              value={filter.role || "ALL"}
              onChange={handleRoleChange}
              placeholder="Pilih Peran..."
              size="sm"
              colorScheme="purple"
              className="w-full"
            />
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg p-1">
            <DatePickerId
              value={filter.startDate || ""}
              onChange={(iso) => onFilterChange({ ...filter, startDate: iso, page: 1 })}
              placeholder="Dari Tgl"
              className="w-28 py-1 px-2 text-[11px]"
            />
            <span className="text-slate-400 font-mono text-[11px]">-</span>
            <DatePickerId
              value={filter.endDate || ""}
              onChange={(iso) => onFilterChange({ ...filter, endDate: iso, page: 1 })}
              placeholder="Sampai Tgl"
              className="w-28 py-1 px-2 text-[11px]"
            />
          </div>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition font-medium ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>
    </div>
  );
}
