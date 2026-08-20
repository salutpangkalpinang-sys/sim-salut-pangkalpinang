"use client";

import { useState } from "react";
import { Student, MasterOption } from "@/types/student";
import { StudentFormInput, studentSchema } from "@/lib/validation/student";
import { createStudentAction, updateStudentAction } from "@/features/students/actions";
import { X, UserPlus, Save, AlertCircle, Sparkles } from "lucide-react";
import { deriveUtMasaCode, formatUtMasaLabel, generateUtMasaOptions } from "@/lib/utils/ut-masa";
import { DatePickerId } from "@/components/ui/date-picker-id";

interface StudentFormProps {
  initialData?: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  options: {
    faculties: MasterOption[];
    studyLevels: MasterOption[];
    studyPrograms: (MasterOption & { faculty_id?: string; study_level_id?: string })[];
    serviceSchemes: MasterOption[];
    statuses: MasterOption[];
    activeAcademicPeriod?: MasterOption | null;
  };
  isCalonMode?: boolean;
}

export function StudentForm({
  initialData,
  isOpen,
  onClose,
  onSuccess,
  options,
  isCalonMode = false,
}: StudentFormProps) {
  const isEditing = Boolean(initialData);

  const defaultStatus =
    options.statuses.find((s) => s.code === (isCalonMode ? "CALON" : "AKTIF")) ||
    options.statuses[0];

  // Auto-derive 5-digit UT Masa code based on date rules: Oct-Jan -> NNNN1, Feb-Sep -> NNNN2
  const autoDerivedEntryYear = deriveUtMasaCode();
  const masaSelectOptions = generateUtMasaOptions(2020, 2030);

  const [formData, setFormData] = useState<Partial<StudentFormInput>>({
    fullName: initialData?.fullName || "",
    nim: initialData?.nim || "",
    nik: initialData?.nik || "",
    birthPlace: initialData?.birthPlace || "",
    birthDate: initialData?.birthDate || "",
    gender: initialData?.gender || undefined,
    whatsapp: initialData?.whatsapp || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    city: initialData?.city || "Pangkalpinang",
    entryYear: initialData?.entryYear || autoDerivedEntryYear,
    facultyId: initialData?.facultyId || "",
    studyLevelId: initialData?.studyLevelId || "",
    studyProgramId: initialData?.studyProgramId || "",
    serviceSchemeId: initialData?.serviceSchemeId || "",
    statusId: initialData?.statusId || defaultStatus?.id || "",
    internalNotes: initialData?.internalNotes || "",
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleProgramChange = (programId: string) => {
    const selectedProg = options.studyPrograms.find((p) => p.id === programId);
    setFormData((prev) => ({
      ...prev,
      studyProgramId: programId,
      facultyId: selectedProg?.faculty_id || prev.facultyId,
      studyLevelId: selectedProg?.study_level_id || prev.studyLevelId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = studentSchema.safeParse(formData);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || "Silakan periksa kembali isian form Anda.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = isEditing && initialData
        ? await updateStudentAction(initialData.id, validation.data)
        : await createStudentAction(validation.data);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 text-slate-900">
        {/* Form Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEditing
                  ? "Edit Data Mahasiswa"
                  : isCalonMode
                  ? "Tambah Calon Mahasiswa Baru"
                  : "Tambah Mahasiswa Baru"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Isikan informasi identitas, kontak, dan akademik mahasiswa
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

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* SECTION 1: IDENTITAS */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1">
              1. Identitas Pribadi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div className="md:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName || ""}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  NIM <span className="text-slate-400 text-[10px]">(Opsional/Bisa Kosong)</span>
                </label>
                <input
                  type="text"
                  value={formData.nim || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const calonStatus = options.statuses.find((s) => s.code === "CALON");
                    const aktifStatus = options.statuses.find((s) => s.code === "AKTIF");

                    let newStatusId = formData.statusId;
                    if (val.trim() !== "") {
                      if (aktifStatus && (!formData.statusId || formData.statusId === calonStatus?.id)) {
                        newStatusId = aktifStatus.id;
                      }
                    } else {
                      if (calonStatus && (!formData.statusId || formData.statusId === aktifStatus?.id)) {
                        newStatusId = calonStatus.id;
                      }
                    }

                    setFormData((prev) => ({
                      ...prev,
                      nim: val,
                      statusId: newStatusId,
                    }));
                  }}
                  placeholder="041234567"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  NIK <span className="text-slate-400 text-[10px]">(16 Digit / Opsional)</span>
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={formData.nik || ""}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  placeholder="1971012345670001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  value={formData.birthPlace || ""}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  placeholder="Pangkalpinang"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <DatePickerId
                label="Tanggal Lahir"
                value={formData.birthDate || ""}
                onChange={(iso) => setFormData({ ...formData, birthDate: iso })}
              />

              <div>
                <label className="block text-slate-700 font-medium mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender || ""}
                  onChange={(e) => setFormData({ ...formData, gender: (e.target.value as "L" | "P") || null })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: KONTAK & ALAMAT */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1">
              2. Kontak & Alamat
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nomor WhatsApp</label>
                <input
                  type="text"
                  value={formData.whatsapp || ""}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="budi@example.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Jl. Merdeka No. 45"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.city || ""}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Pangkalpinang"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: AKADEMIK */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider border-b border-slate-200 pb-1">
              3. Data Akademik
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Program Studi</label>
                <select
                  value={formData.studyProgramId || ""}
                  onChange={(e) => handleProgramChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Program Studi</option>
                  {options.studyPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Fakultas</label>
                <select
                  value={formData.facultyId || ""}
                  onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Fakultas</option>
                  {options.faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Jenjang Studi</label>
                <select
                  value={formData.studyLevelId || ""}
                  onChange={(e) => setFormData({ ...formData, studyLevelId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Jenjang</option>
                  {options.studyLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Skema Layanan</label>
                <select
                  value={formData.serviceSchemeId || ""}
                  onChange={(e) => setFormData({ ...formData, serviceSchemeId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Skema</option>
                  {options.serviceSchemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center justify-between">
                  <span>Angkatan</span>
                  {!isEditing && (
                    <span className="text-xs text-blue-600 font-normal flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto
                    </span>
                  )}
                </label>
                <select
                  value={formData.entryYear || autoDerivedEntryYear}
                  onChange={(e) => setFormData({ ...formData, entryYear: parseInt(e.target.value, 10) || null })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium font-mono"
                >
                  {/* Current value fallback if not in options */}
                  {formData.entryYear && !masaSelectOptions.some((o) => o.value === formData.entryYear) && (
                    <option value={formData.entryYear}>
                      {formData.entryYear}
                    </option>
                  )}
                  {masaSelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Status Mahasiswa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.statusId || ""}
                  onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {options.statuses.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: INTERNAL NOTES */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Catatan Internal</label>
            <textarea
              rows={2}
              value={formData.internalNotes || ""}
              onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              placeholder="Catatan khusus petugas..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Form Actions */}
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
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Simpan Perubahan" : "Tambah Mahasiswa"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
