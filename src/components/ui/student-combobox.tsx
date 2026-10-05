"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const generatedId = useId();
  const listboxId = `student-combobox-${generatedId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find((s) => s.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
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

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 4;
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - dropdownHeight - 4);
    }

    setMenuPosition({
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  const handleSelect = (studentId: string) => {
    onChange(studentId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
    setSearchQuery("");
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredStudents.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredStudents.length) {
        handleSelect(filteredStudents[highlightedIndex].id);
      } else if (filteredStudents.length === 1) {
        handleSelect(filteredStudents[0].id);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const activeDescendantId =
    highlightedIndex >= 0 && filteredStudents[highlightedIndex]
      ? `${listboxId}-opt-${highlightedIndex}`
      : undefined;

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
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
              required={required && !value}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => {
                setIsOpen(true);
                updatePosition();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 font-medium"
            />
            <ChevronDown
              className={`w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Floating Dropdown Options Box using Portal */}
          {isOpen &&
            menuPosition &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                tabIndex={-1}
                style={{
                  position: "fixed",
                  top: `${menuPosition.top}px`,
                  left: `${menuPosition.left}px`,
                  width: `${menuPosition.width}px`,
                  zIndex: 9999,
                }}
                className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-100 text-xs"
              >
                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    Tidak ditemukan mahasiswa dengan nama/NIM <strong>&quot;{searchQuery}&quot;</strong>
                  </div>
                ) : (
                  filteredStudents.map((s, idx) => {
                    const isSelected = s.id === value;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <button
                        key={s.id}
                        id={`${listboxId}-opt-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(s.id)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full text-left px-3.5 py-2.5 transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-blue-50 text-blue-900 font-semibold"
                            : isHighlighted
                            ? "bg-slate-50 font-medium text-slate-900"
                            : "hover:bg-blue-50/70 text-slate-800"
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
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
}
