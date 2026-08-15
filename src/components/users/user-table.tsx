import { UserItem } from "@/types/user";
import { RoleCode } from "@/lib/auth/types";
import { ShieldCheck, UserX, UserCheck, Calendar, Clock, ShieldAlert } from "lucide-react";

interface UserTableProps {
  users: UserItem[];
  currentUserId: string;
  onEditRole: (user: UserItem) => void;
  onToggleStatus: (user: UserItem, targetIsActive: boolean) => void;
}

const ROLE_BADGES: Record<RoleCode, { label: string; badgeStyle: string }> = {
  owner: {
    label: "Owner / Pimpinan",
    badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
  },
  academic_admin: {
    label: "Admin Akademik",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  finance_admin: {
    label: "Admin Keuangan",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
  },
  viewer: {
    label: "Viewer / Auditor",
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function UserTable({
  users,
  currentUserId,
  onEditRole,
  onToggleStatus,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center border border-slate-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Pengguna Tidak Ditemukan</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Tidak ada data pengguna internal yang sesuai dengan kata kunci pencarian atau filter yang Anda pilih.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3.5">Nama & Email Pengguna</th>
              <th className="px-4 py-3.5">Peran Hak Akses (Role)</th>
              <th className="px-4 py-3.5">Status Akses</th>
              <th className="px-4 py-3.5">Terakhir Login</th>
              <th className="px-4 py-3.5">Tanggal Dibuat</th>
              <th className="px-4 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {users.map((user) => {
              const roleMeta = ROLE_BADGES[user.role] || ROLE_BADGES.viewer;
              const isSelf = user.id === currentUserId;

              const createdAtFormatted = new Date(user.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              const lastSignInFormatted = user.lastSignInAt
                ? new Date(user.lastSignInAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Belum pernah login";

              return (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  {/* Nama & Email */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{user.fullName}</span>
                          {isSelf && (
                            <span className="px-2 py-0.2 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                              Akun Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${roleMeta.badgeStyle}`}
                    >
                      <span>{roleMeta.label}</span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
                        user.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span>{user.isActive ? "Aktif" : "Nonaktif"}</span>
                    </span>
                  </td>

                  {/* Terakhir Login */}
                  <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{lastSignInFormatted}</span>
                    </div>
                  </td>

                  {/* Tanggal Dibuat */}
                  <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{createdAtFormatted}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {/* Change Role Button */}
                    <button
                      onClick={() => onEditRole(user)}
                      disabled={isSelf}
                      title={isSelf ? "Tidak dapat mengubah peran akun Anda sendiri" : "Ubah Peran Hak Akses"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Ubah Role</span>
                    </button>

                    {/* Toggle Status Button */}
                    {user.isActive ? (
                      <button
                        onClick={() => onToggleStatus(user, false)}
                        disabled={isSelf}
                        title={isSelf ? "Tidak dapat menonaktifkan akun Anda sendiri" : "Nonaktifkan Akses"}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Nonaktifkan</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onToggleStatus(user, true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Aktifkan</span>
                      </button>
                    )}
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
