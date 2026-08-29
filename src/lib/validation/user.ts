import { z } from "zod";
import { UserItem } from "@/types/user";

export const createUserSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  email: z.string().min(2, "Username atau Email wajib diisi"),
  password: z.string().min(6, "Password minimal 6 karakter").optional().or(z.literal("")),
  role: z.enum(["owner", "academic_admin", "finance_admin", "viewer"] as const, {
    errorMap: () => ({ message: "Role tidak valid" }),
  }),
});

export const changeRoleSchema = z.object({
  userId: z.string().uuid("ID Pengguna tidak valid"),
  newRole: z.enum(["owner", "academic_admin", "finance_admin", "viewer"] as const, {
    errorMap: () => ({ message: "Role baru tidak valid" }),
  }),
});

export const toggleUserStatusSchema = z.object({
  userId: z.string().uuid("ID Pengguna tidak valid"),
  isActive: z.boolean(),
});

export function validateSelfActionGuard(
  actorUserId: string,
  targetUserId: string
): { isValid: boolean; error?: string } {
  if (actorUserId === targetUserId) {
    return {
      isValid: false,
      error: "Anda tidak dapat menonaktifkan atau mengubah peran akun Anda sendiri.",
    };
  }
  return { isValid: true };
}

export function validateLastActiveOwnerGuard(
  allUsers: UserItem[],
  targetUserId: string,
  actionType: "DEMOTE" | "DEACTIVATE"
): { isValid: boolean; error?: string } {
  const targetUser = allUsers.find((u) => u.id === targetUserId);
  if (!targetUser) {
    return { isValid: false, error: "Pengguna tidak ditemukan." };
  }

  // Only check guard if target user is currently an active Owner
  if (targetUser.role === "owner" && targetUser.isActive) {
    const activeOwners = allUsers.filter((u) => u.isActive && u.role === "owner");
    if (activeOwners.length <= 1) {
      const actionLabel = actionType === "DEACTIVATE" ? "menonaktifkan" : "mengubah peran";
      return {
        isValid: false,
        error: `Tidak dapat ${actionLabel} Owner aktif terakhir. Minimal harus ada 1 Owner aktif dalam sistem.`,
      };
    }
  }

  return { isValid: true };
}

export function normalizeUserEmailInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.includes("@")) {
    return `${trimmed}@salut-pangkalpinang.ac.id`;
  }
  return trimmed;
}
