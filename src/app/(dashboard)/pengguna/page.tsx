import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getUsersList, getUsersSummary } from "@/features/users/queries";
import { UserListContainer } from "@/components/users/user-list-container";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default async function PenggunaPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Server-Side Authorization: Owner ONLY
  if (profile.role !== "owner") {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-3 shadow-sm my-6">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center border border-red-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Akses Dibatasi (403 Forbidden)</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Peran Anda (<strong>{profile.role}</strong>) tidak memiliki izin server-side untuk mengelola pengguna dan hak akses internal SIM-SALUT. Modul ini hanya dapat diakses oleh **Owner / Pimpinan**.
        </p>
      </div>
    );
  }

  const [initialUsers, initialSummary] = await Promise.all([
    getUsersList(),
    getUsersSummary(),
  ]);

  return (
    <UserListContainer
      initialUsers={initialUsers}
      initialSummary={initialSummary}
      currentUserId={profile.id}
    />
  );
}
