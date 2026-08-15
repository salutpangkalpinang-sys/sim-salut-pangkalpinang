import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getStudentById, getStudentStatusHistory } from "@/features/students/queries";
import { getStudentRegistrations } from "@/features/registrations/queries";
import { getStudentPaymentsHistory } from "@/features/payments/queries";
import { MaskedText } from "@/components/ui/masked-text";
import { StatusHistoryTimeline } from "@/components/students/status-history-timeline";
import { StudentRegistrationList } from "@/components/registrations/student-registration-list";
import { StudentPaymentList } from "@/components/payments/student-payment-list";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, MapPin, GraduationCap, ShieldAlert } from "lucide-react";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const student = await getStudentById(id);

  if (!student) {
    notFound();
  }

  const [statusHistory, studentRegistrations, studentPayments] = await Promise.all([
    getStudentStatusHistory(id),
    getStudentRegistrations(id),
    getStudentPaymentsHistory(id),
  ]);

  const canEdit = profile.role === "owner" || profile.role === "academic_admin";

  const birthDateFormatted = student.birthDate
    ? new Date(student.birthDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/mahasiswa"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Mahasiswa</span>
        </Link>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0 font-bold text-xl">
            {student.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {student.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
              <span>NIM: {student.nim || "Calon Mahasiswa"}</span>
              <span>•</span>
              <span>NIK: <MaskedText text={student.nik} allowToggle={canEdit} /></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            {student.statusName || "Aktif"}
          </span>
        </div>
      </div>

      {/* Grid Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identitas, Kontak & Registrasi */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Identitas & Kontak */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <User className="w-4 h-4" />
              <span>Identitas & Kontak Pribadi</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Nama Lengkap</span>
                <span className="font-semibold text-slate-900">{student.fullName}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Jenis Kelamin</span>
                <span className="font-medium text-slate-800">
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Tempat, Tanggal Lahir</span>
                <span className="font-medium text-slate-800">
                  {student.birthPlace ? `${student.birthPlace}, ` : ""}{birthDateFormatted}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Nomor WhatsApp</span>
                {student.whatsapp ? (
                  <a
                    href={`https://wa.me/${student.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>+{student.whatsapp}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">-</span>
                )}
              </div>

              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Alamat Email</span>
                <span className="font-mono text-slate-800">{student.email || "-"}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Alamat */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <MapPin className="w-4 h-4" />
              <span>Domisili & Alamat</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Alamat Lengkap</span>
                <span className="text-slate-800">{student.address || "-"}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Kabupaten / Kota</span>
                <span className="text-slate-800">{student.city || "-"}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Akademik */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <GraduationCap className="w-4 h-4" />
              <span>Informasi Akademik UT</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Program Studi</span>
                <span className="font-semibold text-slate-900">
                  {student.studyProgramName || "-"} {student.studyProgramCode ? `(${student.studyProgramCode})` : ""}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Fakultas</span>
                <span className="text-slate-800">{student.facultyName || "-"}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Jenjang Studi</span>
                <span className="text-slate-800">{student.studyLevelName || "-"}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Skema Layanan</span>
                <span className="text-slate-800">{student.serviceSchemeName || "-"}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Angkatan / Tahun Masuk</span>
                <span className="font-mono text-slate-800">{student.entryYear || "-"}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Riwayat Registrasi Semester */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <StudentRegistrationList registrations={studentRegistrations} />
          </div>

          {/* Section 5: Riwayat Transaksi Pembayaran */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <StudentPaymentList payments={studentPayments} />
          </div>
        </div>

        {/* Right Column: Status History & Internal Notes */}
        <div className="space-y-6">
          {/* Status History Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <StatusHistoryTimeline history={statusHistory} />
          </div>

          {/* Catatan Internal */}
          {student.internalNotes && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2 shadow-sm">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Catatan Internal Petugas</span>
              </h3>
              <p className="text-xs text-slate-800 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed whitespace-pre-wrap">
                {student.internalNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
