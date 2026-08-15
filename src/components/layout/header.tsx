"use client";

import { logoutAction } from "@/app/(auth)/actions";
import { UserProfile } from "@/lib/auth/types";
import { LogOut, UserCheck } from "lucide-react";

interface HeaderProps {
  profile: UserProfile | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: {
    label: "Owner / Pimpinan",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  academic_admin: {
    label: "Admin Akademik",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  finance_admin: {
    label: "Admin Keuangan",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  viewer: {
    label: "Viewer / Auditor",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function Header({ profile }: HeaderProps) {
  const roleBadge = ROLE_LABELS[profile?.role || "viewer"] || ROLE_LABELS.viewer;

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-800">
          Sentra Layanan UT Pangkalpinang
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-slate-800">
              {profile?.fullName || "Pengguna"}
            </p>
            <span
              className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded-full ${roleBadge.color}`}
            >
              {roleBadge.label}
            </span>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition"
            title="Keluar dari akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </header>
  );
}
