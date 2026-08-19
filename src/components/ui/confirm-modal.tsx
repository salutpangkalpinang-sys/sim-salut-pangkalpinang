"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, Loader2 } from "lucide-react";

export type ConfirmVariant = "info" | "warning" | "danger" | "success";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = "warning",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const VARIANT_STYLES: Record<
    ConfirmVariant,
    { iconBg: string; btnColor: string; icon: React.ReactNode }
  > = {
    info: {
      iconBg: "bg-blue-50 border-blue-100 text-blue-600",
      btnColor: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500",
      icon: <Info className="w-6 h-6 text-blue-600" />,
    },
    warning: {
      iconBg: "bg-amber-50 border-amber-100 text-amber-600",
      btnColor: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-2 focus:ring-amber-500",
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    },
    danger: {
      iconBg: "bg-red-50 border-red-100 text-red-600",
      btnColor: "bg-red-600 hover:bg-red-700 text-white focus:ring-2 focus:ring-red-500",
      icon: <AlertCircle className="w-6 h-6 text-red-600" />,
    },
    success: {
      iconBg: "bg-emerald-50 border-emerald-100 text-emerald-600",
      btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-2 focus:ring-emerald-500",
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
    },
  };

  const style = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900 p-6 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border shrink-0 ${style.iconBg}`}>
            {style.icon}
          </div>

          <div className="space-y-1 pr-4">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 ${style.btnColor}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isLoading ? "Memproses..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
