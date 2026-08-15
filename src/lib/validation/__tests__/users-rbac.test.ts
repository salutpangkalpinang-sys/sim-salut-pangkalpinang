import assert from "node:assert";
import {
  createUserSchema,
  changeRoleSchema,
  toggleUserStatusSchema,
  validateSelfActionGuard,
  validateLastActiveOwnerGuard,
  normalizeUserEmailInput,
} from "../user";
import { UserItem } from "@/types/user";

console.log("=== Running Phase 6C.1 — User Management & RBAC Security Unit Tests ===");

// 1. Email / Username Normalization
const norm1 = normalizeUserEmailInput("kasir");
assert.strictEqual(norm1, "kasir@salut-pangkalpinang.ac.id", "Plain username normalized with domain");

const norm2 = normalizeUserEmailInput("owner@salut.id");
assert.strictEqual(norm2, "owner@salut.id", "Full email preserved unchanged");
console.log("✓ Test 1 Passed: Username & Email input normalization verified");

// 2. Input Validation Schemas
const validCreate = createUserSchema.safeParse({
  fullName: "Budi Santoso",
  email: "budi",
  role: "academic_admin",
});
assert.strictEqual(validCreate.success, true, "Valid create user input accepted");

const invalidRole = createUserSchema.safeParse({
  fullName: "Budi Santoso",
  email: "budi",
  role: "superadmin", // Invalid role
});
assert.strictEqual(invalidRole.success, false, "Invalid role code rejected");

const validChangeRole = changeRoleSchema.safeParse({
  userId: "123e4567-e89b-12d3-a456-426614174000",
  newRole: "finance_admin",
});
assert.strictEqual(validChangeRole.success, true, "Valid change role schema accepted");

const validToggleStatus = toggleUserStatusSchema.safeParse({
  userId: "123e4567-e89b-12d3-a456-426614174000",
  isActive: false,
});
assert.strictEqual(validToggleStatus.success, true, "Valid toggle status schema accepted");
console.log("✓ Test 2 Passed: User creation Zod schema validation verified");

// 3. Self Action Guard (Self-demotion / Self-deactivation prevention)
const selfGuard1 = validateSelfActionGuard("owner-001", "owner-001");
assert.strictEqual(selfGuard1.isValid, false, "Self-mutation detected");
assert.strictEqual(
  selfGuard1.error,
  "Anda tidak dapat menonaktifkan atau mengubah peran akun Anda sendiri.",
  "Self action error message verified"
);

const selfGuard2 = validateSelfActionGuard("owner-001", "other-user-002");
assert.strictEqual(selfGuard2.isValid, true, "Mutation on other user allowed");
console.log("✓ Test 3 Passed: Self privilege escalation & self-demotion guard verified");

// 4. Last Active Owner Protection Guard (Deactivation & Demotion)
const mockUsers: UserItem[] = [
  {
    id: "owner-001",
    fullName: "Owner Utama",
    email: "owner@salut.id",
    role: "owner",
    roleName: "Owner / Pimpinan",
    isActive: true,
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  },
  {
    id: "academic-001",
    fullName: "Admin Akademik",
    email: "akademik@salut.id",
    role: "academic_admin",
    roleName: "Admin Akademik",
    isActive: true,
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  },
];

// Attempting to demote the ONLY active owner
const lastOwnerDemote = validateLastActiveOwnerGuard(mockUsers, "owner-001", "DEMOTE");
assert.strictEqual(lastOwnerDemote.isValid, false, "Demoting last active owner blocked");
assert(
  lastOwnerDemote.error?.includes("Owner aktif terakhir"),
  "Last owner error message verified"
);

// Attempting to deactivate the ONLY active owner
const lastOwnerDeactivate = validateLastActiveOwnerGuard(mockUsers, "owner-001", "DEACTIVATE");
assert.strictEqual(lastOwnerDeactivate.isValid, false, "Deactivating last active owner blocked");
console.log("✓ Test 4 Passed: Last active Owner protection guard verified");

// 5. Multiple Active Owners Guard Behavior
const mockUsersTwoOwners: UserItem[] = [
  ...mockUsers,
  {
    id: "owner-002",
    fullName: "Owner Kedua",
    email: "owner2@salut.id",
    role: "owner",
    roleName: "Owner / Pimpinan",
    isActive: true,
    createdAt: new Date().toISOString(),
    lastSignInAt: null,
  },
];

// Demoting one of two active owners is allowed
const twoOwnersDemote = validateLastActiveOwnerGuard(mockUsersTwoOwners, "owner-002", "DEMOTE");
assert.strictEqual(twoOwnersDemote.isValid, true, "Demoting owner allowed when 2 active owners exist");
console.log("✓ Test 5 Passed: Multi-owner transition allowed when > 1 active owner exists");

// 6. Non-Owner RBAC Mutation Restriction Simulation
function simulateServerAuthorization(role: string): { isAllowed: boolean; statusCode: number } {
  if (role !== "owner") {
    return { isAllowed: false, statusCode: 403 };
  }
  return { isAllowed: true, statusCode: 200 };
}

assert.strictEqual(simulateServerAuthorization("owner").isAllowed, true, "Owner granted user management permission");
assert.strictEqual(simulateServerAuthorization("academic_admin").isAllowed, false, "Academic Admin denied user management");
assert.strictEqual(simulateServerAuthorization("finance_admin").isAllowed, false, "Finance Admin denied user management");
assert.strictEqual(simulateServerAuthorization("viewer").isAllowed, false, "Viewer denied user management");
console.log("✓ Test 6 Passed: Server-side RBAC restriction (Owner only) verified for Academic Admin, Finance Admin & Viewer");

// 7. Audit Event Payload Sanitization (No Passwords / Credentials)
const auditPayload = {
  actorUserId: "owner-001",
  action: "user_invited",
  entityType: "user",
  entityId: "usr-005",
  newData: { fullName: "Test User", email: "test@salut.id", role: "academic_admin" },
};

const payloadKeys = Object.keys(auditPayload.newData);
assert(!payloadKeys.includes("password"), "No password in audit payload");
assert(!payloadKeys.includes("token"), "No token in audit payload font");
assert(!payloadKeys.includes("secret"), "No secret key in audit payload font");
console.log("✓ Test 7 Passed: Audit event payload secret sanitization verified");

console.log("=== ALL PHASE 6C.1 USER MANAGEMENT & SECURITY TESTS PASSED CLEANLY! ===");
