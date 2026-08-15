import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getOperationalTransactionById } from "@/features/operational/queries";
import { OperationalDetailView } from "@/components/operational/operational-detail-view";
import { redirect, notFound } from "next/navigation";

export default async function KasOperasionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "academic_admin") {
    redirect("/dashboard");
  }

  const transaction = await getOperationalTransactionById(id);

  if (!transaction) {
    notFound();
  }

  return (
    <OperationalDetailView
      transaction={transaction}
      userRole={profile.role}
    />
  );
}
