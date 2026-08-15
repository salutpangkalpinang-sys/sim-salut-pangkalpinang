import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getUtRemittanceById } from "@/features/ut-remittances/queries";
import { UtRemittanceDetailView } from "@/components/ut-remittances/ut-remittance-detail-view";
import { redirect, notFound } from "next/navigation";

export default async function SetoranUtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const remittance = await getUtRemittanceById(id);

  if (!remittance) {
    notFound();
  }

  return (
    <UtRemittanceDetailView
      remittance={remittance}
      userRole={profile.role}
    />
  );
}
