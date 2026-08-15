import { AuditSummary } from "@/types/audit";
import { History, Calendar, Users, Wallet } from "lucide-react";

interface AuditSummaryCardsProps {
  summary: AuditSummary;
}

export function AuditSummaryCards({ summary }: AuditSummaryCardsProps) {
  const cards = [
    {
      title: "Aktivitas Hari Ini",
      value: summary.todayCount,
      subtext: "Log hari ini (WIB)",
      icon: History,
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      title: "Aktivitas 7 Hari",
      value: summary.last7DaysCount,
      subtext: "Total 7 hari terakhir",
      icon: Calendar,
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      borderColor: "border-purple-200",
    },
    {
      title: "Perubahan User",
      value: summary.userChangesCount,
      subtext: "Role, status & invite",
      icon: Users,
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      borderColor: "border-emerald-200",
    },
    {
      title: "Aktivitas Finansial",
      value: summary.financialActivitiesCount,
      subtext: "Bayar, UT, Kas & LIP",
      icon: Wallet,
      bgColor: "bg-amber-50",
      textColor: "text-amber-600",
      borderColor: "border-amber-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 truncate">
                {card.title}
              </span>
              <div
                className={`w-8 h-8 rounded-lg ${card.bgColor} ${card.textColor} flex items-center justify-center border ${card.borderColor} shrink-0`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {card.value}
              </span>
              <span className="text-xs text-slate-400">event</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
