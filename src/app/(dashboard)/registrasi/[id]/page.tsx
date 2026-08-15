import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getRegistrationById } from "@/features/registrations/queries";
import { getRegistrationLipAndInvoices } from "@/features/lip-invoices/queries";
import { RegistrationLipInvoiceList } from "@/components/lip-invoices/registration-lip-invoice-list";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileCheck, User, Calculator, AlertTriangle, Calendar, Award, ShieldAlert } from "lucide-react";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const reg = await getRegistrationById(id);

  if (!reg) {
    notFound();
  }

  const { lipDocuments, invoices } = await getRegistrationLipAndInvoices(id);

  const createdAtFormatted = new Date(reg.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const grandTotalEstimate = (reg.feeSnapshots || []).reduce(
    (acc, line) => acc + line.totalAmount,
    0
  );

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/registrasi"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Registrasi</span>
        </Link>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
            <FileCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-blue-600 tracking-tight">
                {reg.registrationNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  reg.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : reg.status === "cancelled"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {reg.status === "active" ? "Aktif" : reg.status === "cancelled" ? "Dibatalkan" : "Draft"}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Registrasi Semester — {reg.studentName} ({reg.studentNim || "Calon Mahasiswa"})
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div className="flex items-center justify-end gap-1 font-mono">
            <Calendar className="w-3.5 h-3.5" />
            <span>Dibuat: {createdAtFormatted}</span>
          </div>
        </div>
      </div>

      {/* Cancellation Banner Warning */}
      {reg.status === "cancelled" && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 text-xs space-y-1 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-red-700">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>REGISTRASI SEMESTER INI TELAH DIBATALKAN</span>
          </div>
          <p>
            Alasan Pembatalan: &ldquo;{reg.cancellationReason || "Tidak disebutkan"}&rdquo;
          </p>
        </div>
      )}

      {/* Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Left Column: Mahasiswa & Context */}
        <div className="space-y-6">
          {/* Mahasiswa Info Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <User className="w-4 h-4" />
              <span>Identitas Mahasiswa</span>
            </h2>
            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block text-[11px]">Nama Mahasiswa</span>
                <Link
                  href={`/mahasiswa/${reg.studentId}`}
                  className="font-bold text-slate-900 hover:text-blue-600 transition"
                >
                  {reg.studentName}
                </Link>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">NIM</span>
                <span className="font-mono text-slate-800">{reg.studentNim || "Calon Mahasiswa"}</span>
              </div>
            </div>
          </div>

          {/* Konteks Akademik Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Award className="w-4 h-4" />
              <span>Konteks Akademik Snapshot</span>
            </h2>
            <div className="space-y-2.5">
              <div>
                <span className="text-slate-500 block text-[11px]">Periode Akademik</span>
                <span className="font-semibold text-slate-900">{reg.academicPeriodName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Jenis Registrasi</span>
                <span className="text-slate-800">{reg.registrationTypeName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Program Studi Snapshot</span>
                <span className="text-slate-800">{reg.studyProgramName} ({reg.studyProgramCode})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Skema Layanan Snapshot</span>
                <span className="text-slate-800">{reg.serviceSchemeName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Jumlah SKS</span>
                <span className="font-mono font-bold text-slate-800">{reg.credits} SKS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Fee Snapshots Table & Estimate */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4" />
                <span>Rincian Snapshot Tarif Master (Estimasi Awal)</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {reg.feeSnapshots?.length || 0} Baris Snapshot
              </span>
            </div>

            {/* Snapshot Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Nama Komponen Tarif (Snapshot)</th>
                    <th className="px-4 py-3">Metode Hitung</th>
                    <th className="px-4 py-3">Kuantitas</th>
                    <th className="px-4 py-3">Satuan (Rp)</th>
                    <th className="px-4 py-3 text-right">Total Snapshot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {(reg.feeSnapshots || []).map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{line.feeNameSnapshot}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {line.calculationType}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-800">
                        Rp {line.unitAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-right">
                        Rp {line.totalAmount.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Estimate Calculation Summary Banner */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Estimasi Berdasarkan Master Tarif</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
                  Nominal ini adalah estimasi awal berdasarkan snapshot tarif. <strong>Belum merupakan total resmi UT.</strong> Total resmi kewajiban UT berasal dari Dokumen LIP resmi.
                </p>

              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-slate-500 block">Total Estimasi Snapshot</span>
                <span className="text-xl font-bold font-mono text-emerald-600">
                  Rp {grandTotalEstimate.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Integrated LIP Documents & Invoice Tagihan List Component */}
          <RegistrationLipInvoiceList
            registrationId={reg.id}
            registrationNumber={reg.registrationNumber}
            studentName={reg.studentName || "Mahasiswa"}
            studentNim={reg.studentNim || null}
            academicPeriodName={reg.academicPeriodName || "-"}
            feeEstimateAmount={grandTotalEstimate}
            lipDocuments={lipDocuments}
            invoices={invoices}
            userRole={profile.role}
          />
        </div>
      </div>
    </div>
  );
}
