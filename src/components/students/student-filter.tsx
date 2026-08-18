"use client";

import { MasterOption } from "@/types/student";
import { Search, RotateCcw, Filter } from "lucide-react";
import { generateUtMasaOptions } from "@/lib/utils/ut-masa";

interface StudentFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  facultyId: string;
  onFacultyChange: (value: string) => void;
  studyProgramId: string;
  onStudyProgramChange: (value: string) => void;
  entryYear: string;
  onEntryYearChange: (value: string) => void;
  serviceSchemeId: string;
  onServiceSchemeChange: (value: string) => void;
  statusId: string;
  onStatusChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  onReset: () => void;
  options: {
    faculties: MasterOption[];
    studyLevels: MasterOption[];
    studyPrograms: (MasterOption & { faculty_id?: string; study_level_id?: string })[];
    serviceSchemes: MasterOption[];
    statuses: MasterOption[];
  };
  isCalonView?: boolean;
}

export function StudentFilter({
  search,
  onSearchChange,
  facultyId,
  onFacultyChange,
  studyProgramId,
  onStudyProgramChange,
  entryYear,
  onEntryYearChange,
  serviceSchemeId,
  onServiceSchemeChange,
  statusId,
  onStatusChange,
  sortBy,
  onSortByChange,
  onReset,
  options,
  isCalonView = false,
}: StudentFilterProps) {
  const masaOptions = generateUtMasaOptions(2021, 2030);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Pencarian & Filter Data</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NIM, NIK..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Fakultas Filter */}
        <div>
          <select
            value={facultyId}
            onChange={(e) => onFacultyChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Fakultas</option>
            {options.faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
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
            {options.studyPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Angkatan / Masa UT Filter */}
        <div>
          <select
            value={entryYear}
            onChange={(e) => onEntryYearChange(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">Semua Angkatan</option>
            {masaOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Skema Layanan Filter */}
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
        {!isCalonView ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusId}
              onChange={(e) => onStatusChange(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">Semua Status</option>
              {options.statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Urutkan:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="createdAt">Terbaru Didaftarkan</option>
            <option value="fullName">Nama (A-Z)</option>
            {!isCalonView && <option value="nim">NIM</option>}
            <option value="entryYear">Angkatan</option>
          </select>
        </div>
      </div>
    </div>
  );
}
