"use client";

import { RegistrationType } from "@/types/registration";
import { Search, RotateCcw, Filter } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface RegistrationFilterProps {
  search: string;
  onSearchChange: (val: string) => void;
  academicPeriodId: string;
  onAcademicPeriodChange: (val: string) => void;
  registrationTypeId: string;
  onRegistrationTypeChange: (val: string) => void;
  studyProgramId: string;
  onStudyProgramChange: (val: string) => void;
  serviceSchemeId: string;
  onServiceSchemeChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  onReset: () => void;
  options: {
    academicPeriods: { id: string; code: string; name: string }[];
    registrationTypes: RegistrationType[];
    studyPrograms: { id: string; code: string; name: string }[];
    serviceSchemes: { id: string; code: string; name: string }[];
  };
}

export function RegistrationFilter({
  search,
  onSearchChange,
  academicPeriodId,
  onAcademicPeriodChange,
  registrationTypeId,
  onRegistrationTypeChange,
  studyProgramId,
  onStudyProgramChange,
  serviceSchemeId,
  onServiceSchemeChange,
  status,
  onStatusChange,
  onReset,
  options,
}: RegistrationFilterProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Filter Registrasi Semester</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Filter</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Search Input */}
        <div className="lg:col-span-2 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari No. Registrasi, NIM, Nama..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Periode Akademik Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Periode" },
              ...options.academicPeriods.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: p.code,
              })),
            ]}
            value={academicPeriodId}
            onChange={(val) => onAcademicPeriodChange(val)}
            placeholder="Semua Periode"
            size="sm"
          />
        </div>

        {/* Jenis Registrasi Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Jenis Registrasi" },
              ...options.registrationTypes.map((t) => ({
                value: t.id,
                label: t.name,
                sublabel: t.code,
              })),
            ]}
            value={registrationTypeId}
            onChange={(val) => onRegistrationTypeChange(val)}
            placeholder="Semua Jenis"
            size="sm"
          />
        </div>

        {/* Program Studi Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Prodi" },
              ...options.studyPrograms.map((pr) => ({
                value: pr.id,
                label: pr.name,
                sublabel: pr.code,
                badge: pr.code,
              })),
            ]}
            value={studyProgramId}
            onChange={(val) => onStudyProgramChange(val)}
            placeholder="Semua Prodi"
            size="sm"
          />
        </div>

        {/* Skema Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Skema" },
              ...options.serviceSchemes.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.code,
              })),
            ]}
            value={serviceSchemeId}
            onChange={(val) => onServiceSchemeChange(val)}
            placeholder="Semua Skema"
            size="sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className="text-slate-500 whitespace-nowrap">Status Registrasi:</span>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Status" },
              { value: "active", label: "Aktif" },
              { value: "draft", label: "Draft" },
              { value: "cancelled", label: "Dibatalkan" },
            ]}
            value={status}
            onChange={(val) => onStatusChange(val)}
            placeholder="Semua Status"
            size="sm"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
