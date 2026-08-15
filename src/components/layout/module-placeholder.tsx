import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { hasPermission, RoleCode } from "@/lib/auth/types";
import { redirect } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  allowedRoles: RoleCode[];
  checkpointNumber?: number;
}

export async function ModulePlaceholder({
  title,
  description,
  allowedRoles,
}: ModulePlaceholderProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const isAllowed = hasPermission(profile.role, allowedRoles);

  if (!isAllowed) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center border border-red-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Akses Dibatasi</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Peran Anda ({profile.role}) tidak memiliki izin server-side untuk mengakses modul {title}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center border border-slate-200">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-800">
            Modul ini belum tersedia.
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Halaman {title} sedang dalam pengembangan.
          </p>
        </div>
      </div>
    </div>
  );
}
