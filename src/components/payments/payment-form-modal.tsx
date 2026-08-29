"use client";

import { useState } from "react";
import { createStudentPaymentAction } from "@/features/payments/actions";
import { validateFileMetadata } from "@/lib/validation/lip-invoice";
import { X, CreditCard, Upload, AlertCircle, Save } from "lucide-react";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  options: {
    paymentMethods: { id: string; code: string; name: string; requires_reference: boolean }[];
    cashAccounts: { id: string; code: string; name: string }[];
    invoices: {
      id: string;
      invoiceNumber: string;
      studentId: string;
      studentName: string;
      studentNim: string | null;
      registrationNumber: string;
      invoiceTotalAmount: number;
      verifiedPaid: number;
      remainingBalance: number;
    }[];
  };
  defaultInvoiceId?: string;
}

export function PaymentFormModal({
  isOpen,
  onClose,
  onSuccess,
  options,
  defaultInvoiceId = "",
}: PaymentFormModalProps) {
  const [invoiceId, setInvoiceId] = useState(defaultInvoiceId || "");

  const invComboboxOptions: ComboboxOption[] = options.invoices.map((inv) => ({
    id: inv.id,
    label: `${inv.studentName}`,
    sublabel: `${inv.invoiceNumber} — NIM: ${inv.studentNim || "-"} (Sisa: Rp ${inv.remainingBalance.toLocaleString("id-ID")})`,
    badge: `Rp ${inv.remainingBalance.toLocaleString("id-ID")}`,
    searchTerms: `${inv.studentName} ${inv.studentNim || ""} ${inv.invoiceNumber} ${inv.registrationNumber}`,
  }));

  const selectedInvoice = options.invoices.find((i) => i.id === invoiceId);

  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState(selectedInvoice ? selectedInvoice.remainingBalance : 0);
  const [paymentMethodId, setPaymentMethodId] = useState(options.paymentMethods[0]?.id || "");
  const [cashAccountId, setCashAccountId] = useState(options.cashAccounts[0]?.id || "");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInvoiceChange = (invId: string) => {
    setInvoiceId(invId);
    const inv = options.invoices.find((i) => i.id === invId);
    if (inv) {
      setAmount(inv.remainingBalance > 0 ? inv.remainingBalance : inv.invoiceTotalAmount);
    } else {
      setAmount(0);
    }
  };

  const selectedMethod = options.paymentMethods.find((m) => m.id === paymentMethodId);
  const remaining = selectedInvoice ? selectedInvoice.remainingBalance : 0;
  const allocatedAmount = Math.min(amount, remaining > 0 ? remaining : amount);
  const unallocatedAmount = Math.max(0, amount - allocatedAmount);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const val = validateFileMetadata(file.name, file.type, file.size);
      if (!val.valid) {
        setErrorMsg(val.message || "File tidak valid.");
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

    if (!selectedInvoice) {
      setErrorMsg("Invoice alokasi wajib dipilih.");
      return;
    }

    if (amount <= 0) {
      setErrorMsg("Nominal pembayaran harus lebih dari 0.");
      return;
    }

    if (selectedMethod?.requires_reference && !referenceNumber.trim()) {
      setErrorMsg("Nomor referensi / bukti transfer wajib diisi untuk metode ini.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("studentId", selectedInvoice.studentId);
      formData.append("paidAt", new Date(paidAt).toISOString());
      formData.append("amount", amount.toString());
      formData.append("paymentMethodId", paymentMethodId);
      if (cashAccountId) formData.append("cashAccountId", cashAccountId);
      if (referenceNumber) formData.append("referenceNumber", referenceNumber.trim());
      if (notes) formData.append("notes", notes.trim());
      formData.append("invoiceId", invoiceId);
      formData.append("allocatedAmount", allocatedAmount.toString());
      formData.append("idempotencyKey", idempotencyKey);
      if (selectedFile) formData.append("proofFile", selectedFile);

      const res = await createStudentPaymentAction(formData);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat pembayaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Catat Transaksi Pembayaran Mahasiswa</h2>
              <p className="text-[11px] text-slate-500">Penerimaan pembayaran & alokasi otomatis ke invoice tagihan</p>
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
          {/* Target Invoice Select */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Pilih Invoice Tagihan Mahasiswa (Cari Nama / NIM / No. Inv) <span className="text-red-500">*</span>
            </label>
            <SearchableCombobox
              options={invComboboxOptions}
              value={invoiceId}
              onChange={(id) => handleInvoiceChange(id)}
              placeholder="Ketik Nama Mahasiswa, NIM, atau Nomor Invoice..."
              required
              selectedColor="emerald"
            />
          </div>

          {/* Target Invoice Info Summary Banner */}
          {selectedInvoice && (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block">Mahasiswa</span>
                <span className="font-bold text-slate-900">{selectedInvoice.studentName}</span>
                <div className="text-[10px] text-slate-500 font-mono">NIM: {selectedInvoice.studentNim || "Calon"}</div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Total Invoice</span>
                <span className="font-mono font-bold text-slate-900">Rp {selectedInvoice.invoiceTotalAmount.toLocaleString("id-ID")}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Sisa Tagihan</span>
                <span className="font-mono font-bold text-amber-600">Rp {selectedInvoice.remainingBalance.toLocaleString("id-ID")}</span>
              </div>
            </div>
          )}

          {/* Payment Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nominal Pembayaran (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <DatePickerId
              label="Tanggal Bayar"
              required
              value={paidAt}
              onChange={(iso) => setPaidAt(iso)}
            />
          </div>

          {/* Payment Method & Cash Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Metode Pembayaran <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {options.paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Rekening Kas Penerima</label>
              <select
                value={cashAccountId}
                onChange={(e) => setCashAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Pilih Rekening Kas</option>
                {options.cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Nomor Referensi Transaksi / Transfer {selectedMethod?.requires_reference && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Contoh: REF-889129031 / No. Struk Kasir"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Allocation Calculation Preview */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Dialokasikan ke Invoice #{selectedInvoice?.invoiceNumber}:</span>
              <span className="font-mono font-bold text-emerald-600">Rp {allocatedAmount.toLocaleString("id-ID")}</span>
            </div>
            {unallocatedAmount > 0 && (
              <div className="flex items-center justify-between text-amber-700 border-t border-slate-200 pt-1 mt-1 font-semibold">
                <span>Kelebihan / Belum Dialokasikan (Overpayment):</span>
                <span className="font-mono font-bold">Rp {unallocatedAmount.toLocaleString("id-ID")}</span>
              </div>
            )}
          </div>

          {/* Proof File Picker */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Upload Bukti Pembayaran (Private File)</label>
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="payment-proof-input"
              />
              <label htmlFor="payment-proof-input" className="cursor-pointer block space-y-1">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <span className="text-slate-800 block font-medium">
                  {selectedFile ? selectedFile.name : "Klik untuk memilih berkas bukti bayar"}
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
              placeholder="Catatan transaksi pembayaran..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Pembayaran...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Transaksi Atomik</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
