import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAppSettings } from "@/features/settings/queries";
import {
  getDashboardKpiMetrics,
  getLatestPaymentsWidget,
  getOverdueInvoicesWidget,
  getPendingLipsWidget,
  getOutstandingUtPriorityWidget,
} from "@/features/dashboard/queries";
import { getRegistrationMasterOptions } from "@/features/registrations/queries";
import { DashboardKpiCards } from "@/components/dashboard/dashboard-kpi-cards";
import { DashboardWidgets } from "@/components/dashboard/dashboard-widgets";
import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodId?: string }>;
}) {
  const [profile, appSettings] = await Promise.all([
    getCurrentUserProfile(),
    getAppSettings(),
  ]);

  if (!profile) {
    redirect("/login");
  }

  let periodId: string | undefined = undefined;
  try {
    if (searchParams) {
      const resolvedParams = await searchParams;
      periodId = resolvedParams?.periodId;
    }
  } catch (e) {
    console.warn("Failed to parse searchParams in DashboardPage:", e);
  }

  let metrics = {
    activeStudents: 0,
    candidateStudents: 0,
    semesterRegistrations: 0,
    totalInvoicesBilled: 0,
    studentPaymentsVerified: 0,
    studentReceivables: 0,
    utLiability: 0,
    utRemittancesVerified: 0,
    outstandingUtLiability: 0,
    serviceFeeBilled: 0,
    operationalIncomeVerified: 0,
    operationalExpenseVerified: 0,
    netCashMovement: 0,
    selectedPeriodId: null as string | null,
    selectedPeriodName: "Semua Periode",
  };

  let masterOptions: any = {
    academicPeriods: [],
  };

  let latestPayments: any[] = [];
  let overdueInvoices: any[] = [];
  let pendingLips: any[] = [];
  let outstandingUtPriority: any[] = [];

  let actionCenterSummary: any = {
    items: [],
    totalActionsCount: 0,
    urgentCount: 0,
    attentionCount: 0,
    newCount: 0,
  };

  try {
    const { getActionCenterSummary } = await import("@/features/dashboard/action-center");
    const [
      fetchedMetrics,
      fetchedMasterOptions,
      fetchedLatestPayments,
      fetchedOverdueInvoices,
      fetchedPendingLips,
      fetchedOutstandingUtPriority,
      fetchedActionCenter,
    ] = await Promise.all([
      getDashboardKpiMetrics(periodId),
      getRegistrationMasterOptions(),
      getLatestPaymentsWidget(5),
      getOverdueInvoicesWidget(5),
      getPendingLipsWidget(5),
      getOutstandingUtPriorityWidget(5),
      getActionCenterSummary(profile.role),
    ]);

    metrics = fetchedMetrics;
    masterOptions = fetchedMasterOptions;
    latestPayments = fetchedLatestPayments;
    overdueInvoices = fetchedOverdueInvoices;
    pendingLips = fetchedPendingLips;
    outstandingUtPriority = fetchedOutstandingUtPriority;
    actionCenterSummary = fetchedActionCenter;
  } catch (err: any) {
    console.warn("Error fetching dashboard data:", err?.message || err);
  }

  const { ActionCenterSection } = await import("@/components/dashboard/action-center-section");

  return (
    <div className="space-y-6">
      {/* Header Banner & Academic Period Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Selamat Datang, {profile.fullName}!
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sistem Informasi Manajemen {appSettings.salut_official_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Period Selector Component */}
          <DashboardPeriodFilter
            periods={masterOptions?.academicPeriods || []}
            selectedPeriodId={metrics.selectedPeriodId || ""}
          />
        </div>
      </div>

      {/* Action Center Section */}
      <ActionCenterSection summary={actionCenterSummary} />

      {/* KPI Cards Component */}
      <DashboardKpiCards metrics={metrics} />

      {/* Priority Widgets Component */}
      <DashboardWidgets
        latestPayments={latestPayments}
        overdueInvoices={overdueInvoices}
        pendingLips={pendingLips}
        outstandingUtPriority={outstandingUtPriority}
      />
    </div>
  );
}
