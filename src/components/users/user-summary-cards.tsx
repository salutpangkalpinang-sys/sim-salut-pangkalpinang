import { UserSummary } from "@/types/user";
import { Users, ShieldAlert, GraduationCap, Wallet, Eye, UserX } from "lucide-react";

interface UserSummaryCardsProps {
  summary: UserSummary;
}

export function UserSummaryCards({ summary }: UserSummaryCardsProps) {
  const cards = [
    {
      title: "Total Pengguna",
      value: summary.totalUsers,
      subtext: "Terdaftar dalam sistem",
      icon: Users,
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      title: "Owner / Pimpinan",
      value: summary.ownerCount,
      subtext: "Penerima laporan & approval",
      icon: ShieldAlert,
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      borderColor: "border-purple-200",
    },
    {
      title: "Admin Akademik",
      value: summary.academicAdminCount,
      subtext: "Pengelola mahasiswa & registrasi",
      icon: GraduationCap,
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      borderColor: "border-emerald-200",
    },
    {
      title: "Admin Keuangan",
      value: summary.financeAdminCount,
      subtext: "Pencatat bayar, UT & kas",
      icon: Wallet,
      bgColor: "bg-amber-50",
      textColor: "text-amber-600",
      borderColor: "border-amber-200",
    },
    {
      title: "Viewer / Auditor",
      value: summary.viewerCount,
      subtext: "Akses lihat data tanpa edit",
      icon: Eye,
      bgColor: "bg-slate-100",
      textColor: "text-slate-700",
      borderColor: "border-slate-300",
    },
    {
      title: "Akses Nonaktif",
      value: summary.inactiveCount,
      subtext: "Pengguna dinonaktifkan",
      icon: UserX,
      bgColor: "bg-red-50",
      textColor: "text-red-600",
      borderColor: "border-red-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 truncate">
                {card.title}
              </span>
              <div
                className={`w-7 h-7 rounded-lg ${card.bgColor} ${card.textColor} flex items-center justify-center border ${card.borderColor} shrink-0`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                {card.value}
              </span>
              <span className="text-[10px] text-slate-400">user</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
