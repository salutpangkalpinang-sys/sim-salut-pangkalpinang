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
import { Calendar } from "lucide-react";
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
          {/* Period Selector Form */}
          <form className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              name="periodId"
              defaultValue={metrics.selectedPeriodId || ""}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="">Semua Periode Akademik</option>
              {(masterOptions?.academicPeriods || []).map((p: any) => (
                <option key={p.id} value={p.id} className="bg-white text-slate-800">
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </form>
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
