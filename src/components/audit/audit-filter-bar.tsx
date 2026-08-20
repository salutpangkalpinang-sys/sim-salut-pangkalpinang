"use client";

import { AuditFilter } from "@/types/audit";
import { RoleCode } from "@/lib/auth/types";
import { Search, Filter, RotateCcw } from "lucide-react";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface AuditFilterBarProps {
  filter: AuditFilter;
  onFilterChange: (newFilter: AuditFilter) => void;
}

export function AuditFilterBar({ filter, onFilterChange }: AuditFilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, search: e.target.value, page: 1 });
  };

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filter, module: e.target.value, page: 1 });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filter, role: e.target.value as RoleCode | "ALL", page: 1 });
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
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filter.module || "ALL"}
              onChange={handleModuleChange}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            >
              <option value="ALL">Semua Modul</option>
              <option value="user_management">Pengguna & Hak Akses</option>
              <option value="academic_student">Akademik & Mahasiswa</option>
              <option value="registration">Registrasi Semester</option>
              <option value="lip_invoice">LIP & Tagihan</option>
              <option value="payments">Pembayaran Mahasiswa</option>
              <option value="ut_remittances">Setoran UT</option>
              <option value="operational">Kas & Operasional</option>
            </select>
          </div>

          {/* Role Filter */}
          <select
            value={filter.role || "ALL"}
            onChange={handleRoleChange}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          >
            <option value="ALL">Semua Peran Actor</option>
            <option value="owner">Owner / Pimpinan</option>
            <option value="academic_admin">Admin Akademik</option>
            <option value="finance_admin">Admin Keuangan</option>
            <option value="viewer">Viewer / Auditor</option>
          </select>

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
