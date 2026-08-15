"use client";

import { useState } from "react";
import { OperationalCategory, OperationalTransactionType } from "@/types/operational";
import { createOperationalTransactionAction } from "@/features/operational/actions";
import { validateFileMetadata } from "@/lib/validation/lip-invoice";
import { X, Wallet, Upload, AlertCircle, Save, ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface OperationalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cashAccounts: { id: string; code: string; name: string }[];
  categories: OperationalCategory[];
  defaultType?: OperationalTransactionType;
}

export function OperationalFormModal({
  isOpen,
  onClose,
  onSuccess,
  cashAccounts,
  categories,
  defaultType = "expense",
}: OperationalFormModalProps) {
  const [transactionType, setTransactionType] = useState<OperationalTransactionType>(defaultType);

  const filteredCategories = categories.filter(
    (c) => c.transactionType === transactionType && c.isActive
  );

  const [categoryId, setCategoryId] = useState(filteredCategories[0]?.id || "");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || "");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTypeChange = (type: OperationalTransactionType) => {
    setTransactionType(type);
    const validCats = categories.filter((c) => c.transactionType === type && c.isActive);
    setCategoryId(validCats[0]?.id || "");
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

    if (!categoryId) {
      setErrorMsg("Kategori operasional wajib dipilih.");
      return;
    }

    if (amount <= 0) {
      setErrorMsg("Nominal transaksi harus lebih dari 0.");
      return;
    }

    if (!description.trim() || description.trim().length < 3) {
      setErrorMsg("Deskripsi transaksi wajib diisi (minimal 3 karakter).");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("transactionType", transactionType);
      formData.append("categoryId", categoryId);
      if (cashAccountId) formData.append("cashAccountId", cashAccountId);
      formData.append("transactionDate", new Date(transactionDate).toISOString());
      formData.append("amount", amount.toString());
      formData.append("description", description.trim());
      if (referenceNumber) formData.append("referenceNumber", referenceNumber.trim());
      if (notes) formData.append("notes", notes.trim());
      formData.append("idempotencyKey", idempotencyKey);
      if (selectedFile) formData.append("proofFile", selectedFile);

      const res = await createOperationalTransactionAction(formData);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat transaksi operasional.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden my-8 text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Catat Transaksi Operasional Baru</h2>
              <p className="text-[11px] text-slate-500">Pencatatan arus kas operasional internal SALUT</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Section: Transaction Type Tabs */}
          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Jenis Transaksi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-semibold transition ${
                  transactionType === "income"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Pemasukan</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-semibold transition ${
                  transactionType === "expense"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* Section: Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <option value="">Tidak ada kategori aktif</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Tanggal Transaksi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section: Amount & Cash Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nominal (Integer Rupiah) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                step={1}
                value={amount || ""}
                onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                placeholder="Contoh: 150000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-emerald-600 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Sumber / Rekening Kas</label>
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
          </div>

          {/* Section: Description & Reference */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Deskripsi Transaksi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Pembelian ATK Kantor dan Kertas HVS"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">No. Referensi / Struk / Kwitansi</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Contoh: INV-ATK-9901"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Proof File Picker */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Upload Bukti Transaksi (Private File)</label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="ops-proof-input"
              />
              <label htmlFor="ops-proof-input" className="cursor-pointer block space-y-1">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <span className="text-slate-800 block font-medium">
                  {selectedFile ? selectedFile.name : "Klik untuk memilih berkas bukti transaksi"}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Format: PDF, JPG, PNG, WEBP (Maksimal 10 MB)
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Catatan Tambahan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transaksi..."
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
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm disabled:opacity-50 transition ${
                transactionType === "income"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Transaksi...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Transaksi {transactionType === "income" ? "Pemasukan" : "Pengeluaran"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
