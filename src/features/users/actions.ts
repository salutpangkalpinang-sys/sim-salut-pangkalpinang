"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import {
  createUserSchema,
  changeRoleSchema,
  toggleUserStatusSchema,
  validateSelfActionGuard,
  validateLastActiveOwnerGuard,
  normalizeUserEmailInput,
} from "@/lib/validation/user";
import { getUsersList, getUsersSummary, getMockUsersStore } from "./queries";
import { RoleCode } from "@/lib/auth/types";
import { AuditEventPayload, UserFilter } from "@/types/user";

// Helper to log audit event securely without sensitive headers or credentials
async function logAuditEvent(payload: AuditEventPayload): Promise<void> {
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");
  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      await supabase.from("audit_logs").insert({
        actor_user_id: payload.actorUserId,
        action: payload.action,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        old_data: payload.oldData ? JSON.parse(JSON.stringify(payload.oldData)) : null,
        new_data: payload.newData ? JSON.parse(JSON.stringify(payload.newData)) : null,
        reason: payload.reason || null,
        metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : null,
      });
    } catch {
      // Audit log fallback
    }
  }
}

export async function createUserAction(prevState: unknown, formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return {
      error: "Hanya role Owner yang memiliki izin mengelola dan menambah pengguna.",
    };
  }

  const rawFullName = formData.get("fullName") as string;
  const rawEmail = formData.get("email") as string;
  const rawPassword = (formData.get("password") as string)?.trim() || "suksesterus";
  const rawRole = formData.get("role") as RoleCode;

  const validation = createUserSchema.safeParse({
    fullName: rawFullName,
    email: rawEmail,
    password: rawPassword,
    role: rawRole,
  });

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data masukan tidak valid",
    };
  }

  const fullName = validation.data.fullName.trim();
  const email = normalizeUserEmailInput(validation.data.email);
  const password = rawPassword;
  const role = validation.data.role;

  const existingUsers = await getUsersList();
  if (existingUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return {
      error: `Pengguna dengan email/username "${email}" sudah terdaftar dalam sistem.`,
    };
  }

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  let newUserId = crypto.randomUUID();

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();

      // Call secure RPC function
      const { data: rpcUserId, error: rpcErr } = await supabase.rpc("create_internal_user", {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_role_code: role,
      });

      if (rpcErr) {
        console.error("RPC create_internal_user error:", rpcErr);
        return {
          error: `Gagal membuat akun pengguna di database Supabase: ${rpcErr.message}. Harap jalankan script SQL migrasi 20260829000003 di SQL Editor Supabase.`,
        };
      }

      if (rpcUserId) {
        newUserId = rpcUserId as string;
      }
    } catch (err: any) {
      console.error("Error creating user:", err);
      return {
        error: `Terjadi kesalahan saat memproses pembuatan pengguna: ${err?.message || err}`,
      };
    }
  }

  // Update in-memory dev mock store if offline
  const mockStore = getMockUsersStore();
  const ROLE_LABELS: Record<RoleCode, string> = {
    owner: "Owner / Pimpinan",
    academic_admin: "Admin Akademik",
    finance_admin: "Admin Keuangan / Kasir",
    viewer: "Viewer / Auditor",
  };

  mockStore.push({
    id: newUserId,
    fullName,
    email,
    role,
    roleName: ROLE_LABELS[role],
    isActive: true,
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  });

  // Log audit event
  await logAuditEvent({
    actorUserId: profile.id,
    action: "user_invited",
    entityType: "user",
    entityId: newUserId,
    newData: { fullName, email, role },
    reason: "Pendaftaran/Undangan Pengguna Baru oleh Owner",
  });

  revalidatePath("/pengguna");

  return {
    success: true,
    message: `Pengguna "${fullName}" (${email}) berhasil ditambahkan dengan peran ${ROLE_LABELS[role]}.`,
  };
}

