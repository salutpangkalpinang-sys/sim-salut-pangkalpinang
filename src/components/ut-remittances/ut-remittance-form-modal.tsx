"use client";

import { useState } from "react";
import { EligibleLipForRemittance } from "@/types/ut-remittance";
import { createUtRemittanceAction } from "@/features/ut-remittances/actions";
import { validateFileMetadata } from "@/lib/validation/lip-invoice";
import { X, Building2, Upload, AlertCircle, Save, Trash2 } from "lucide-react";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface UtRemittanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cashAccounts: { id: string; code: string; name: string }[];
  eligibleLips: EligibleLipForRemittance[];
}

export function UtRemittanceFormModal({
  isOpen,
  onClose,
  onSuccess,
  cashAccounts,
  eligibleLips,
}: UtRemittanceFormModalProps) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || "");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Selected LIP Items state
  const [selectedItems, setSelectedItems] = useState<{
    lipDocumentId: string;
    registrationId: string;
    amount: number;
  }[]>([]);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalRemittanceAmount = selectedItems.reduce((acc, item) => acc + item.amount, 0);

  const handleAddItem = (lipId: string) => {
    const lip = eligibleLips.find((l) => l.id === lipId);
    if (!lip) return;
    if (selectedItems.some((i) => i.lipDocumentId === lipId)) return;

    setSelectedItems([
      ...selectedItems,
      {
        lipDocumentId: lip.id,
        registrationId: lip.registrationId,
        amount: lip.outstandingUtAmount,
      },
    ]);
  };

  const handleRemoveItem = (lipId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.lipDocumentId !== lipId));
  };

  const handleItemAmountChange = (lipId: string, newAmount: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.lipDocumentId === lipId ? { ...item, amount: newAmount } : item
      )
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const val = validateFileMetadata(file.name, file.type, file.size);
      if (!val.valid) {
        setErrorMsg(val.message || "Berkas tidak valid");
        setSelectedFile(null);
        return;
      }
      setErrorMsg(null);
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedItems.length === 0) {
      setErrorMsg("Minimal pilih 1 LIP kewajiban UT untuk dialokasikan.");
      return;
    }

    if (totalRemittanceAmount <= 0) {
      setErrorMsg("Total setoran UT harus lebih dari 0.");
      return;
    }

    for (const item of selectedItems) {
      const lip = eligibleLips.find((l) => l.id === item.lipDocumentId);
      if (lip && item.amount > lip.outstandingUtAmount) {
        setErrorMsg(
          `Alokasi untuk LIP #${lip.lipNumber} (Rp ${item.amount.toLocaleString("id-ID")}) melebihi sisa kewajiban UT (Rp ${lip.outstandingUtAmount.toLocaleString("id-ID")}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("paidAt", new Date(paidAt).toISOString());
      formData.append("amount", totalRemittanceAmount.toString());
      if (cashAccountId) formData.append("cashAccountId", cashAccountId);
      if (referenceNumber) formData.append("referenceNumber", referenceNumber.trim());
      if (notes) formData.append("notes", notes.trim());
      formData.append("idempotencyKey", idempotencyKey);
      formData.append("items", JSON.stringify(selectedItems));
      if (selectedFile) formData.append("proofFile", selectedFile);

      const res = await createUtRemittanceAction(formData);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat setoran UT.");
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
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Catat Setoran / Pembayaran SALUT ke UT</h2>
              <p className="text-[11px] text-slate-500">Pencatatan pembayaran resmi kewajiban UT per dokumen LIP</p>
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
          {/* Header Info: Date, Cash Account, Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <DatePickerId
              label="Tanggal Setor"
              required
              value={paidAt}
              onChange={(iso) => setPaidAt(iso)}
            />

            <div>
              <label className="block text-slate-700 font-medium mb-1">Sumber Rekening Kas</label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Pilih Rekening Kas</option>
                {cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">No. Referensi Transfer / Bank</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Contoh: BANK-UT-99012"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section: Select Eligible LIPs */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <label className="block text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                Pilih Dokumen LIP Kewajiban UT
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {eligibleLips.length} LIP Tersedia dengan Outstanding UT
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Tambah LIP ke Daftar Setoran --</option>
                {eligibleLips.map((lip) => {
                  const isSelected = selectedItems.some((i) => i.lipDocumentId === lip.id);
                  return (
                    <option key={lip.id} value={lip.id} disabled={isSelected}>
                      {lip.lipNumber} — {lip.studentName} ({lip.registrationNumber}) [Outstanding UT: Rp {lip.outstandingUtAmount.toLocaleString("id-ID")}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Table of Selected Items */}
            {selectedItems.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2">No. LIP & Mahasiswa</th>
                      <th className="px-3 py-2">Resmi UT (LIP)</th>
                      <th className="px-3 py-2">Sisa Kewajiban UT</th>
                      <th className="px-3 py-2">Alokasi Setoran Ini (Rp)</th>
                      <th className="px-3 py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {selectedItems.map((item) => {
                      const lip = eligibleLips.find((l) => l.id === item.lipDocumentId);
                      if (!lip) return null;

                      return (
                        <tr key={item.lipDocumentId} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5">
                            <div className="font-mono font-bold text-blue-600">{lip.lipNumber}</div>
                            <div className="text-[11px] text-slate-900">{lip.studentName}</div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-700">
                            Rp {lip.officialAmount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-amber-600">
                            Rp {lip.outstandingUtAmount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              max={lip.outstandingUtAmount}
                              value={item.amount}
                              onChange={(e) =>
                                handleItemAmountChange(
                                  item.lipDocumentId,
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-36 px-2.5 py-1 bg-white border border-slate-300 rounded text-emerald-600 font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.lipDocumentId)}
                              className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                              title="Hapus LIP dari Setoran"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                Belum ada LIP yang dipilih. Gunakan dropdown di atas untuk memilih LIP kewajiban UT.
              </div>
            )}
          </div>

          {/* Total Remittance Calculation Banner */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
            <span className="text-slate-700 font-semibold">Total Setoran SALUT ke UT (SUM Alokasi):</span>
            <span className="text-xl font-bold font-mono text-emerald-600">
              Rp {totalRemittanceAmount.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Proof File Picker */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Upload Bukti Setoran Bank UT (Private File)</label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="ut-remittance-proof-input"
              />
              <label htmlFor="ut-remittance-proof-input" className="cursor-pointer block space-y-1">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <span className="text-slate-800 block font-medium">
                  {selectedFile ? selectedFile.name : "Klik untuk memilih berkas bukti setoran UT"}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Format: PDF, JPG, PNG, WEBP (Maksimal 10 MB)
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Catatan Setoran</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transaksi setoran UT..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
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
                  <span>Menyimpan Setoran...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Transaksi Setoran UT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
