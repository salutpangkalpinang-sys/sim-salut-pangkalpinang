"use client";

import { useState, useEffect } from "react";
import { CandidateFeeRate, RegistrationType } from "@/types/registration";
import { RegistrationFormInput, registrationSchema } from "@/lib/validation/registration";
import { createRegistrationAction, getAvailableCandidateFeeRatesAction } from "@/features/registrations/actions";
import { X, FileCheck, Save, AlertCircle, Plus, Trash2, Calculator } from "lucide-react";

interface RegistrationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  options: {
    academicPeriods: { id: string; code: string; name: string }[];
    registrationTypes: RegistrationType[];
    studyPrograms: { id: string; code: string; name: string }[];
    serviceSchemes: { id: string; code: string; name: string }[];
    students: { id: string; nim: string | null; full_name: string; study_program_id: string | null; service_scheme_id: string | null }[];
  };
}

interface FeeSnapshotRow {
  sourceFeeRateId?: string;
  feeTypeId: string;
  feeNameSnapshot: string;
  calculationType: "FIXED" | "PER_SKS";
  quantity: number;
  unitAmount: number;
  totalAmount: number;
}

export function RegistrationForm({
  isOpen,
  onClose,
  onSuccess,
  options,
}: RegistrationFormProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [academicPeriodId, setAcademicPeriodId] = useState(options.academicPeriods[0]?.id || "");
  const [registrationTypeId, setRegistrationTypeId] = useState(options.registrationTypes[0]?.id || "");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [serviceSchemeId, setServiceSchemeId] = useState("");
  const [credits, setCredits] = useState(0);
  const [notes, setNotes] = useState("");

  const [feeRows, setFeeRows] = useState<FeeSnapshotRow[]>([]);
  const [candidateRates, setCandidateRates] = useState<CandidateFeeRate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStudentSelect = (stdId: string) => {
    setSelectedStudentId(stdId);
    const std = options.students.find((s) => s.id === stdId);
    if (std) {
      setStudyProgramId(std.study_program_id || options.studyPrograms[0]?.id || "");
      setServiceSchemeId(std.service_scheme_id || options.serviceSchemes[0]?.id || "");
    }
  };

  useEffect(() => {
    if (studyProgramId && serviceSchemeId && academicPeriodId) {
      getAvailableCandidateFeeRatesAction(studyProgramId, serviceSchemeId, academicPeriodId)
        .then((rates) => {
          setCandidateRates(rates);
          if (rates.length > 0) {
            const initialRows: FeeSnapshotRow[] = rates.map((r) => {
              const qty = r.isPerSks ? Math.max(1, credits) : 1;
              return {
                sourceFeeRateId: r.id,
                feeTypeId: r.feeTypeId,
                feeNameSnapshot: r.name,
                calculationType: r.calculationType,
                quantity: qty,
                unitAmount: r.unitAmount,
                totalAmount: qty * r.unitAmount,
              };
            });
            setFeeRows(initialRows);
          }
        })
        .catch(console.warn);
    }
  }, [studyProgramId, serviceSchemeId, academicPeriodId, credits]);

  if (!isOpen) return null;

  const updateFeeRow = (index: number, field: keyof FeeSnapshotRow, val: any) => {
    const updated = [...feeRows];
    const row = { ...updated[index], [field]: val };
    if (field === "quantity" || field === "unitAmount") {
      const q = Math.max(1, Number(row.quantity) || 1);
      const u = Math.max(0, Number(row.unitAmount) || 0);
      row.quantity = q;
      row.unitAmount = u;
      row.totalAmount = q * u;
    }
    updated[index] = row;
    setFeeRows(updated);
  };

  const removeFeeRow = (index: number) => {
    setFeeRows(feeRows.filter((_, i) => i !== index));
  };

  const addCandidateRateToRows = (rate: CandidateFeeRate) => {
    const qty = rate.isPerSks ? Math.max(1, credits) : 1;
    setFeeRows((prev) => [
      ...prev,
      {
        sourceFeeRateId: rate.id,
        feeTypeId: rate.feeTypeId,
        feeNameSnapshot: rate.name,
        calculationType: rate.calculationType,
        quantity: qty,
        unitAmount: rate.unitAmount,
        totalAmount: qty * rate.unitAmount,
      },
    ]);
  };

  const grandTotalEstimate = feeRows.reduce((acc, r) => acc + r.totalAmount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload: RegistrationFormInput = {
      studentId: selectedStudentId,
      academicPeriodId,
      registrationTypeId,
      studyProgramId,
      serviceSchemeId,
      credits: Number(credits) || 0,
      notes,
      feeSnapshots: feeRows.map((r) => ({
        sourceFeeRateId: r.sourceFeeRateId,
        feeTypeId: r.feeTypeId,
        feeNameSnapshot: r.feeNameSnapshot,
        calculationType: r.calculationType,
        quantity: r.quantity,
        unitAmount: r.unitAmount,
        sourceSnapshot: "Master Rate Snapshot",
      })),
    };

    const validation = registrationSchema.safeParse(payload);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || "Silakan periksa kembali isian registrasi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createRegistrationAction(validation.data);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat registrasi semester.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 text-slate-900">
        {/* Form Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Buat Registrasi Semester & Snapshot Tarif
              </h2>
              <p className="text-[11px] text-slate-500">
                Simpan registrasi semester dan snapshot nominal master tarif
              </p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* STEP 1: MAHAKASISWA */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1">
              1. Pilih Mahasiswa
            </h3>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Mahasiswa <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Pilih Mahasiswa Terdaftar</option>
                {options.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.nim ? `(NIM: ${s.nim})` : "(Calon Mahasiswa)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 2 & 3: PERIODE & KONTEKS AKADEMIK */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1">
              2. Periode & Konteks Akademik Registrasi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Periode Akademik <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={academicPeriodId}
                  onChange={(e) => setAcademicPeriodId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {options.academicPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Jenis Registrasi <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={registrationTypeId}
                  onChange={(e) => setRegistrationTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {options.registrationTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Program Studi (Konteks Snapshot) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={studyProgramId}
                  onChange={(e) => setStudyProgramId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Program Studi</option>
                  {options.studyPrograms.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Skema Layanan (Konteks Snapshot) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={serviceSchemeId}
                  onChange={(e) => setServiceSchemeId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Skema</option>
                  {options.serviceSchemes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Jumlah SKS</label>
                <input
                  type="number"
                  min={0}
                  max={36}
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: FEE RATE SELECTION & SNAPSHOT LINES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4" />
                <span>3. Pemilihan Master Tarif & Snapshot Komponen Biaya</span>
              </h3>
              {candidateRates.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {candidateRates.length} Tarif Master Valid Ditemukan
                </span>
              )}
            </div>

            {candidateRates.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-600 font-medium">Tambah Komponen Tarif Master:</span>
                {candidateRates.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addCandidateRateToRows(r)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 text-blue-700 hover:text-blue-800 rounded-md transition shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{r.name} (Rp {r.unitAmount.toLocaleString("id-ID")})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Fee Snapshot Lines Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Komponen Biaya</th>
                    <th className="px-3 py-2">Metode Hitung</th>
                    <th className="px-3 py-2 w-20">Qty</th>
                    <th className="px-3 py-2">Satuan (Rp)</th>
                    <th className="px-3 py-2">Total Snapshot</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {feeRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.feeNameSnapshot}
                          onChange={(e) => updateFeeRow(idx, "feeNameSnapshot", e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-slate-900 font-medium"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">
                        {row.calculationType}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateFeeRow(idx, "quantity", e.target.value)}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={row.unitAmount}
                          onChange={(e) => updateFeeRow(idx, "unitAmount", e.target.value)}
                          className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-emerald-600">
                        Rp {row.totalAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeFeeRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1 transition"
                          title="Hapus Baris Snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Estimate Calculation Summary Banner */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block">
                  Total Estimasi Berdasarkan Master Tarif (Bukan Total Resmi UT)
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {feeRows.length} Komponen Biaya Disnapshot
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Estimasi Snapshot</span>
                <span className="text-lg font-bold font-mono text-emerald-600">
                  Rp {grandTotalEstimate.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-medium">Catatan Registrasi</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan registrasi semester..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition border border-slate-300"
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
                  <span>Menyimpan Registrasi...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Registrasi Atomik</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
