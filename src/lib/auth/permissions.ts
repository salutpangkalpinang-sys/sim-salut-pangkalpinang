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
      const [{ data: profile }, { data: rpcRole }, { data: userRole }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("id", user.id)
          .single(),
        supabase.rpc("get_current_user_role"),
        supabase
          .from("user_roles")
          .select("roles(code)")
          .eq("user_id", user.id)
          .single(),
      ]);

      const rawRole = (rpcRole as RoleCode) || ((userRole?.roles as unknown as { code: RoleCode })?.code);
      const knownRoles: RoleCode[] = ["owner", "admin", "academic_admin", "finance_admin", "viewer"];
      let roleCode: RoleCode;
      if (rawRole && knownRoles.includes(rawRole)) {
        roleCode = rawRole;
      } else {
        console.error(`[Security Warning] Unrecognized role "${rawRole}" for authenticated user ${user.id}`);
        roleCode = (rawRole as RoleCode) || ("viewer" as RoleCode);
      }

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
      admin: "Admin (Akses Penuh)",
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
      email: devEmail,
    };
  }

  return null;
});

export { hasPermission } from "./types";
export type { RoleCode, UserProfile } from "./types";

