"use client";

import Link from "next/link";
import { Student } from "@/types/student";
import { MaskedText } from "@/components/ui/masked-text";
import { Eye, Edit2, ArrowLeft, ArrowRight, UserCheck } from "lucide-react";
import { RoleCode } from "@/lib/auth/types";

interface StudentTableProps {
  students: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userRole: RoleCode;
  onPageChange: (newPage: number) => void;
  onEdit?: (student: Student) => void;
  onChangeStatus?: (student: Student) => void;
  isCalonView?: boolean;
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  CALON: "bg-amber-50 text-amber-700 border-amber-200",
  AKTIF: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CUTI: "bg-blue-50 text-blue-700 border-blue-200",
  NONAKTIF: "bg-slate-100 text-slate-700 border-slate-200",
  DO: "bg-red-50 text-red-700 border-red-200",
  LULUS: "bg-purple-50 text-purple-700 border-purple-200",
};

export function StudentTable({
  students,
  total,
  page,
  limit,
  totalPages,
  userRole,
  onPageChange,
  onEdit,
  onChangeStatus,
  isCalonView = false,
}: StudentTableProps) {
  const canEdit = userRole === "owner" || userRole === "academic_admin";

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <UserCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          {isCalonView ? "Belum Ada Data Calon Mahasiswa" : "Belum Ada Data Mahasiswa"}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Data tidak ditemukan atau belum dimasukkan ke dalam sistem. Silakan tambah data baru atau sesuaikan filter pencarian Anda.
        </p>
      </div>
    );
  }

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                {!isCalonView && <th className="px-4 py-3">NIM</th>}
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">NIK (Masked)</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Program Studi</th>
                <th className="px-4 py-3">Angkatan</th>
                <th className="px-4 py-3">Skema</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {students.map((student) => {
                const statusColor =
                  STATUS_BADGE_COLORS[student.statusCode || ""] ||
                  "bg-slate-100 text-slate-700 border-slate-200";
                const detailHref = isCalonView
                  ? `/calon-mahasiswa/${student.id}`
                  : `/mahasiswa/${student.id}`;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition">
                    {!isCalonView && (
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">
                        {student.nim || <span className="text-slate-400 italic">Belum Ada</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={detailHref} className="hover:text-blue-600 transition">
                        {student.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <MaskedText text={student.nik} allowToggle={canEdit} />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {student.whatsapp ? (
                        <a
                          href={`https://wa.me/${student.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-600 transition underline decoration-emerald-500/30"
                        >
                          +{student.whatsapp}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{student.studyProgramName || "-"}</div>
                      <div className="text-[10px] text-slate-400">{student.facultyName || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {student.entryYear || <span className="text-slate-400 italic">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {student.serviceSchemeName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded-full ${statusColor}`}
                      >
                        {student.statusName || student.statusCode || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={detailHref}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-slate-200 transition"
                          title="Lihat Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {canEdit && onChangeStatus && (
                          <button
                            type="button"
                            onClick={() => onChangeStatus(student)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition border border-amber-200"
                            title="Ubah Status"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(student)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200"
                            title="Edit Data"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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

        {/* Table Footer Pagination */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
            <span className="font-semibold text-slate-800">{endRecord}</span> dari{" "}
            <span className="font-semibold text-slate-800">{total}</span> data
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
