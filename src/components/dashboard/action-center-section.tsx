import Link from "next/link";
import { ActionCenterSummary } from "@/features/dashboard/action-center";
import { getPriorityBadgeMeta } from "@/lib/constants/aging";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Receipt,
  FileText,
  Building2,
  FileCheck,
} from "lucide-react";

interface ActionCenterSectionProps {
  summary: ActionCenterSummary;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  pending_payments: CreditCard,
  pending_lips: Receipt,
  student_receivables: FileText,
  outstanding_ut: Building2,
  draft_registrations: FileCheck,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending_payments: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  pending_lips: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  student_receivables: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  outstanding_ut: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  draft_registrations: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
};

export function ActionCenterSection({ summary }: ActionCenterSectionProps) {
  const { items, totalActionsCount, urgentCount } = summary;

  if (totalActionsCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Tindakan yang Perlu Diselesaikan (Action Center)
            </h2>
            <p className="text-[11px] text-slate-500">
              Pusat kendali antrean tugas operasional akademik dan keuangan
            </p>
          </div>
        </div>

        {/* Positive Empty State */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-emerald-900">
            Semua pekerjaan prioritas sudah ditangani.
          </h3>
          <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
            Tidak ada antrean pembayaran, LIP, piutang, setoran UT, atau registrasi draft yang membutuhkan tindakan saat ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Tindakan yang Perlu Diselesaikan (Action Center)
              </h2>
              {urgentCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[10px] rounded-full border border-red-200 animate-pulse">
                  {urgentCount} Urgent
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Antrean tugas operasional yang membutuhkan tindakan staf pengelola
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full shrink-0">
          {totalActionsCount} Antrean Aktif
        </span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {items.map((item) => {
          const Icon = CATEGORY_ICONS[item.category] || Clock;
          const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.pending_payments;
          const priorityMeta = getPriorityBadgeMeta(item.priority);

          return (
            <div
              key={item.category}
              className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:bg-white hover:shadow-md hover:border-slate-300 transition group"
            >
              {/* Card Header & Badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg ${colors.bg} ${colors.text} flex items-center justify-center border ${colors.border} shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-900 truncate text-xs">
                      {item.title}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border shrink-0 ${priorityMeta.badgeStyle}`}
                  >
                    {priorityMeta.label}
                  </span>
                </div>

                {/* Primary Metric */}
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                    {item.count}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {item.category === "pending_lips" || item.category === "outstanding_ut"
                      ? "dokumen LIP"
                      : item.category === "draft_registrations"
                      ? "registrasi draft"
                      : "transaksi"}
                  </span>
                </div>

                {/* Secondary Info: Total Amount or Aging */}
                <div className="space-y-1 text-[11px] text-slate-600">
                  {item.totalAmount !== undefined && item.totalAmount !== null && (
                    <div className="font-mono font-semibold text-slate-800">
                      Total: Rp {item.totalAmount.toLocaleString("id-ID")}
                    </div>
                  )}

                  {item.oldestAgeLabel && (
                    <div className="text-slate-500 flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Terlama: {item.oldestAgeLabel}</span>
                    </div>
                  )}

                  {item.overdueCount !== undefined && item.overdueCount !== null && item.overdueCount > 0 && (
                    <div className="text-red-600 font-semibold text-[10px]">
                      {item.overdueCount} invoice lewat jatuh tempo
                    </div>
                  )}

                  {item.academicPeriodName && (
                    <div className="text-slate-500 text-[10px]">
                      Periode: {item.academicPeriodName}
                    </div>
                  )}
                </div>
              </div>

              {/* Working CTA Button with Deep Link */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-end">
                <Link
                  href={item.ctaHref}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg transition shadow-xs group-hover:shadow-sm"
                >
                  <span>{item.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
