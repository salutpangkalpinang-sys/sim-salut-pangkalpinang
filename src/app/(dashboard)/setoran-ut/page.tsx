import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getUtRemittancesList, getEligibleLipsForRemittance } from "@/features/ut-remittances/queries";
import { getPaymentMasterOptions } from "@/features/payments/queries";
import { UtRemittanceContainer } from "@/components/ut-remittances/ut-remittance-container";
import { redirect } from "next/navigation";

export default async function SetoranUtPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search || "";
  const status = resolvedParams.status || "";

  const [remittancesRes, masterOptions, eligibleLips] = await Promise.all([
    getUtRemittancesList({ page, limit: 10, search, status }),
    getPaymentMasterOptions(),
    getEligibleLipsForRemittance(),
  ]);

  return (
    <UtRemittanceContainer
      initialRemittances={remittancesRes.data}
      initialTotal={remittancesRes.total}
      initialPage={remittancesRes.page}
      initialLimit={remittancesRes.limit}
      initialTotalPages={remittancesRes.totalPages}
      userRole={profile.role}
      cashAccounts={masterOptions.cashAccounts}
      eligibleLips={eligibleLips}
    />
  );
}
