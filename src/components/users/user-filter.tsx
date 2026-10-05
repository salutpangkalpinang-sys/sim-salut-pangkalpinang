"use client";

import { UserFilter } from "@/types/user";
import { RoleCode } from "@/lib/auth/types";
import { Search, Filter, RotateCcw } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface UserFilterBarProps {
  filter: UserFilter;
  onFilterChange: (newFilter: UserFilter) => void;
}

export function UserFilterBar({ filter, onFilterChange }: UserFilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, search: e.target.value });
  };

  const handleRoleChange = (val: string) => {
    onFilterChange({
      ...filter,
      role: val as RoleCode | "ALL",
    });
  };

  const handleStatusChange = (val: string) => {
    onFilterChange({
      ...filter,
      status: val as "ACTIVE" | "INACTIVE" | "ALL",
    });
  };

  const handleReset = () => {
    onFilterChange({ search: "", role: "ALL", status: "ALL" });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filter.search || ""}
          onChange={handleSearchChange}
          placeholder="Cari berdasarkan nama atau username/email..."
          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        {/* Filter Role */}
        <div className="flex items-center gap-1.5 w-52">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex-1">
            <SearchableSelect
              value={filter.role || "ALL"}
              onChange={handleRoleChange}
              placeholder="Semua Peran (Role)"
              options={[
                { value: "ALL", label: "Semua Peran (Role)" },
                { value: "owner", label: "Owner / Pimpinan" },
                { value: "admin", label: "Admin (Akses Penuh)" },
                { value: "academic_admin", label: "Admin Akademik" },
                { value: "finance_admin", label: "Admin Keuangan" },
                { value: "viewer", label: "Viewer / Auditor" },
              ]}
              triggerClassName="py-2 text-xs bg-slate-50"
            />
          </div>
        </div>

        {/* Filter Status */}
        <div className="w-40">
          <SearchableSelect
            value={filter.status || "ALL"}
            onChange={handleStatusChange}
            placeholder="Semua Status"
            options={[
              { value: "ALL", label: "Semua Status" },
              { value: "ACTIVE", label: "Status: Aktif" },
              { value: "INACTIVE", label: "Status: Nonaktif" },
            ]}
            triggerClassName="py-2 text-xs bg-slate-50"
          />
        </div>

        {/* Reset Filter Button */}
        {(filter.search || (filter.role && filter.role !== "ALL") || (filter.status && filter.status !== "ALL")) && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>
    </div>
  );
}
