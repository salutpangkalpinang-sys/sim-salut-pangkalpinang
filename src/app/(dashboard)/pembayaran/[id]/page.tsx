import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getPaymentById, getPaymentReceiptData } from "@/features/payments/queries";
import { PaymentDetailView } from "@/components/payments/payment-detail-view";
import { redirect, notFound } from "next/navigation";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const payment = await getPaymentById(id);

  if (!payment) {
    notFound();
  }

  let receiptData = null;
  if (payment.status === "verified" || payment.status === "voided") {
    receiptData = await getPaymentReceiptData(id);
  }

  return (
    <PaymentDetailView
      payment={payment}
      receiptData={receiptData}
      userRole={profile.role}
    />
  );
}
