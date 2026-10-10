import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getLipDocumentsList, getInvoicesList } from "@/features/lip-invoices/queries";
import { getRegistrationsList } from "@/features/registrations/queries";
import { getAppSettings } from "@/features/settings/queries";
import { LipInvoiceContainer } from "@/components/lip-invoices/lip-invoice-container";
import { computeRegistrationUtEstimate } from "@/lib/utils/tariff-resolver";
import { redirect } from "next/navigation";

export default async function LipTagihanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  let statusFilter: any = undefined;
  let initialTab = "lips";

  if (searchParams) {
    const resolvedParams = await searchParams;
    if (resolvedParams.status) {
      statusFilter = resolvedParams.status;
    }
    if (resolvedParams.tab === "lip" || resolvedParams.tab === "lips") {
      initialTab = "lips";
    } else if (resolvedParams.tab === "invoices") {
      initialTab = "invoices";
    }
  }

  const [lipsRes, invoicesRes, regsRes, appSettings] = await Promise.all([
    getLipDocumentsList({ limit: 50, status: statusFilter }),
    getInvoicesList({ limit: 50 }),
    getRegistrationsList({ limit: 100 }),
    getAppSettings(),
  ]);

  const registrationsOptions = (regsRes.data || [])
    .filter((r) => (r.status as string).toLowerCase() !== "cancelled" && (r.status as string).toLowerCase() !== "dibatalkan")
    .map((r) => {
      const salutSnapshot = r.feeSnapshots?.find((s) => s.feeTypeCode === "SALUT_SERVICE" || (s.feeNameSnapshot || "").toLowerCase().includes("salut"));
      const rawEstimatedUt = computeRegistrationUtEstimate(r.feeSnapshots);

      return {
        id: r.id,
        registrationNumber: r.registrationNumber,
        studentName: r.studentName || "Mahasiswa",
        studentNim: r.studentNim || null,
        academicPeriodName: r.academicPeriodName || "-",
        estimatedUtAmount: rawEstimatedUt,
        estimatedTotal: r.totalEstimateAmount || 0,
        salutFeeSnapshot: salutSnapshot?.totalAmount,
      };
    });

  return (
    <LipInvoiceContainer
      initialLips={lipsRes.data}
      initialLipTotal={lipsRes.total}
      initialInvoices={invoicesRes.data}
      initialInvoiceTotal={invoicesRes.total}
      userRole={profile.role}
      registrationsOptions={registrationsOptions}
      defaultSalutFee={appSettings.default_salut_fee}
      initialTab={initialTab}
      initialStatusFilter={statusFilter}
    />
  );
}
