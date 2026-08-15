"use client";

import Link from "next/link";
import { Registration } from "@/types/registration";
import { Eye, Ban, FileCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { RoleCode } from "@/lib/auth/types";

interface RegistrationTableProps {
  registrations: Registration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userRole: RoleCode;
  onPageChange: (newPage: number) => void;
  onCancel?: (registration: Registration) => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  draft: {
    label: "Draft",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "bg-red-50 text-red-700 border-red-200",
  },
};

export function RegistrationTable({
  registrations,
  total,
  page,
  limit,
  totalPages,
  userRole,
  onPageChange,
  onCancel,
}: RegistrationTableProps) {
  const canMutate = userRole === "owner" || userRole === "academic_admin";

  if (registrations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <FileCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          Belum Ada Data Registrasi Semester
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Data registrasi belum dimasukkan ke dalam sistem. Silakan buat registrasi semester baru untuk mahasiswa terdaftar.
        </p>
      </div>
    );
  }

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">No. Registrasi</th>
                <th className="px-4 py-3">Mahasiswa</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Jenis Registrasi</th>
                <th className="px-4 py-3">Program Studi</th>
                <th className="px-4 py-3">Skema</th>
                <th className="px-4 py-3">SKS</th>
                <th className="px-4 py-3">Total Estimasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {registrations.map((reg) => {
                const statusBadge =
                  STATUS_BADGES[reg.status] || STATUS_BADGES.active;
                const formattedAmount = (reg.totalEstimateAmount || 0).toLocaleString("id-ID");

                return (
                  <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-medium text-blue-600">
                      <Link href={`/registrasi/${reg.id}`} className="hover:underline">
                        {reg.registrationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/mahasiswa/${reg.studentId}`} className="hover:text-blue-600 transition">
                        {reg.studentName || "Mahasiswa"}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-mono">
                        NIM: {reg.studentNim || "Calon"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {reg.academicPeriodName || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {reg.registrationTypeName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div>{reg.studyProgramName || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {reg.serviceSchemeName || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {reg.credits} SKS
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                      Rp {formattedAmount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded-full ${statusBadge.color}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/registrasi/${reg.id}`}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition"
                          title="Lihat Detail Rincian Snapshot"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {canMutate && reg.status !== "cancelled" && onCancel && (
                          <button
                            type="button"
                            onClick={() => onCancel(reg)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition"
                            title="Batalkan Registrasi"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
            <span className="font-semibold text-slate-800">{endRecord}</span> dari{" "}
            <span className="font-semibold text-slate-800">{total}</span> data registrasi
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="text-xs text-slate-500 px-2">
                Halaman <strong className="text-slate-800">{page}</strong> dari{" "}
                <strong className="text-slate-800">{totalPages}</strong>
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <span>Berikutnya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
