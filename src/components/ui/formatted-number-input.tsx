"use client";

import React, { useState, useEffect } from "react";

interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  onChange: (val: number) => void;
  prefix?: string;
  max?: number;
  min?: number;
}

/**
 * Custom Input Component with automatic Indonesian Thousand Separator formatting (e.g. 646.000)
 */
export function FormattedNumberInput({
  value,
  onChange,
  prefix,
  max,
  min,
  className = "",
  placeholder = "0",
  disabled,
  ...props
}: FormattedNumberInputProps) {
  const formatDisplay = (num: number): string => {
    if (isNaN(num) || num === 0) return "";
    return num.toLocaleString("id-ID");
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatDisplay(value));

  useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, "");

    if (!digitsOnly) {
      setDisplayValue("");
      onChange(0);
      return;
    }

    let parsed = parseInt(digitsOnly, 10);
    if (isNaN(parsed)) parsed = 0;

    if (max !== undefined && parsed > max) {
      parsed = max;
    }

    if (min !== undefined && parsed < min && digitsOnly.length > 0) {
      // Allow user to type, but don't force min until blurred if needed
    }

    setDisplayValue(formatDisplay(parsed));
    onChange(parsed);
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-2.5 text-slate-500 font-mono font-medium text-xs pointer-events-none select-none z-10">
          {prefix}
        </span>
      )}
      <input
        {...props}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${prefix ? "pl-8" : ""} ${className}`}
      />
    </div>
  );
}
