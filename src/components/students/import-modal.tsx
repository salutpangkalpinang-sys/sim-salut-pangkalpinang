"use client";

import { useState } from "react";
import { ImportCommitResult, ImportMode, ImportPreviewResult } from "@/types/student-import";
import { parseAndValidateImportFileAction, commitImportAction } from "@/features/students/import-actions";
import { generateCsvTemplate } from "@/lib/import/template-generator";
import { escapeFormulaInjection } from "@/lib/import/student-import-parser";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileX,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: ImportMode;
}

export function ImportModal({ isOpen, onClose, defaultMode = "calon" }: ImportModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mode, setMode] = useState<ImportMode>(defaultMode);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "valid" | "error">("all");

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplate();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `template-import-${mode}-salut.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext !== "csv" && ext !== "xlsx") {
        setErrorMessage("Format file tidak didukung. Harap pilih berkas .csv atau .xlsx.");
        setSelectedFile(null);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("Ukuran berkas melebihi batas 5 MB.");
        setSelectedFile(null);
        return;
      }

      setErrorMessage(null);
      setSelectedFile(file);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) return;
    setIsParsing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("mode", mode);

    const res = await parseAndValidateImportFileAction(formData);
    setIsParsing(false);

    if (res.success && res.data) {
      setPreviewResult(res.data);
      setStep(2);
    } else {
      setErrorMessage(res.error || "Gagal memproses file import.");
    }
  };

  const handleExecuteCommit = async () => {
    if (!previewResult) return;
    setIsCommitting(true);
    setErrorMessage(null);

    const validRows = previewResult.rows
      .filter((r) => r.isValid && r.normalizedData)
      .map((r) => r.normalizedData!);

    const res = await commitImportAction(previewResult.mode, validRows, previewResult.filename);
    setIsCommitting(false);

    if (res.success && res.data) {
      setCommitResult(res.data);
      setStep(4);
    } else {
      setErrorMessage(res.error || "Gagal menyimpan data import ke database.");
    }
  };

  const handleDownloadErrorCsv = () => {
    if (!previewResult) return;
    const errorRows = previewResult.rows.filter((r) => !r.isValid);

    const csvHeader = "row_number,nama_lengkap,nim,nik_masked,error_message\n";
    const csvLines = errorRows.map((r) => {
      const name = escapeFormulaInjection(r.raw.nama_lengkap || "");
      const nim = escapeFormulaInjection(r.raw.nim || "");
      const maskedNik = r.maskedNik || "";
      const reason = escapeFormulaInjection(r.errors.join(" | "));
      return `${r.rowNumber},"${name}","${nim}","${maskedNik}","${reason}"`;
    });

    const fullCsv = `\uFEFF${csvHeader}${csvLines.join("\n")}`;
    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const nowStr = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 12);
    link.setAttribute("href", url);
    link.setAttribute("download", `import-errors-${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayedRows = (previewResult?.rows || []).filter((r) => {
    if (activeTab === "valid") return r.isValid;
    if (activeTab === "error") return !r.isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 text-xs text-slate-900">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Import Massal Data {mode === "calon" ? "Calon Mahasiswa" : "Mahasiswa"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Langkah {step} dari 4 — {step === 1 ? "Upload File" : step === 2 ? "Preview & Validasi" : step === 3 ? "Konfirmasi" : "Hasil Import"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 shadow-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: UPLOAD FILE & MODE SELECTION */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Import Mode Selector */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Mode Import Target:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("calon")}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
                      mode === "calon"
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div>
                      <div className="text-xs">Calon Mahasiswa</div>
                      <div className="text-[10px] text-slate-500 font-normal">NIM bersifat opsional</div>
                    </div>
                    {mode === "calon" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("mahasiswa")}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
                      mode === "mahasiswa"
                        ? "bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div>
                      <div className="text-xs">Mahasiswa Aktif</div>
                      <div className="text-[10px] text-slate-500 font-normal">NIM wajib diisi sesuai rule Core 1</div>
                    </div>
                    {mode === "mahasiswa" && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                  </button>
                </div>
              </div>

              {/* Download Template Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800">Template Format Standar CSV</span>
                  <p className="text-[11px] text-slate-500">
                    Gunakan template resmi untuk memastikan susunan kolom sesuai master data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-blue-700 font-semibold border border-blue-200 rounded-lg shadow-xs transition flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* File Dropzone */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Pilih Berkas CSV / XLSX:</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 bg-slate-50/50 transition">
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <label htmlFor="file-upload-input" className="cursor-pointer space-y-2 block">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-slate-800">
                      {selectedFile ? selectedFile.name : "Klik untuk memilih file spreadsheet"}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Format didukung: <strong>.csv</strong> atau <strong>.xlsx</strong> (Maksimum 5 MB & 1.000 baris)
                    </p>
                  </label>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                <strong>Instruksi Penting Import:</strong>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Jangan mengubah nama header kolom pada baris 1 template.</li>
                  <li>NIM, NIK, dan Nomor WhatsApp sebaiknya diformat sebagai <strong>Text</strong> di Excel agar angka nol di awal tidak hilang.</li>
                  <li>Format tanggal menggunakan <strong>YYYY-MM-DD</strong> (contoh: 1995-04-23).</li>
                  <li>Sistem akan mendeteksi terduplikasi NIM/NIK baik di dalam file maupun di database.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION */}
          {step === 2 && previewResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Baris File</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{previewResult.totalRows}</span>
                </div>
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Baris Valid</span>
                  <span className="text-xl font-bold font-mono text-emerald-800">{previewResult.validRowsCount}</span>
                </div>
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-[10px] text-red-600 uppercase font-semibold block">Baris Error / Bermasalah</span>
                  <span className="text-xl font-bold font-mono text-red-800">{previewResult.errorRowsCount}</span>
                </div>
              </div>

              {/* Tabs Filter */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Semua Baris ({previewResult.totalRows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("valid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "valid" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Valid ({previewResult.validRowsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("error")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "error" ? "bg-red-700 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
                  }`}
                >
                  Error ({previewResult.errorRowsCount})
                </button>

                {previewResult.errorRowsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorCsv}
                    className="ml-auto px-3 py-1.5 bg-white border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition flex items-center gap-1 text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Data Error (.csv)</span>
                  </button>
                )}
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">Hasil Validasi</th>
                      <th className="px-3 py-2">Nama Lengkap</th>
                      <th className="px-3 py-2">NIM</th>
                      <th className="px-3 py-2">NIK (Masked)</th>
                      <th className="px-3 py-2">Program Studi</th>
                      <th className="px-3 py-2">Pesan Error / Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayedRows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? "hover:bg-slate-50" : "bg-red-50/40 hover:bg-red-50/70"}>
                        <td className="px-3 py-2 font-mono font-bold">{r.rowNumber}</td>
                        <td className="px-3 py-2">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              <FileX className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.raw.nama_lengkap || "-"}</td>
                        <td className="px-3 py-2 font-mono">{r.raw.nim || "-"}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{r.maskedNik || "-"}</td>
                        <td className="px-3 py-2">{r.raw.program_studi || "-"}</td>
                        <td className="px-3 py-2 text-red-600 font-medium">{r.errors.join(" | ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === 3 && previewResult && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Commit Data Import</h3>
                <p className="text-xs text-slate-500">
                  Anda akan menyimpan data mahasiswa ke database SIM-SALUT Pangkalpinang.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-md mx-auto space-y-2 text-left text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Mode Target:</span>
                  <strong className="text-slate-900 uppercase">{previewResult.mode}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Baris Valid (Akan Di-import):</span>
                  <strong className="text-emerald-700 font-mono font-bold text-sm">
                    {previewResult.validRowsCount} Data
                  </strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Baris Error (Akan Dilewati):</span>
                  <strong className="text-red-600 font-mono font-bold text-sm">
                    {previewResult.errorRowsCount} Data
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Hanya data valid yang akan disimpan. Baris bermasalah secara otomatis dilewati dan dapat di-download untuk dikoreksi.
              </p>
            </div>
          )}

          {/* STEP 4: IMPORT RESULTS */}
          {step === 4 && commitResult && (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Import Massal Selesai!</h3>
                <p className="text-xs text-slate-500">
                  Proses menyimpan data ke database telah selesai dilaksanakan.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Di-attempt</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{commitResult.totalAttempted}</span>
                </div>
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold block">Berhasil Di-import</span>
                  <span className="text-xl font-bold font-mono text-emerald-800">{commitResult.successCount}</span>
                </div>
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-[10px] text-red-600 uppercase font-semibold block">Gagal Commit</span>
                  <span className="text-xl font-bold font-mono text-red-800">{commitResult.failedCount}</span>
                </div>
              </div>

              {commitResult.failedCount > 0 && commitResult.failedRows && commitResult.failedRows.length > 0 && (
                <div className="max-w-lg mx-auto p-3 bg-red-50 border border-red-200 rounded-xl text-left text-xs text-red-800 max-h-40 overflow-y-auto space-y-1">
                  <span className="font-semibold text-red-900 block border-b border-red-200 pb-1">
                    Detail Baris Gagal Commit:
                  </span>
                  {commitResult.failedRows.map((f, idx) => (
                    <div key={idx} className="text-[11px]">
                      • <strong>Baris {f.rowNumber} ({f.name})</strong>: {f.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!selectedFile || isParsing}
                onClick={handleProcessUpload}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses & Memvalidasi File...</span>
                  </>
                ) : (
                  <>
                    <span>Upload & Preview Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg transition"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={!previewResult || previewResult.validRowsCount === 0}
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Lanjut Konfirmasi ({previewResult?.validRowsCount} Valid)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                disabled={isCommitting}
                onClick={() => setStep(2)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCommitting}
                onClick={handleExecuteCommit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <span>Import {previewResult?.validRowsCount} Data Valid Now</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 4 && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSelectedFile(null);
                  setPreviewResult(null);
                  setCommitResult(null);
                }}
                className="px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold rounded-lg border border-blue-200 transition"
              >
                Import File Lain
              </button>

              <div className="flex items-center gap-2">
                {previewResult && previewResult.errorRowsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorCsv}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Data Error (.csv)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.refresh();
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition"
                >
                  Selesai & Lihat Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
