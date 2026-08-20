"use client";

import { useState, useRef, useEffect } from "react";
import { Search, UserCheck, X, ChevronDown, Check } from "lucide-react";

export interface StudentOption {
  id: string;
  nim: string | null;
  full_name: string;
  study_program_id: string | null;
  service_scheme_id: string | null;
}

interface StudentComboboxProps {
  students: StudentOption[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function StudentCombobox({
  students,
  value,
  onChange,
  placeholder = "Ketik Nama atau NIM Mahasiswa...",
  required = false,
}: StudentComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find((s) => s.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter students based on query (NIM or Name)
  const filteredStudents = students
    .filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const nameMatch = (s.full_name || "").toLowerCase().includes(q);
      const nimMatch = (s.nim || "").toLowerCase().includes(q);
      return nameMatch || nimMatch;
    })
    .slice(0, 50); // Limit to top 50 matches for instant response even with thousands of students

  const handleSelect = (studentId: string) => {
    onChange(studentId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
    setSearchQuery("");
    setIsOpen(true);
  };

  return (
    <div className="relative w-full text-xs" ref={containerRef}>
      {selectedStudent ? (
        // Selected State Card View
        <div className="flex items-center justify-between p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg shadow-xs transition hover:bg-blue-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-xs block truncate">
                {selectedStudent.full_name}
              </span>
              <span className="font-mono text-[11px] text-blue-700 font-semibold block">
                NIM: {selectedStudent.nim || "-"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
            title="Ganti / Cari Mahasiswa Lain"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Search Input State View
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              required={required && !value}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 font-medium"
            />
            <ChevronDown
              className={`w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Dropdown Options Box */}
          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-100">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Tidak ditemukan mahasiswa dengan nama/NIM <strong>&quot;{searchQuery}&quot;</strong>
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = s.id === value;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s.id)}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 transition flex items-center justify-between gap-2 ${
                        isSelected ? "bg-blue-50 text-blue-900 font-semibold" : "text-slate-800"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 block truncate">
                          {s.full_name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 block">
                          NIM: <strong className="text-blue-700 font-semibold">{s.nim || "-"}</strong>
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
