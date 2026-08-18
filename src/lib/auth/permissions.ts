import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { UserProfile, RoleCode } from "./types";
import { cache } from "react";

export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const cookieStore = await cookies();
  const devRole = cookieStore.get("salut_dev_role")?.value as RoleCode | undefined;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: profile }, { data: userRole }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_roles")
          .select("roles(code)")
          .eq("user_id", user.id)
          .single(),
      ]);

      const roleCode = (userRole?.roles as unknown as { code: RoleCode })?.code || "viewer";

      return {
        id: user.id,
        fullName: profile?.full_name || user.email || "Pengguna",
        isActive: profile?.is_active ?? true,
        role: roleCode,
        email: user.email,
      };
    }
  } catch {
    // Supabase client fallback
  }

  // Fallback for local dev mode preview when Supabase live project is not yet attached
  if (devRole || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder")) {
    const activeRole = devRole || "owner";
    const roleLabels: Record<RoleCode, string> = {
      owner: "Pimpinan SALUT",
      academic_admin: "Admin Akademik",
      finance_admin: "Admin Keuangan / Kasir",
      viewer: "Viewer / Auditor",
    };

    const devEmail = process.env.DEV_ADMIN_EMAIL || "admin@salut-megacendekia.ac.id";

    return {
      id: "dev-user-id",
      fullName: roleLabels[activeRole] || "Pengguna SALUT",
      isActive: true,
      role: activeRole,
      email: activeRole === "owner" ? devEmail : `${activeRole}@salut-pangkalpinang.ac.id`,
    };
  }

  return null;
});

export { hasPermission } from "./types";
export type { RoleCode, UserProfile } from "./types";

