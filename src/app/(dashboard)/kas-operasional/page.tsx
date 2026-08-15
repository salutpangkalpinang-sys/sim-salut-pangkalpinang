import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getOperationalTransactionsList, getOperationalCategoriesList } from "@/features/operational/queries";
import { getPaymentMasterOptions } from "@/features/payments/queries";
import { OperationalContainer } from "@/components/operational/operational-container";
import { redirect } from "next/navigation";

export default async function KasOperasionalPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    type?: string;
    category?: string;
    status?: string;
  }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // RBAC Check: Academic Admin is restricted from operational transactions
  if (profile.role === "academic_admin") {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search || "";
  const transactionType = resolvedParams.type || "";
  const categoryId = resolvedParams.category || "";
  const status = resolvedParams.status || "";

  const [transactionsRes, masterOptions, categories] = await Promise.all([
    getOperationalTransactionsList({
      page,
      limit: 10,
      search,
      transactionType,
      categoryId,
      status,
    }),
    getPaymentMasterOptions(),
    getOperationalCategoriesList(),
  ]);

  return (
    <OperationalContainer
      initialTransactions={transactionsRes.data}
      initialTotal={transactionsRes.total}
      initialPage={transactionsRes.page}
      initialLimit={transactionsRes.limit}
      initialTotalPages={transactionsRes.totalPages}
      userRole={profile.role}
      cashAccounts={masterOptions.cashAccounts}
      categories={categories}
    />
  );
}
