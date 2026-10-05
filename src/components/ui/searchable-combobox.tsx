"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, CheckCircle2, X, ChevronDown, Check } from "lucide-react";

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  searchTerms?: string;
  disabled?: boolean;
}

export interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
  selectedColor?: "blue" | "emerald" | "amber";
  disabled?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  name,
  placeholder = "Ketik untuk mencari...",
  required = false,
  emptyText = "Tidak ada hasil pencarian yang cocok",
  selectedColor = "blue",
  disabled = false,
}: SearchableComboboxProps) {
  const generatedId = useId();
  const comboboxId = `combobox-${generatedId}`;
  const listboxId = `${comboboxId}-listbox`;

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

  const selectedOption = options.find((o) => o.id === value);

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

  // Update floating position
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

  // Scroll active into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
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
    if (disabled) return;

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
      setHighlightedIndex((prev) => {
        let next = prev + 1;
        while (next < filteredOptions.length && filteredOptions[next].disabled) {
          next++;
        }
        return next < filteredOptions.length ? next : prev;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && filteredOptions[next].disabled) {
          next--;
        }
        return next >= 0 ? next : 0;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const target = filteredOptions[highlightedIndex];
        if (!target.disabled) {
          handleSelect(target.id);
        }
      } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
        handleSelect(filteredOptions[0].id);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
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

  const activeDescendantId =
    highlightedIndex >= 0 && filteredOptions[highlightedIndex]
      ? `${listboxId}-opt-${highlightedIndex}`
      : undefined;

  return (
    <div className="relative w-full text-xs" ref={containerRef}>
      {name && <input type="hidden" name={name} value={value} />}

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
            disabled={disabled}
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
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
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
              disabled={disabled}
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
              className={`w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 ${colorStyles.ring} focus:outline-none placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
            />
            <ChevronDown
              className={`w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Floating Dropdown Options Box using Portal to prevent clipping */}
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
                {filteredOptions.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    {emptyText} &quot;<strong>{searchQuery}</strong>&quot;
                  </div>
                ) : (
                  filteredOptions.map((o, idx) => {
                    const isSelected = o.id === value;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <button
                        key={o.id}
                        id={`${listboxId}-opt-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={o.disabled}
                        disabled={o.disabled}
                        onClick={() => handleSelect(o.id)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSelected
                            ? colorStyles.activeItem
                            : isHighlighted
                            ? "bg-slate-50 font-medium"
                            : "text-slate-800"
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
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
}
