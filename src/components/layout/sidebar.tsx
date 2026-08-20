"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAVIGATION_ITEMS,
  hasPermission,
  RoleCode,
} from "@/lib/auth/types";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  FileCheck,
  Receipt,
  CreditCard,
  Building2,
  Wallet,
  BarChart3,
  Database,
  ShieldAlert,
  History,
  Settings,
  GraduationCap,
} from "lucide-react";

// Icon mapping helper
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  UserPlus,
  Users,
  FileCheck,
  Receipt,
  CreditCard,
  Building2,
  Wallet,
  BarChart3,
  Database,
  ShieldAlert,
  History,
  Settings,
};

interface SidebarProps {
  userRole: RoleCode;
  salutName?: string;
  salutCity?: string;
}

export function Sidebar({ userRole, salutName, salutCity }: SidebarProps) {
  const pathname = usePathname();

  const brandTitle = salutName || "SIM-SALUT";
  const brandSub = salutCity || "Pangkalpinang";

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shrink-0 shadow-sm print:hidden">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900 text-xs tracking-tight truncate" title={brandTitle}>
            {brandTitle}
          </h2>
          <p className="text-[11px] text-slate-500 truncate">{brandSub}</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAVIGATION_ITEMS.map((item) => {
          const isAllowed = hasPermission(userRole, item.allowedRoles);
          const isActive = pathname === item.href;
          const IconComponent = ICON_MAP[item.iconName] || LayoutDashboard;

          if (!isAllowed) {
            return null; // Hide navigation menu item if role lacks permission
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-600 hover:text-blue-700 hover:bg-slate-100"
              }`}
            >
              <IconComponent className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 text-[11px] text-slate-400 text-center">
        SIM-SALUT Mega Cendekia v1.0
      </div>
    </aside>
  );
}
