import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getPaymentsList, getPaymentMasterOptions } from "@/features/payments/queries";
import { PaymentListContainer } from "@/components/payments/payment-list-container";
import { redirect } from "next/navigation";

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; method?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search || "";
  const status = (resolvedParams.status || "") as any;
  const method = resolvedParams.method || "";

  const [paymentsRes, masterOptions] = await Promise.all([
    getPaymentsList({ page, limit: 10, search, status, paymentMethodId: method }),
    getPaymentMasterOptions(),
  ]);

  return (
    <PaymentListContainer
      initialPayments={paymentsRes.data}
      initialTotal={paymentsRes.total}
      initialPage={paymentsRes.page}
      initialLimit={paymentsRes.limit}
      initialTotalPages={paymentsRes.totalPages}
      userRole={profile.role}
      options={masterOptions}
    />
  );
}
