"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EligibleLipForRemittance } from "@/types/ut-remittance";
import {
  createUtRemittanceAction,
  searchEligibleLipsAction,
  fetchIneligibleLipsSummaryCountAction,
} from "@/features/ut-remittances/actions";
import { validateFileMetadata } from "@/lib/validation/lip-invoice";
import { X, Building2, Upload, AlertCircle, Save, Trash2, AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePickerId } from "@/components/ui/date-picker-id";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { IneligibleLipsDialog } from "@/components/ut-remittances/ineligible-lips-dialog";

interface UtRemittanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cashAccounts: { id: string; code: string; name: string }[];
  eligibleLips?: EligibleLipForRemittance[];
}

export function UtRemittanceFormModal({
  isOpen,
  onClose,
  onSuccess,
  cashAccounts,
  eligibleLips = [],
}: UtRemittanceFormModalProps) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);

  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || "");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Ineligible LIPs Dialog & Summary State
  const [isIneligibleDialogOpen, setIsIneligibleDialogOpen] = useState(false);
  const openIneligibleButtonRef = useRef<HTMLButtonElement>(null);
  const [ineligibleCount, setIneligibleCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  // Modal Escape key listener - only closes main modal if the Ineligible sub-dialog is NOT open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (e.defaultPrevented) {
          // Event was already handled and canceled by a child component/dropdown
          return;
        }
        if (isIneligibleDialogOpen) {
          // Ineligible dialog is open: let the dialog's own handler close only the dialog
          return;
        }
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isIneligibleDialogOpen, onClose]);

  // Eligible LIPs dropdown options & server search
  const [eligibleOptions, setEligibleOptions] = useState<ComboboxOption[]>([]);
  const [isSearchingLips, setIsSearchingLips] = useState(false);
  const searchRequestIdRef = useRef(0);
  // Cache of details for LIPs that were fetched (so selected items info is never lost)
  const [lipDetailsCache, setLipDetailsCache] = useState<Record<string, EligibleLipForRemittance>>(() => {
    const initial: Record<string, EligibleLipForRemittance> = {};
    for (const lip of eligibleLips) {
      initial[lip.id] = lip;
    }
    return initial;
  });

  // Selected LIP Items state
  const [selectedItems, setSelectedItems] = useState<{
    lipDocumentId: string;
    registrationId: string;
    amount: number;
    // Metadata preserved so it never disappears across searches
    lipNumber: string;
    registrationNumber: string;
    studentName: string;
    studentNim?: string | null;
    officialAmount: number;
    outstandingUtAmount: number;
    isRemittanceEligible: boolean;
  }[]>([]);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map an EligibleLipForRemittance to a ComboboxOption
  const mapLipToOption = useCallback((lip: EligibleLipForRemittance): ComboboxOption => {
    const sublabelParts = [
      `${lip.lipNumber} — ${lip.registrationNumber}`,
      `Kewajiban: Rp ${lip.officialAmount.toLocaleString("id-ID")}`,
      `Sisa: Rp ${lip.outstandingUtAmount.toLocaleString("id-ID")}`,
    ];

    return {
      id: lip.id,
      label: `🟢 ${lip.studentName}`,
      sublabel: sublabelParts.join(" | "),
      badge: "SIAP SETOR",
      searchTerms: `${lip.studentName} ${lip.lipNumber} ${lip.registrationNumber} ${lip.studentNim || ""}`,
      disabled: false,
    };
  }, []);

  // Fetch summary count of ineligible LIPs
  const loadIneligibleCount = useCallback(async () => {
    setIsLoadingCount(true);
    setCountError(null);
    const res = await fetchIneligibleLipsSummaryCountAction();
    setIsLoadingCount(false);
    if (res.error) {
      setCountError(res.error);
      setIneligibleCount(null);
    } else if (typeof res.count === "number") {
      setIneligibleCount(res.count);
    }
  }, []);

  // Initial load: fetch top 50 eligible LIPs from server & count ineligible LIPs
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsSearchingLips(true);

    searchEligibleLipsAction({ limit: 50 })
      .then((res) => {
        if (!isMounted) return;
        setIsSearchingLips(false);
        if (res.result) {
          setLipDetailsCache((prev) => {
            const updated = { ...prev };
            for (const lip of res.result!) {
              updated[lip.id] = lip;
            }
            return updated;
          });
          setEligibleOptions(res.result.map(mapLipToOption));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsSearchingLips(false);
        console.error("Initial eligible lips fetch error:", err);
      });

    loadIneligibleCount();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mapLipToOption, loadIneligibleCount]);

  // Server-side debounced search for eligible LIPs in combobox
  const handleLipSearchChange = useCallback(
    async (query: string) => {
      const currentRequestId = ++searchRequestIdRef.current;
      setIsSearchingLips(true);
      try {
        const res = await searchEligibleLipsAction({ query, limit: 50 });
        if (currentRequestId !== searchRequestIdRef.current) {
          return;
        }
        if (res.result) {
          // Update details cache
          setLipDetailsCache((prev) => {
            const updated = { ...prev };
            for (const lip of res.result!) {
              updated[lip.id] = lip;
            }
            return updated;
          });
          setEligibleOptions(res.result.map(mapLipToOption));
        }
      } catch (err) {
        if (currentRequestId === searchRequestIdRef.current) {
          console.error("Lip search error:", err);
        }
      } finally {
        if (currentRequestId === searchRequestIdRef.current) {
          setIsSearchingLips(false);
        }
      }
    },
    [mapLipToOption]
  );

  if (!isOpen) return null;

  const totalRemittanceAmount = selectedItems.reduce((acc, item) => acc + item.amount, 0);

  const handleAddItem = (lipId: string) => {
    const lip = lipDetailsCache[lipId] || eligibleLips.find((l) => l.id === lipId);
    if (!lip) return;
    if (selectedItems.some((i) => i.lipDocumentId === lipId)) return;

    if (!lip.isRemittanceEligible) {
      setErrorMsg(
        `LIP #${lip.lipNumber} (${lip.studentName}) tidak memenuhi syarat setoran: ${
          lip.ineligibilityReason || "Kriteria setoran belum terpenuhi."
        }`
      );
      return;
    }

    setErrorMsg(null);
    setSelectedItems((prev) => [
      ...prev,
      {
        lipDocumentId: lip.id,
        registrationId: lip.registrationId,
        amount: lip.outstandingUtAmount,
        lipNumber: lip.lipNumber,
        registrationNumber: lip.registrationNumber,
        studentName: lip.studentName,
        studentNim: lip.studentNim,
        officialAmount: lip.officialAmount,
        outstandingUtAmount: lip.outstandingUtAmount,
        isRemittanceEligible: Boolean(lip.isRemittanceEligible),
      },
    ]);
  };

  const handleRemoveItem = (lipId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.lipDocumentId !== lipId));
  };

  const handleItemAmountChange = (lipId: string, newAmount: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
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

    // Validate each item against RPC eligibility rules
    for (const item of selectedItems) {
      const lip = lipDetailsCache[item.lipDocumentId] || eligibleLips.find((l) => l.id === item.lipDocumentId);
      if (!lip) {
        setErrorMsg("Dokumen LIP tidak ditemukan dalam data.");
        return;
      }

      if (!lip.isRemittanceEligible) {
        setErrorMsg(
          `LIP #${lip.lipNumber} (${lip.studentName}) belum memenuhi syarat setoran: ${
            lip.ineligibilityReason || "Kriteria setoran belum terpenuhi."
          }`
        );
        return;
      }

      if (item.amount > lip.outstandingUtAmount) {
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
      formData.append(
        "items",
        JSON.stringify(
          selectedItems.map((item) => ({
            lipDocumentId: item.lipDocumentId,
            registrationId: item.registrationId,
            amount: item.amount,
          }))
        )
      );
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
    <>
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
                <SearchableSelect
                  options={[
                    { value: "", label: "Pilih Rekening Kas" },
                    ...cashAccounts.map((c) => ({
                      value: c.id,
                      label: c.name,
                      sublabel: c.code,
                    })),
                  ]}
                  value={cashAccountId}
                  onChange={(val) => setCashAccountId(val)}
                  placeholder="Pilih Rekening Kas"
                />
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

            {/* Ineligible LIPs Compact Summary Card with "Lihat daftar" button */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Dokumen LIP Belum Memenuhi Syarat Setoran:</span>
                    {isLoadingCount ? (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Memuat...</span>
                      </span>
                    ) : countError ? (
                      <span className="text-[11px] text-red-600 font-semibold">Gagal memuat status</span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-amber-200/80 text-amber-900 font-bold rounded text-[11px] font-mono">
                        {ineligibleCount ?? 0} Dokumen
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hanya dokumen yang seluruh komisi SALUT lunas dan dana UT verified mencukupi yang dapat disetor.
                  </p>
                </div>
              </div>

              <button
                ref={openIneligibleButtonRef}
                type="button"
                onClick={() => setIsIneligibleDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 rounded-lg font-semibold text-xs transition shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>Lihat Daftar</span>
              </button>
            </div>

            {/* Section: Select Eligible LIPs */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <label className="block text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                  Pilih Dokumen LIP Siap Setor (Kewajiban UT)
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Hanya menampilkan LIP yang memenuhi syarat
                </span>
              </div>

              <div>
                <SearchableCombobox
                  options={eligibleOptions.map((o) => ({
                    ...o,
                    disabled: selectedItems.some((i) => i.lipDocumentId === o.id),
                  }))}
                  value=""
                  onChange={(id) => {
                    if (id) {
                      handleAddItem(id);
                    }
                  }}
                  onSearchChange={handleLipSearchChange}
                  isLoading={isSearchingLips}
                  placeholder="Ketik Nama Mahasiswa, No. LIP, atau No. Reg untuk menambah setoran..."
                  selectedColor="blue"
                  emptyText="Tidak ada dokumen LIP siap setor yang cocok dengan"
                />
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
                        return (
                          <tr key={item.lipDocumentId} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <div className="font-mono font-bold text-blue-600">{item.lipNumber}</div>
                              <div className="text-[11px] text-slate-900 flex items-center gap-1.5 mt-0.5">
                                <span>{item.studentName}</span>
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[9px]">
                                  🟢 Siap Disetor
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-slate-700">
                              Rp {item.officialAmount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-semibold text-amber-600">
                              Rp {item.outstandingUtAmount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-3 py-2.5">
                              <FormattedNumberInput
                                min={1}
                                max={item.outstandingUtAmount}
                                value={item.amount}
                                onChange={(val) =>
                                  handleItemAmountChange(item.lipDocumentId, val)
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

    {/* Separate Ineligible LIPs Dialog Modal */}
    <IneligibleLipsDialog
      isOpen={isIneligibleDialogOpen}
      onClose={() => {
        setIsIneligibleDialogOpen(false);
        setTimeout(() => {
          openIneligibleButtonRef.current?.focus();
        }, 50);
      }}
    />
  </>
);
}
