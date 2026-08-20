"use client";

import { useState, useRef, useEffect } from "react";
import { Search, CheckCircle2, X, ChevronDown, Check } from "lucide-react";

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  searchTerms?: string;
  disabled?: boolean;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
  selectedColor?: "blue" | "emerald" | "amber";
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Ketik untuk mencari...",
  required = false,
  emptyText = "Tidak ada hasil pencarian yang cocok",
  selectedColor = "blue",
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

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

  // Filter options based on query
  const filteredOptions = options
    .filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const labelMatch = (o.label || "").toLowerCase().includes(q);
      const sublabelMatch = (o.sublabel || "").toLowerCase().includes(q);
      const searchTermsMatch = (o.searchTerms || "").toLowerCase().includes(q);
      return labelMatch || sublabelMatch || searchTermsMatch;
    })
    .slice(0, 50); // Limit to top 50 for max performance with thousands of records

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
    setSearchQuery("");
    setIsOpen(true);
  };

  const colorStyles = {
    blue: {
      bg: "bg-blue-50/80 border-blue-200 hover:bg-blue-50",
      iconBg: "bg-blue-600 text-white",
      subText: "text-blue-700 font-semibold",
      activeItem: "bg-blue-50 text-blue-900 font-semibold",
      activeIcon: "text-blue-600",
      ring: "focus:ring-blue-500",
    },
    emerald: {
      bg: "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-50",
      iconBg: "bg-emerald-600 text-white",
      subText: "text-emerald-700 font-semibold",
      activeItem: "bg-emerald-50 text-emerald-900 font-semibold",
      activeIcon: "text-emerald-600",
      ring: "focus:ring-emerald-500",
    },
    amber: {
      bg: "bg-amber-50/80 border-amber-200 hover:bg-amber-50",
      iconBg: "bg-amber-600 text-white",
      subText: "text-amber-700 font-semibold",
      activeItem: "bg-amber-50 text-amber-900 font-semibold",
      activeIcon: "text-amber-600",
      ring: "focus:ring-amber-500",
    },
  }[selectedColor];

  return (
    <div className="relative w-full text-xs" ref={containerRef}>
      {selectedOption ? (
        // Selected State View
        <div className={`flex items-center justify-between p-2.5 border rounded-lg shadow-xs transition ${colorStyles.bg}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold shrink-0 shadow-xs ${colorStyles.iconBg}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-xs block truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className={`font-mono text-[11px] block ${colorStyles.subText}`}>
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
            title="Ganti Pilihan"
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
              className={`w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 ${colorStyles.ring} focus:outline-none placeholder:text-slate-400 font-medium`}
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
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  {emptyText} &quot;<strong>{searchQuery}</strong>&quot;
                </div>
              ) : (
                filteredOptions.map((o) => {
                  const isSelected = o.id === value;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={o.disabled}
                      onClick={() => handleSelect(o.id)}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected ? colorStyles.activeItem : "text-slate-800"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 block truncate">
                            {o.label}
                          </span>
                          {o.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {o.badge}
                            </span>
                          )}
                        </div>
                        {o.sublabel && (
                          <span className="font-mono text-[11px] text-slate-500 block">
                            {o.sublabel}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className={`w-4 h-4 shrink-0 ${colorStyles.activeIcon}`} />}
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
