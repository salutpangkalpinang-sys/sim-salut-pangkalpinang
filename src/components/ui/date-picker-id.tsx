"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

interface DatePickerIdProps {
  value: string; // Expects ISO format 'YYYY-MM-DD' or timestamp ISO string
  onChange: (isoValue: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

// Convert YYYY-MM-DD -> DD/MM/YYYY
function isoToDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const cleanIso = isoStr.split("T")[0]; // Remove time if present
  const parts = cleanIso.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y && m && d && y.length === 4) {
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }
  return "";
}

// Convert DD/MM/YYYY -> YYYY-MM-DD
function displayToIso(displayStr: string): string {
  if (!displayStr) return "";
  const parts = displayStr.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);

    if (
      !isNaN(day) &&
      !isNaN(month) &&
      !isNaN(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12 &&
      year >= 1900 &&
      year <= 2100
    ) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }
  return "";
}

export function DatePickerId({
  value,
  onChange,
  label,
  placeholder = "DD/MM/YYYY",
  required = false,
  disabled = false,
  className = "",
  id,
  name,
}: DatePickerIdProps) {
  const [displayText, setDisplayText] = useState(() => isoToDisplay(value));
  const nativePickerRef = useRef<HTMLInputElement>(null);

  // Sync external value -> display text
  useEffect(() => {
    setDisplayText(isoToDisplay(value));
  }, [value]);

  // Handle manual typing with smart masking
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, ""); // Keep digits only
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = "";
    if (raw.length > 0) {
      formatted = raw.slice(0, 2);
      if (raw.length > 2) {
        formatted += "/" + raw.slice(2, 4);
        if (raw.length > 4) {
          formatted += "/" + raw.slice(4, 8);
        }
      }
    }

    setDisplayText(formatted);

    // If fully typed DD/MM/YYYY (8 digits), parse and emit ISO
    if (raw.length === 8) {
      const iso = displayToIso(formatted);
      if (iso) {
        onChange(iso);
      }
    } else if (raw.length === 0) {
      onChange("");
    }
  };

  // Handle native calendar picker selection
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value;
    if (selectedIso) {
      setDisplayText(isoToDisplay(selectedIso));
      onChange(selectedIso);
    }
  };

  const isoValue = value ? value.split("T")[0] : "";

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-slate-700 font-medium mb-1 text-xs">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type="text"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={displayText}
          onChange={handleInputChange}
          className={`w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs font-mono tracking-wide ${
            disabled ? "bg-slate-100 cursor-not-allowed text-slate-400" : ""
          } ${className}`}
        />

        {/* Hidden Native Date Input for Calendar Picker */}
        <input
          ref={nativePickerRef}
          type="date"
          tabIndex={-1}
          disabled={disabled}
          value={isoValue}
          onChange={handleNativeChange}
          className="sr-only pointer-events-none absolute opacity-0 w-0 h-0"
        />

        {/* Calendar Icon Button to open native picker */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (nativePickerRef.current) {
              if (typeof nativePickerRef.current.showPicker === "function") {
                nativePickerRef.current.showPicker();
              } else {
                nativePickerRef.current.focus();
                nativePickerRef.current.click();
              }
            }
          }}
          className="absolute right-2 text-slate-400 hover:text-blue-600 p-1 rounded transition disabled:opacity-50"
          title="Pilih Tanggal dari Kalender"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
