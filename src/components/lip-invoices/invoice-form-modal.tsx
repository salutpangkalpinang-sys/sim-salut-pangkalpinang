"use client";

import { useState } from "react";
import { LipDocument } from "@/types/lip-invoice";
import { createInvoiceAction } from "@/features/lip-invoices/actions";
import { X, Receipt, Plus, Trash2, AlertCircle, Save } from "lucide-react";
import { DatePickerId } from "@/components/ui/date-picker-id";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";

interface InvoiceFormModalProps {
  lipDocument: LipDocument;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultServiceFeeSnapshotAmount?: number;
  defaultServiceFeeSnapshotName?: string;
}

interface InvoiceRowInput {
  itemType: "ut_liability" | "service_fee" | "internal_fee" | "discount";
  description: string;
  quantity: number;
  unitAmount: number;
  approvalStatus?: "pending" | "approved" | "rejected" | null;
  approvalReason?: string;
}

export function InvoiceFormModal({
  lipDocument,
  isOpen,
  onClose,
  onSuccess,
  defaultServiceFeeSnapshotAmount = 400000,
  defaultServiceFeeSnapshotName = "Biaya Layanan & Pendampingan SALUT",
}: InvoiceFormModalProps) {
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<InvoiceRowInput[]>([
    {
      itemType: "ut_liability",
      description: `Kewajiban Resmi UT (LIP ${lipDocument.lipNumber})`,
      quantity: 1,
      unitAmount: lipDocument.officialAmount,
    },
    {
      itemType: "service_fee",
      description: defaultServiceFeeSnapshotName,
      quantity: 1,
      unitAmount: defaultServiceFeeSnapshotAmount,
    },
  ]);

  if (!isOpen) return null;

  const addInternalFeeRow = () => {
    setItems((prev) => [
      ...prev,
      {
        itemType: "internal_fee",
        description: "Biaya Tambahan Internal",
        quantity: 1,
        unitAmount: 50000,
      },
    ]);
  };

  const addDiscountRow = () => {
    setItems((prev) => [
      ...prev,
      {
        itemType: "discount",
        description: "Potongan / Beasiswa Khusus",
        quantity: 1,
        unitAmount: 100000,
        approvalReason: "Pengajuan potongan khusus mahasiswa",
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items[idx].itemType === "ut_liability") {
      alert("Komponen Kewajiban UT dari LIP tidak boleh dihapus.");
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof InvoiceRowInput, val: any) => {
    const updated = [...items];
    const row = { ...updated[idx], [field]: val };
    if (field === "quantity" || field === "unitAmount") {
      row.quantity = Math.max(1, Number(row.quantity) || 1);
      row.unitAmount = Math.max(0, Number(row.unitAmount) || 0);
    }
    updated[idx] = row;
    setItems(updated);
  };

  let positiveTotal = 0;
  let approvedDiscountTotal = 0;
  let pendingDiscountTotal = 0;

  items.forEach((it) => {
    const amt = it.quantity * it.unitAmount;
    if (it.itemType === "discount") {
      if (it.approvalStatus === "approved") {
        approvedDiscountTotal += amt;
      } else {
        pendingDiscountTotal += amt;
      }
    } else {
      positiveTotal += amt;
    }
  });

  const netInvoiceEstimate = positiveTotal - approvedDiscountTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    setIsSubmitting(true);

    try {
      const res = await createInvoiceAction({
        registrationId: lipDocument.registrationId,
        lipDocumentId: lipDocument.id,
        dueAt: dueAt || null,
        notes: notes?.trim() || null,
        items: items.map((it) => ({
          itemType: it.itemType,
          description: it.description,
          quantity: it.quantity,
          unitAmount: it.unitAmount,
          sourceType: it.itemType === "ut_liability" ? "lip" : it.itemType === "service_fee" ? "registration_snapshot" : "manual",
          sourceId: it.itemType === "ut_liability" ? lipDocument.id : null,
          approvalStatus: it.itemType === "discount" ? "pending" : null,
          approvalReason: it.approvalReason || null,
        })),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menerbitkan invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Terbitkan Tagihan Invoice Mahasiswa</h2>
              <p className="text-[11px] text-slate-500">Dari Dokumen LIP Terverifikasi #{lipDocument.lipNumber}</p>
            </div>
          </div>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Header Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-slate-500 block">Mahasiswa</span>
              <span className="font-bold text-slate-900">{lipDocument.studentName}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">No. Registrasi</span>
              <span className="font-mono text-blue-600 font-semibold">{lipDocument.registrationNumber}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Total Resmi UT (LIP)</span>
              <span className="font-mono font-bold text-emerald-600">Rp {lipDocument.officialAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* Add Item Actions Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Rincian Komponen Tagihan Invoice
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addInternalFeeRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 text-blue-700 rounded-md border border-slate-300 transition shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>+ Biaya Tambahan</span>
              </button>
              <button
                type="button"
                onClick={addDiscountRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 text-amber-700 rounded-md border border-slate-300 transition shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>+ Potongan / Diskon</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2">Tipe</th>
                  <th className="px-3 py-2">Deskripsi Item</th>
                  <th className="px-3 py-2 w-16">Qty</th>
                  <th className="px-3 py-2">Nominal (Rp)</th>
                  <th className="px-3 py-2">Total Amount</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${
                          row.itemType === "ut_liability"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : row.itemType === "service_fee"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : row.itemType === "internal_fee"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {row.itemType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        disabled={row.itemType === "ut_liability"}
                        value={row.description}
                        onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-slate-900 font-medium disabled:opacity-80"
                      />
                      {row.itemType === "discount" && (
                        <input
                          type="text"
                          placeholder="Alasan pengajuan potongan..."
                          value={row.approvalReason || ""}
                          onChange={(e) => updateItemRow(idx, "approvalReason", e.target.value)}
                          className="w-full mt-1 text-[10px] bg-white border border-slate-300 px-2 py-1 text-slate-900 rounded"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => updateItemRow(idx, "quantity", e.target.value)}
                        className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FormattedNumberInput
                        min={0}
                        disabled={row.itemType === "ut_liability"}
                        value={row.unitAmount}
                        onChange={(val) => updateItemRow(idx, "unitAmount", val)}
                        className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono disabled:opacity-80"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold">
                      {row.itemType === "discount" ? (
                        <span className="text-amber-600">- Rp {(row.quantity * row.unitAmount).toLocaleString("id-ID")} (Pending)</span>
                      ) : (
                        <span className="text-emerald-600">Rp {(row.quantity * row.unitAmount).toLocaleString("id-ID")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.itemType !== "ut_liability" && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1 transition"
                          title="Hapus Baris Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pending Discount Warning Note */}
          {pendingDiscountTotal > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed">
              <strong>Catatan Potongan Diskon:</strong> Terdapat potongan sebesar Rp {pendingDiscountTotal.toLocaleString("id-ID")} dengan status <em>Pending</em>. Potongan ini baru akan mengurangi total invoice final setelah disetujui oleh Owner.
            </div>
          )}

          <DatePickerId
            label="Tanggal Jatuh Tempo Pembayaran"
            value={dueAt}
            onChange={(iso) => setDueAt(iso)}
          />

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Catatan Invoice</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk tagihan mahasiswa..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Summary Banner */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] block">Total Kewajiban Tagihan Mahasiswa</span>
              <span className="text-xs text-slate-700 font-medium">LIP UT + Service Fee SALUT + Internal Fee</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Tagihan Final</span>
              <span className="text-lg font-bold font-mono text-emerald-600">
                Rp {netInvoiceEstimate.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menerbitkan Invoice...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Terbitkan Invoice Atomik</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