export async function changeUserRoleAction(prevState: unknown, formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return {
      error: "Hanya role Owner yang memiliki izin mengubah peran pengguna.",
    };
  }

  const userId = formData.get("userId") as string;
  const newRole = formData.get("newRole") as RoleCode;

  const validation = changeRoleSchema.safeParse({ userId, newRole });
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Input tidak valid" };
  }

  // 1. Self Action Guard
  const selfGuard = validateSelfActionGuard(profile.id, userId);
  if (!selfGuard.isValid) {
    return { error: selfGuard.error };
  }

  // 2. Last Active Owner Guard
  const allUsers = await getUsersList();
  const ownerGuard = validateLastActiveOwnerGuard(allUsers, userId, "DEMOTE");
  if (!ownerGuard.isValid) {
    return { error: ownerGuard.error };
  }

  const targetUser = allUsers.find((u) => u.id === userId);
  const oldRole = targetUser?.role || "viewer";

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");
  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      const { data: roleRow } = await supabase
        .from("roles")
        .select("id")
        .eq("code", newRole)
        .single();

      if (roleRow) {
        await supabase.from("user_roles").delete().eq("user_id", userId);
        await supabase.from("user_roles").insert({
          user_id: userId,
          role_id: roleRow.id,
        });
      }
    } catch {
      // Dev mode fallback
    }
  }

  // Update mock store for dev preview
  const mockStore = getMockUsersStore();
  const mockUser = mockStore.find((u) => u.id === userId);
  if (mockUser) {
    mockUser.role = newRole;
  }

  // Log audit event
  await logAuditEvent({
    actorUserId: profile.id,
    action: "user_role_changed",
    entityType: "role",
    entityId: userId,
    oldData: { role: oldRole },
    newData: { role: newRole },
    reason: `Perubahan Peran Pengguna dari ${oldRole} ke ${newRole}`,
  });

  revalidatePath("/pengguna");

  return {
    success: true,
    message: `Peran pengguna "${targetUser?.fullName || userId}" berhasil diperbarui menjadi ${newRole}.`,
  };
}

export async function toggleUserStatusAction(prevState: unknown, formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.role !== "owner") {
    return {
      error: "Hanya role Owner yang memiliki izin menonaktifkan/mengaktifkan pengguna.",
    };
  }

  const userId = formData.get("userId") as string;
  const targetIsActive = formData.get("isActive") === "true";

  const validation = toggleUserStatusSchema.safeParse({ userId, isActive: targetIsActive });
  if (!validation.success) {
    return { error: validation.error.errors[0]?.message || "Input tidak valid" };
  }

  // 1. Self Action Guard
  const selfGuard = validateSelfActionGuard(profile.id, userId);
  if (!selfGuard.isValid) {
    return { error: selfGuard.error };
  }

  // 2. Last Active Owner Guard (if deactivating)
  const allUsers = await getUsersList();
  if (!targetIsActive) {
    const ownerGuard = validateLastActiveOwnerGuard(allUsers, userId, "DEACTIVATE");
    if (!ownerGuard.isValid) {
      return { error: ownerGuard.error };
    }
  }

  const targetUser = allUsers.find((u) => u.id === userId);

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");
  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      await supabase.from("profiles").update({ is_active: targetIsActive }).eq("id", userId);
    } catch {
      // Dev mode fallback
    }
  }

  // Update mock store
  const mockStore = getMockUsersStore();
  const mockUser = mockStore.find((u) => u.id === userId);
  if (mockUser) {
    mockUser.isActive = targetIsActive;
  }

  const actionName = targetIsActive ? "user_reactivated" : "user_deactivated";

  // Log audit event
  await logAuditEvent({
    actorUserId: profile.id,
    action: actionName,
    entityType: "profile",
    entityId: userId,
    oldData: { isActive: !targetIsActive },
    newData: { isActive: targetIsActive },
    reason: targetIsActive ? "Pengaktifan Akses Pengguna" : "Penonaktifan Akses Pengguna",
  });

  revalidatePath("/pengguna");

  return {
    success: true,
    message: `Akses pengguna "${targetUser?.fullName || userId}" berhasil ${targetIsActive ? "diaktifkan" : "dinonaktifkan"}.`,
  };
}

export async function fetchUsersListAction(filter?: UserFilter) {
  return await getUsersList(filter);
}

export async function fetchUsersSummaryAction() {
  return await getUsersSummary();
}

