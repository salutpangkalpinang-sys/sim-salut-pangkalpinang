import { getCurrentUserProfile } from "@/lib/auth/permissions";
import {
  getStudentReport,
  getRegistrationReport,
  getInvoiceReport,
  getReceivablesReport,
  getPaymentReport,
  getUtRemittanceReport,
  getUtOutstandingReport,
  getServiceFeeReport,
  getOperationalReport,
  getCashFlowReport,
} from "@/features/reports/queries";
import { ReportHubContainer } from "@/components/reports/report-hub-container";
import { redirect } from "next/navigation";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const initialTab = resolvedParams.tab || "akademik";

  const [
    studentsRes,
    registrationsRes,
    invoicesRes,
    receivablesRes,
    paymentsRes,
    utRemittancesRes,
    utOutstandingRes,
    serviceFeesRes,
    operationalRes,
    cashFlowRes,
  ] = await Promise.all([
    getStudentReport({ page: 1, limit: 10 }),
    getRegistrationReport({ page: 1, limit: 10 }),
    getInvoiceReport({ page: 1, limit: 10 }),
    getReceivablesReport({ page: 1, limit: 10 }),
    getPaymentReport({ page: 1, limit: 10 }),
    getUtRemittanceReport({ page: 1, limit: 10 }),
    getUtOutstandingReport({ page: 1, limit: 10 }),
    getServiceFeeReport({ page: 1, limit: 10 }),
    getOperationalReport({ page: 1, limit: 10 }),
    getCashFlowReport(),
  ]);

  return (
    <ReportHubContainer
      userRole={profile.role}
      initialTab={initialTab}
      reportsData={{
        students: studentsRes,
        registrations: registrationsRes,
        invoices: invoicesRes,
        receivables: receivablesRes,
        payments: paymentsRes,
        utRemittances: utRemittancesRes,
        utOutstanding: utOutstandingRes,
        serviceFees: serviceFeesRes,
        operational: operationalRes,
        cashFlow: cashFlowRes,
      }}
    />
  );
}
