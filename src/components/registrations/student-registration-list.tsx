import Link from "next/link";
import { Registration } from "@/types/registration";
import { FileCheck, Eye } from "lucide-react";

interface StudentRegistrationListProps {
  registrations: Registration[];
}

export function StudentRegistrationList({ registrations }: StudentRegistrationListProps) {
  if (registrations.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
        Belum ada riwayat registrasi semester yang tercatat untuk mahasiswa ini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2">
        <FileCheck className="w-4 h-4 text-blue-600" />
        <span>Riwayat Registrasi Semester ({registrations.length})</span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2">No. Registrasi</th>
              <th className="px-3 py-2">Periode</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Prodi / Skema (Snapshot)</th>
              <th className="px-3 py-2">SKS</th>
              <th className="px-3 py-2">Estimasi Tarif</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {registrations.map((reg) => {
              const formattedAmount = (reg.totalEstimateAmount || 0).toLocaleString("id-ID");

              return (
                <tr key={reg.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-medium text-blue-600">
                    <Link href={`/registrasi/${reg.id}`} className="hover:underline">
                      {reg.registrationNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{reg.academicPeriodName}</td>
                  <td className="px-3 py-2 text-slate-700">{reg.registrationTypeName}</td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{reg.studyProgramName}</div>
                    <div className="text-[10px] text-slate-500">{reg.serviceSchemeName}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">{reg.credits} SKS</td>
                  <td className="px-3 py-2 font-mono font-semibold text-emerald-600">
                    Rp {formattedAmount}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                        reg.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : reg.status === "cancelled"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {reg.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/registrasi/${reg.id}`}
                      className="p-1 rounded bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition inline-block border border-slate-200 shadow-xs"
                      title="Lihat Detail Snapshot"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
