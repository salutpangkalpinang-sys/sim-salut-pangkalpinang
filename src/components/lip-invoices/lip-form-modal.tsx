"use client";

import { useState, useEffect } from "react";
import { uploadLipFileAndCreateAction } from "@/features/lip-invoices/actions";
import { X, FileText, Upload, AlertTriangle, AlertCircle, Save } from "lucide-react";

interface LipFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  registrationsOptions: { id: string; registrationNumber: string; studentName: string; studentNim: string | null; academicPeriodName: string; estimatedTuition?: number; estimatedTotal?: number }[];
  defaultRegistrationId?: string;
}

export function LipFormModal({
  isOpen,
  onClose,
  onSuccess,
  registrationsOptions,
  defaultRegistrationId = "",
}: LipFormModalProps) {
  const [registrationId, setRegistrationId] = useState(defaultRegistrationId || registrationsOptions[0]?.id || "");
  const [lipNumber, setLipNumber] = useState("");
  const [officialAmount, setOfficialAmount] = useState(0);
  const [tuitionAmount, setTuitionAmount] = useState(0);
  const [bookAmount, setBookAmount] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);
  const [otherUtAmount, setOtherUtAmount] = useState(0);
  const [issuedAt, setIssuedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill SPP from registration snapshot when registrationId changes
  useEffect(() => {
    if (registrationId) {
      const selectedReg = registrationsOptions.find((r) => r.id === registrationId);
      if (selectedReg && selectedReg.estimatedTuition) {
        setTuitionAmount(selectedReg.estimatedTuition);
      }
    }
  }, [registrationId, registrationsOptions]);

  // Auto-calculate Total Resmi Kewajiban UT from components
  useEffect(() => {
    const sum = tuitionAmount + bookAmount + shippingAmount + otherUtAmount;
    if (sum > 0) {
      setOfficialAmount(sum);
    }
  }, [tuitionAmount, bookAmount, shippingAmount, otherUtAmount]);

  if (!isOpen) return null;

  const componentTotal = tuitionAmount + bookAmount + shippingAmount + otherUtAmount;
  const hasMismatch = officialAmount > 0 && componentTotal !== officialAmount;
  const mismatchDifference = Math.abs(componentTotal - officialAmount);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("Ukuran berkas melebihi batas maksimal 10 MB.");
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

    if (!selectedFile) {
      setErrorMsg("Berkas fisik LIP wajib diunggah.");
      return;
    }

    if (!lipNumber.trim()) {
      setErrorMsg("Nomor LIP wajib diisi.");
      return;
    }

    if (officialAmount <= 0) {
      setErrorMsg("Total Resmi Kewajiban UT wajib lebih dari 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("registrationId", registrationId);
      formData.append("lipNumber", lipNumber.trim());
      formData.append("officialAmount", officialAmount.toString());
      formData.append("tuitionAmount", tuitionAmount.toString());
      formData.append("bookAmount", bookAmount.toString());
      formData.append("shippingAmount", shippingAmount.toString());
      formData.append("otherUtAmount", otherUtAmount.toString());
      if (issuedAt) formData.append("issuedAt", issuedAt);
      if (dueAt) formData.append("dueAt", dueAt);
      if (notes) formData.append("notes", notes.trim());
      formData.append("file", selectedFile);

      const res = await uploadLipFileAndCreateAction(formData);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengunggah dan menyimpan LIP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 text-xs text-slate-900">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Input Manual & Upload Dokumen LIP</h2>
              <p className="text-[11px] text-slate-500">Catat kewajiban resmi UT dan unggah salinan berkas fisik</p>
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
          {/* Registration Select */}
          <div className="space-y-1">
            <label className="block text-slate-700 font-medium mb-1">
              Registrasi Mahasiswa <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Pilih Registrasi Semester</option>
              {registrationsOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.registrationNumber} — {r.studentName} ({r.academicPeriodName})
                </option>
              ))}
            </select>
          </div>

          {/* LIP Number & Official Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Dokumen LIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lipNumber}
                onChange={(e) => setLipNumber(e.target.value)}
                placeholder="Contoh: LIP-20261-009281"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Total Resmi Kewajiban UT (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={officialAmount === 0 ? "" : officialAmount}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setOfficialAmount(val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-emerald-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Rincian Komponen Financial Breakdown */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Rincian Komponen Biaya LIP (Opsional)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 text-[11px] mb-1">SPP / Uang Kuliah</label>
                <input
                  type="number"
                  min={0}
                  value={tuitionAmount === 0 ? "" : tuitionAmount}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTuitionAmount(val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-[11px] mb-1">Bahan Ajar / Buku</label>
                <input
                  type="number"
                  min={0}
                  value={bookAmount === 0 ? "" : bookAmount}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBookAmount(val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-[11px] mb-1">Biaya Kirim</label>
                <input
                  type="number"
                  min={0}
                  value={shippingAmount === 0 ? "" : shippingAmount}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShippingAmount(val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-[11px] mb-1">Komponen Lainnya</label>
                <input
                  type="number"
                  min={0}
                  value={otherUtAmount === 0 ? "" : otherUtAmount}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOtherUtAmount(val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                />
              </div>
            </div>

            {hasMismatch && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Peringatan Mismatch:</strong> Total rincian komponen (Rp {componentTotal.toLocaleString("id-ID")}) berbeda Rp {mismatchDifference.toLocaleString("id-ID")} dari Total Resmi LIP (Rp {officialAmount.toLocaleString("id-ID")}). Angka resmi tetap mengacu pada Total Resmi LIP.
                </span>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tanggal Terbit</label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tanggal Jatuh Tempo</label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Berkas Fisik LIP (PDF / Gambar) <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-50">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="lip-file-input"
              />
              <label htmlFor="lip-file-input" className="cursor-pointer block space-y-1">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <span className="text-slate-800 block font-medium">
                  {selectedFile ? selectedFile.name : "Klik untuk memilih berkas LIP"}
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
              placeholder="Catatan dokumen LIP..."
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
                  <span>Mengunggah LIP...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Dokumen LIP</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
