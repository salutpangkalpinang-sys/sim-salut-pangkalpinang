import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAppSettings } from "@/features/settings/queries";
import { SettingsFormContainer } from "@/components/settings/settings-form-container";
import { redirect } from "next/navigation";
import { RoleCode } from "@/lib/auth/types";

const ROLE_LABELS: Record<RoleCode, string> = {
  owner: "Owner / Pimpinan",
  academic_admin: "Admin Akademik",
  finance_admin: "Admin Keuangan / Kasir",
  viewer: "Viewer / Auditor",
};

export default async function PengaturanPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const isOwner = profile.role === "owner";
  const roleName = ROLE_LABELS[profile.role] || "Pengguna";

  const initialSettings = await getAppSettings();

  return (
    <SettingsFormContainer
      initialSettings={initialSettings}
      isOwner={isOwner}
      roleName={roleName}
    />
  );
}
