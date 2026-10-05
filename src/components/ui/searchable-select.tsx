"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, Loader2, CheckCircle2 } from "lucide-react";

export interface SearchableSelectOption {
  value?: string | number;
  id?: string | number; // fallback alias for value
  label: string;
  sublabel?: string | null;
  badge?: string;
  searchTerms?: string | number;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  size?: "sm" | "md";
  colorScheme?: "blue" | "emerald" | "amber" | "purple" | "slate";
  className?: string;
  triggerClassName?: string;
  variant?: "default" | "card";
  id?: string;
}

export function SearchableSelect({
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  name,
  placeholder = "Pilih opsi...",
  searchPlaceholder = "Ketik untuk mencari...",
  emptyMessage = "Data tidak ditemukan",
  required = false,
  disabled = false,
  isLoading = false,
  isClearable,
  size = "md",
  colorScheme = "blue",
  className = "",
  triggerClassName = "",
  variant = "default",
  id,
}: SearchableSelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Normalize options: ensure each has value string
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => ({
      ...opt,
      resolvedValue: opt.value !== undefined ? String(opt.value) : opt.id !== undefined ? String(opt.id) : "",
    }));
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((o) => o.resolvedValue === value);
  }, [normalizedOptions, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return normalizedOptions.slice(0, 50);

    return normalizedOptions
      .filter((o) => {
        const labelMatch = (o.label || "").toLowerCase().includes(q);
        const sublabelMatch = o.sublabel ? String(o.sublabel).toLowerCase().includes(q) : false;
        const termsMatch = o.searchTerms !== undefined ? String(o.searchTerms).toLowerCase().includes(q) : false;
        const badgeMatch = (o.badge || "").toLowerCase().includes(q);
        const valueMatch = (o.resolvedValue || "").toLowerCase().includes(q);
        return labelMatch || sublabelMatch || termsMatch || badgeMatch || valueMatch;
      })
      .slice(0, 50); // limit for fast DOM render
  }, [normalizedOptions, searchQuery]);

  // Determine if clear button should be shown
  const canClear = useMemo(() => {
    if (disabled || isLoading) return false;
    if (isClearable !== undefined) return isClearable && !!value;
    return !required && !!value;
  }, [disabled, isLoading, isClearable, required, value]);

  // Calculate menu position with collision detection
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 260; // Estimated max height
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "bottom" | "top" = "bottom";
    let top = rect.bottom + 4;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      placement = "top";
      top = Math.max(8, rect.top - dropdownHeight - 4);
    }

    setMenuPosition({
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      placement,
    });
  }, []);

  // Update position when opened
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      // Small timeout to ensure portal is mounted
      const t = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 30);
      return () => clearTimeout(t);
    } else {
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  // Outside click handler
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    setInternalValue(val);
    onChange?.(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setInternalValue("");
    onChange?.("");
    setSearchQuery("");
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
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
          handleSelect(target.resolvedValue);
        }
      } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
        handleSelect(filteredOptions[0].resolvedValue);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const colorStyles = {
    blue: {
      ring: "focus:ring-blue-500 focus:border-blue-500",
      activeItem: "bg-blue-50 text-blue-900 font-semibold",
      activeIcon: "text-blue-600",
      highlightItem: "bg-blue-50/60",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      cardBg: "bg-blue-50/80 border-blue-200 hover:bg-blue-50",
      cardIconBg: "bg-blue-600 text-white",
      cardSubText: "text-blue-700 font-semibold",
    },
    emerald: {
      ring: "focus:ring-emerald-500 focus:border-emerald-500",
      activeItem: "bg-emerald-50 text-emerald-900 font-semibold",
      activeIcon: "text-emerald-600",
      highlightItem: "bg-emerald-50/60",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      cardBg: "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-50",
      cardIconBg: "bg-emerald-600 text-white",
      cardSubText: "text-emerald-700 font-semibold",
    },
    purple: {
      ring: "focus:ring-purple-500 focus:border-purple-500",
      activeItem: "bg-purple-50 text-purple-900 font-semibold",
      activeIcon: "text-purple-600",
      highlightItem: "bg-purple-50/60",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
      cardBg: "bg-purple-50/80 border-purple-200 hover:bg-purple-50",
      cardIconBg: "bg-purple-600 text-white",
      cardSubText: "text-purple-700 font-semibold",
    },
    amber: {
      ring: "focus:ring-amber-500 focus:border-amber-500",
      activeItem: "bg-amber-50 text-amber-900 font-semibold",
      activeIcon: "text-amber-600",
      highlightItem: "bg-amber-50/60",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      cardBg: "bg-amber-50/80 border-amber-200 hover:bg-amber-50",
      cardIconBg: "bg-amber-600 text-white",
      cardSubText: "text-amber-700 font-semibold",
    },
    slate: {
      ring: "focus:ring-slate-500 focus:border-slate-500",
      activeItem: "bg-slate-100 text-slate-900 font-semibold",
      activeIcon: "text-slate-700",
      highlightItem: "bg-slate-50",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      cardBg: "bg-slate-50 border-slate-200 hover:bg-slate-100",
      cardIconBg: "bg-slate-700 text-white",
      cardSubText: "text-slate-700 font-semibold",
    },
  }[colorScheme];

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg",
    md: "px-3 py-2 text-xs rounded-lg",
  }[size];

  // If variant="card" is requested and option is selected, render card view
  if (variant === "card" && selectedOption) {
    return (
      <div className={`relative w-full text-xs ${className}`}>
        {name && <input type="hidden" name={name} value={value} />}
        <div
          className={`flex items-center justify-between p-2.5 border rounded-lg shadow-xs transition ${colorStyles.cardBg}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold shrink-0 shadow-xs ${colorStyles.cardIconBg}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-xs block truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className={`font-mono text-[11px] block ${colorStyles.cardSubText}`}>
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
      </div>
    );
  }

  // Active highlighted option id for aria-activedescendant
  const activeDescendantId =
    highlightedIndex >= 0 && filteredOptions[highlightedIndex]
      ? `${listboxId}-opt-${highlightedIndex}`
      : undefined;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Hidden input for HTML form / Next.js Server Action */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? activeDescendantId : undefined}
        className={`w-full flex items-center justify-between gap-2 bg-white border border-slate-300 text-left transition focus:outline-none focus:ring-2 ${
          colorStyles.ring
        } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${sizeClasses} ${triggerClassName}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat...</span>
            </span>
          ) : selectedOption ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-medium text-slate-900 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border shrink-0 ${colorStyles.badge}`}>
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.sublabel && (
                <span className="font-mono text-[11px] text-slate-400 truncate hidden sm:inline">
                  ({selectedOption.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {canClear && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear();
                }
              }}
              title="Reset Pilihan"
              className="p-0.5 hover:text-red-500 hover:bg-slate-100 rounded transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Required validator hook: if required and empty, invisible input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: "absolute", pointerEvents: "none" }}
          value={value}
          required={required}
          onChange={() => {}}
        />
      )}

      {/* Floating Dropdown Portal */}
      {isOpen &&
        menuPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${Math.max(menuPosition.width, 180)}px`,
              zIndex: 9999,
            }}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 text-xs"
          >
            {/* Search Input Box */}
            <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  {emptyMessage} {searchQuery ? `"${searchQuery}"` : ""}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.resolvedValue === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <button
                      key={`${opt.resolvedValue}-${idx}`}
                      id={`${listboxId}-opt-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.resolvedValue)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? colorStyles.activeItem
                          : isHighlighted
                          ? colorStyles.highlightItem
                          : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold block truncate">
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <span className="font-mono text-[11px] text-slate-500 block truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className={`w-3.5 h-3.5 shrink-0 ${colorStyles.activeIcon}`} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
