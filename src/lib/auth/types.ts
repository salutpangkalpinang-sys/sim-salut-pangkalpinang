export type RoleCode = "owner" | "admin" | "academic_admin" | "finance_admin" | "viewer";

export interface UserProfile {
  id: string;
  fullName: string;
  isActive: boolean;
  role: RoleCode;
  email?: string;
}

export interface NavigationItem {
  name: string;
  href: string;
  iconName: string;
  allowedRoles: RoleCode[];
  badge?: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    allowedRoles: ["owner", "admin", "academic_admin", "finance_admin", "viewer"],
  },
  {
    name: "Calon Mahasiswa",
    href: "/calon-mahasiswa",
    iconName: "UserPlus",
    allowedRoles: ["owner", "admin", "academic_admin", "viewer"],
  },
  {
    name: "Mahasiswa",
    href: "/mahasiswa",
    iconName: "Users",
    allowedRoles: ["owner", "admin", "academic_admin", "viewer"],
  },
  {
    name: "Registrasi",
    href: "/registrasi",
    iconName: "FileCheck",
    allowedRoles: ["owner", "admin", "academic_admin", "viewer"],
  },
  {
    name: "Pembayaran Mahasiswa",
    href: "/pembayaran",
    iconName: "CreditCard",
    allowedRoles: ["owner", "admin", "finance_admin", "viewer"],
  },
  {
    name: "LIP & Tagihan",
    href: "/lip-tagihan",
    iconName: "Receipt",
    allowedRoles: ["owner", "admin", "academic_admin", "finance_admin", "viewer"],
  },
  {
    name: "Setoran UT",
    href: "/setoran-ut",
    iconName: "Building2",
    allowedRoles: ["owner", "admin", "finance_admin", "viewer"],
  },
  {
    name: "Kas & Operasional",
    href: "/kas-operasional",
    iconName: "Wallet",
    allowedRoles: ["owner", "admin", "finance_admin", "viewer"],
  },
  {
    name: "Laporan",
    href: "/laporan",
    iconName: "BarChart3",
    allowedRoles: ["owner", "admin", "academic_admin", "finance_admin", "viewer"],
  },
  {
    name: "Master Data",
    href: "/master-data",
    iconName: "Database",
    allowedRoles: ["owner", "admin", "academic_admin"],
  },
  {
    name: "Pengguna & Hak Akses",
    href: "/pengguna",
    iconName: "ShieldAlert",
    allowedRoles: ["owner", "admin"],
  },
  {
    name: "Audit Log",
    href: "/audit-log",
    iconName: "History",
    allowedRoles: ["owner", "admin", "viewer"],
  },
  {
    name: "Pengaturan",
    href: "/pengaturan",
    iconName: "Settings",
    allowedRoles: ["owner", "admin", "academic_admin", "finance_admin"],
  },
];

export function hasPermission(
  userRole: RoleCode,
  allowedRoles: RoleCode[]
): boolean {
  if (userRole === "owner" || userRole === "admin") return true;
  return allowedRoles.includes(userRole);
}
