"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface MaskedTextProps {
  text: string | null | undefined;
  allowToggle?: boolean;
  maskChar?: string;
  visibleStart?: number;
  visibleEnd?: number;
}

export function MaskedText({
  text,
  allowToggle = false,
  maskChar = "*",
  visibleStart = 4,
  visibleEnd = 4,
}: MaskedTextProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!text) {
    return <span className="text-slate-500 font-mono text-xs">-</span>;
  }

  if (text.length <= visibleStart + visibleEnd) {
    return <span className="font-mono text-xs">{text}</span>;
  }

  const masked =
    text.slice(0, visibleStart) +
    maskChar.repeat(text.length - visibleStart - visibleEnd) +
    text.slice(-visibleEnd);

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span>{isRevealed ? text : masked}</span>
      {allowToggle && (
        <button
          type="button"
          onClick={() => setIsRevealed(!isRevealed)}
          className="text-slate-400 hover:text-slate-200 transition p-0.5"
          title={isRevealed ? "Sembunyikan NIK" : "Tampilkan NIK lengkap"}
        >
          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </span>
  );
}
