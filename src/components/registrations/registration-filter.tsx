"use client";

import { RegistrationType } from "@/types/registration";
import { Search, RotateCcw, Filter } from "lucide-react";

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
          <select
            value={academicPeriodId}
            onChange={(e) => onAcademicPeriodChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Periode</option>
            {options.academicPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Jenis Registrasi Filter */}
        <div>
          <select
            value={registrationTypeId}
            onChange={(e) => onRegistrationTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Jenis Registrasi</option>
            {options.registrationTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Program Studi Filter */}
        <div>
          <select
            value={studyProgramId}
            onChange={(e) => onStudyProgramChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Prodi</option>
            {options.studyPrograms.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </select>
        </div>

        {/* Skema Filter */}
        <div>
          <select
            value={serviceSchemeId}
            onChange={(e) => onServiceSchemeChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Skema</option>
            {options.serviceSchemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Status Registrasi:</span>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>
    </div>
  );
}
