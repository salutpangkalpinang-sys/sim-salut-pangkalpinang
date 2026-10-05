"use client";

import { MasterOption } from "@/types/student";
import { Search, RotateCcw, Filter } from "lucide-react";
import { generateUtMasaOptions } from "@/lib/utils/ut-masa";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
          <SearchableSelect
            options={[
              { value: "", label: "Semua Fakultas" },
              ...options.faculties.map((f) => ({
                value: f.id,
                label: f.name,
                sublabel: f.code,
              })),
            ]}
            value={facultyId}
            onChange={(val) => {
              onFacultyChange(val);
              if (val && studyProgramId) {
                const prog = options.studyPrograms.find((p) => p.id === studyProgramId);
                if (prog && prog.faculty_id && prog.faculty_id !== val) {
                  onStudyProgramChange("");
                }
              }
            }}
            placeholder="Semua Fakultas"
            size="sm"
          />
        </div>

        {/* Program Studi Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Prodi" },
              ...(facultyId
                ? options.studyPrograms.filter((p) => !p.faculty_id || p.faculty_id === facultyId)
                : options.studyPrograms
              ).map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: p.code,
                badge: p.code,
              })),
            ]}
            value={studyProgramId}
            onChange={(val) => onStudyProgramChange(val)}
            placeholder="Semua Prodi"
            size="sm"
          />
        </div>

        {/* Angkatan / Masa UT Filter */}
        <div>
          <SearchableSelect
            options={[
              { value: "", label: "Semua Angkatan" },
              ...masaOptions.map((opt) => ({
                value: opt.value,
                label: opt.label,
                searchTerms: opt.value,
              })),
            ]}
            value={entryYear}
            onChange={(val) => onEntryYearChange(val)}
            placeholder="Semua Angkatan"
            size="sm"
          />
        </div>

        {/* Skema Layanan Filter */}
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
        {!isCalonView ? (
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-slate-500 whitespace-nowrap">Status:</span>
            <SearchableSelect
              options={[
                { value: "", label: "Semua Status" },
                ...options.statuses.map((st) => ({
                  value: st.id,
                  label: st.name,
                  sublabel: st.code,
                })),
              ]}
              value={statusId}
              onChange={(val) => onStatusChange(val)}
              placeholder="Semua Status"
              size="sm"
              className="w-full"
            />
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 min-w-[190px]">
          <span className="text-slate-500 whitespace-nowrap">Urutkan:</span>
          <SearchableSelect
            options={[
              { value: "createdAt", label: "Terbaru Didaftarkan" },
              { value: "fullName", label: "Nama (A-Z)" },
              ...(!isCalonView ? [{ value: "nim", label: "NIM" }] : []),
              { value: "entryYear", label: "Angkatan" },
            ]}
            value={sortBy}
            onChange={(val) => onSortByChange(val)}
            placeholder="Urutan..."
            size="sm"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
