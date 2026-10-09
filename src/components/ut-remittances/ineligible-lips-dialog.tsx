"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { IneligibleLipItem, PaginatedIneligibleLipsResult } from "@/types/ut-remittance";
import { fetchIneligibleLipsAction } from "@/features/ut-remittances/actions";
import { X, Search, AlertCircle, ArrowLeft, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";

interface IneligibleLipsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IneligibleLipsDialog({ isOpen, onClose }: IneligibleLipsDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paginatedResult, setPaginatedResult] = useState<PaginatedIneligibleLipsResult | null>(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const requestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    if (!isOpen) return;
    const currentId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMsg(null);

    const res = await fetchIneligibleLipsAction({
      search: debouncedSearch,
      page,
      limit: 20,
    });

    // Discard response if a newer request has already been dispatched
    if (currentId !== requestIdRef.current) {
      return;
    }

    setIsLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
      setPaginatedResult(null);
    } else if (res.result) {
      setPaginatedResult(res.result);
    }
  }, [isOpen, debouncedSearch, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isOpen) return null;

  const total = paginatedResult?.total ?? 0;
  const totalPages = paginatedResult?.totalPages ?? 0;
  const data = paginatedResult?.data ?? [];
  const startRecord = total === 0 ? 0 : (page - 1) * 20 + 1;
  const endRecord = Math.min(page * 20, total);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[88vh] text-xs text-slate-900 animate-in fade-in-50 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Dokumen LIP Belum Memenuhi Syarat Setoran UT
              </h2>
              <p className="text-[11px] text-slate-500">
                Rincian alasan kelayakan dan kekurangan dana berdasarkan verifikasi pembayaran mahasiswa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition"
            title="Tutup Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Server Search & Summary */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama Mahasiswa, NIM, No. Registrasi, atau No. LIP..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-[11px] text-slate-600 font-medium">
              {isLoading ? (
                <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memuat data...</span>
                </span>
              ) : errorMsg ? (
                <span className="text-red-600 font-semibold">Gagal memuat data</span>
              ) : (
                <span>
                  Total: <strong className="text-slate-900 font-mono">{total}</strong> dokumen belum layak
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              title="Muat Ulang Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-2.5 py-1 bg-white border border-red-300 rounded-md text-red-700 font-semibold hover:bg-red-50 transition text-[11px]"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Content Table / Empty States */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading && !paginatedResult ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="font-medium text-xs">Memuat daftar dokumen LIP belum memenuhi syarat...</p>
            </div>
          ) : errorMsg && !paginatedResult ? (
            <div className="py-16 text-center text-red-600 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
              <p className="font-semibold text-xs">{errorMsg}</p>
              <p className="text-[11px] text-slate-500">Terjadi kesalahan pada query data server. Data tidak ditampilkan sebagai jumlah 0.</p>
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <p className="font-semibold text-xs text-slate-700">Tidak ada dokumen yang ditemukan</p>
              <p className="text-[11px] text-slate-400">
                {debouncedSearch
                  ? `Tidak ada hasil pencarian untuk "${debouncedSearch}".`
                  : "Semua dokumen LIP saat ini telah memenuhi syarat setoran UT."}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {data.map((item: IneligibleLipItem) => {
                return (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{item.studentName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          ({item.studentNim || item.registrationNumber})
                        </span>
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[9px] uppercase tracking-wide">
                          Belum Memenuhi Syarat
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600">
                        <span>
                          No. LIP: <strong className="text-blue-700">{item.lipNumber}</strong>
                        </span>
                        <span>
                          Kewajiban UT: <strong className="text-slate-900">Rp {item.officialAmount.toLocaleString("id-ID")}</strong>
                        </span>
                        <span>
                          Dana UT Terverifikasi: <strong className="text-emerald-700">Rp {item.verifiedUtFundAvailable.toLocaleString("id-ID")}</strong>
                        </span>
                        {item.utFundShortage > 0 && (
                          <span className="text-red-600 font-bold">
                            Kekurangan: Rp {item.utFundShortage.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="md:text-right shrink-0">
                      <span className="inline-block px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-medium text-[11px] max-w-sm">
                        {item.ineligibilityReason}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Server-Side Pagination */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs text-slate-600">
          <div>
            Menampilkan <strong className="text-slate-900">{startRecord}</strong> -{" "}
            <strong className="text-slate-900">{endRecord}</strong> dari{" "}
            <strong className="text-slate-900">{total}</strong> dokumen (20 per halaman)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="px-2 text-[11px] font-medium text-slate-500">
              Halaman <strong className="text-slate-900 font-bold">{page}</strong> dari{" "}
              <strong className="text-slate-900 font-bold">{Math.max(1, totalPages)}</strong>
            </span>

            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold shadow-2xs"
            >
              <span>Berikutnya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
