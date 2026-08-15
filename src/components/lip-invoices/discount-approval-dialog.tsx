"use client";

import { useState } from "react";
import { approveDiscountAction } from "@/features/lip-invoices/actions";
import { X, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface DiscountApprovalDialogProps {
  invoiceItemId: string;
  itemDescription: string;
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DiscountApprovalDialog({
  invoiceItemId,
  itemDescription,
  amount,
  isOpen,
  onClose,
  onSuccess,
}: DiscountApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAction = async (action: "approve" | "reject") => {
    setErrorMsg(null);
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Alasan persetujuan/penolakan wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await approveDiscountAction({
        invoiceItemId,
        action,
        reason: reason.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses persetujuan potongan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Persetujuan Potongan Diskon (Owner Only)</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[11px] text-slate-500 block">Item Potongan</span>
            <p className="font-semibold text-slate-900">{itemDescription}</p>
            <p className="font-mono font-bold text-amber-600">
              Nominal Potongan: - Rp {amount.toLocaleString("id-ID")}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Catatan & Alasan Persetujuan/Penolakan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Disetujui berdasarkan Beasiswa Prestasi SALUT..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction("reject")}
              className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 bg-red-50 rounded-lg border border-red-200 transition"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Tolak Potongan</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction("approve")}
              className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Setujui Potongan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
