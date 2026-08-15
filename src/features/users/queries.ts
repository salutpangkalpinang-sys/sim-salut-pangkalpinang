import { createClient } from "@/lib/supabase/server";
import { UserItem, UserSummary, UserFilter } from "@/types/user";
import { RoleCode } from "@/lib/auth/types";

const ROLE_LABELS: Record<RoleCode, string> = {
  owner: "Owner / Pimpinan",
  academic_admin: "Admin Akademik",
  finance_admin: "Admin Keuangan / Kasir",
  viewer: "Viewer / Auditor",
};

// In-memory store for local dev mode fallback
const MOCK_USERS_STORE: UserItem[] = [
  {
    id: "dev-owner-001",
    fullName: "Owner SIM-SALUT",
    email: "admin@salut-pangkalpinang.ac.id",
    role: "owner",
    roleName: "Owner / Pimpinan",
    isActive: true,
    createdAt: new Date("2026-01-01T08:00:00Z").toISOString(),
    lastSignInAt: new Date("2026-08-15T09:00:00Z").toISOString(),
  },
  {
    id: "dev-academic-001",
    fullName: "Budi Santoso (Admin Akademik)",
    email: "akademik@salut-pangkalpinang.ac.id",
    role: "academic_admin",
    roleName: "Admin Akademik",
    isActive: true,
    createdAt: new Date("2026-01-10T09:30:00Z").toISOString(),
    lastSignInAt: new Date("2026-08-14T14:20:00Z").toISOString(),
  },
  {
    id: "dev-finance-001",
    fullName: "Siti Rahma (Kasir Keuangan)",
    email: "keuangan@salut-pangkalpinang.ac.id",
    role: "finance_admin",
    roleName: "Admin Keuangan / Kasir",
    isActive: true,
    createdAt: new Date("2026-01-15T11:00:00Z").toISOString(),
    lastSignInAt: new Date("2026-08-15T07:45:00Z").toISOString(),
  },
  {
    id: "dev-viewer-001",
    fullName: "Auditor Internal",
    email: "auditor@salut-pangkalpinang.ac.id",
    role: "viewer",
    roleName: "Viewer / Auditor",
    isActive: true,
    createdAt: new Date("2026-02-01T10:00:00Z").toISOString(),
    lastSignInAt: null,
  },
];

export async function getUsersList(filter?: UserFilter): Promise<UserItem[]> {
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  let users: UserItem[] = [];

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();

      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          is_active,
          created_at,
          user_roles(
            roles(code, name)
          )
        `)
        .order("created_at", { ascending: false });

      if (!profileErr && profiles) {
        users = profiles.map((p) => {
          const roleObj = (p.user_roles as unknown as Array<{ roles: { code: RoleCode; name: string } }>)?.[0]?.roles;
          const roleCode: RoleCode = roleObj?.code || "viewer";

          return {
            id: p.id,
            fullName: p.full_name,
            email: p.id === "dev-user-id" ? "admin@salut-pangkalpinang.ac.id" : `${roleCode}@salut-pangkalpinang.ac.id`,
            role: roleCode,
            roleName: ROLE_LABELS[roleCode] || "Viewer",
            isActive: p.is_active,
            createdAt: p.created_at,
            lastSignInAt: p.created_at,
          };
        });
      }
    } catch {
      // Fallback if client query fails
    }
  }

  if (users.length === 0) {
    users = [...MOCK_USERS_STORE];
  }

  // Apply filters
  if (filter) {
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      users = users.filter(
        (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    if (filter.role && filter.role !== "ALL") {
      users = users.filter((u) => u.role === filter.role);
    }

    if (filter.status && filter.status !== "ALL") {
      const activeFilter = filter.status === "ACTIVE";
      users = users.filter((u) => u.isActive === activeFilter);
    }
  }

  return users;
}

export async function getUsersSummary(): Promise<UserSummary> {
  const users = await getUsersList();

  return {
    totalUsers: users.length,
    ownerCount: users.filter((u) => u.role === "owner").length,
    academicAdminCount: users.filter((u) => u.role === "academic_admin").length,
    financeAdminCount: users.filter((u) => u.role === "finance_admin").length,
    viewerCount: users.filter((u) => u.role === "viewer").length,
    inactiveCount: users.filter((u) => !u.isActive).length,
  };
}

export function getMockUsersStore(): UserItem[] {
  return MOCK_USERS_STORE;
}
