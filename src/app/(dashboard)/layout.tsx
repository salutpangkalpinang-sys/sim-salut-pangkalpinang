import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAppSettings } from "@/features/settings/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, settings] = await Promise.all([
    getCurrentUserProfile(),
    getAppSettings(),
  ]);

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <Sidebar
        userRole={profile.role}
        salutName={settings.salut_name}
        salutCity={settings.salut_city}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header profile={profile} officialName={settings.salut_official_name} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
