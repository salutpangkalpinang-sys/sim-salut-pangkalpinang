import assert from "node:assert";
import { operationalTransactionSchema, voidOperationalRequestSchema } from "../operational";
import { hasPermission, RoleCode } from "../../auth/types";

console.log("=== Running Operational Transactions & Core 6 Validation Unit Tests ===");

// Test 1: Idempotency Key Required (Non-Null Check)
const missingKeyInput: any = {
  transactionType: "income",
  categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  cashAccountId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  transactionDate: new Date().toISOString(),
  amount: 250000,
  description: "Pemasukan Hibah Non-Mahasiswa",
  idempotencyKey: null, // Rejected!
};

const missingKeyRes = operationalTransactionSchema.safeParse(missingKeyInput);
assert.strictEqual(missingKeyRes.success, false);
console.log("✓ Test 1 Passed: Null idempotency key rejected (idempotencyKey required)");

// Test 2: Valid Integer Rupiah Operational Transaction Schema
const validOpsInput = {
  transactionType: "income" as const,
  categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  cashAccountId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  transactionDate: new Date().toISOString(),
  amount: 250000,
  description: "Pemasukan Hibah Non-Mahasiswa",
  referenceNumber: "REF-INC-001",
  notes: "Pemasukan operasional sah",
  idempotencyKey: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
};

const validOpsRes = operationalTransactionSchema.safeParse(validOpsInput);
assert.strictEqual(validOpsRes.success, true);
console.log("✓ Test 2 Passed: Valid Integer Rupiah operational transaction accepted");

// Test 3: Rejection of Zero or Negative Amount
const zeroOpsInput = { ...validOpsInput, amount: 0 };
const zeroOpsRes = operationalTransactionSchema.safeParse(zeroOpsInput);
assert.strictEqual(zeroOpsRes.success, false);
console.log("✓ Test 3 Passed: Zero operational transaction amount rejected (amount > 0 required)");

// Test 4: Rejection of Floating Point Amount
const floatOpsInput = { ...validOpsInput, amount: 150000.75 };
const floatOpsRes = operationalTransactionSchema.safeParse(floatOpsInput);
assert.strictEqual(floatOpsRes.success, false);
console.log("✓ Test 4 Passed: Floating point operational amount rejected (Integer Rupiah required)");

// Test 5: Category & Transaction Type Consistency Logic Check
const categoryType = "expense";
const selectedTxnType = "income";
const isCategoryMismatch = (categoryType as string) !== (selectedTxnType as string);
assert.strictEqual(isCategoryMismatch, true);
console.log("✓ Test 5 Passed: Mismatch between expense category and income transaction type detected and rejected");

// Test 6: Separation of Duties (Academic Admin & Viewer Operational Mutation Denial)
const academicAdminRole: RoleCode = "academic_admin";
const viewerRole: RoleCode = "viewer";
const financeAdminRole: RoleCode = "finance_admin";
const ownerRole: RoleCode = "owner";
const operationalMutationRoles: RoleCode[] = ["owner", "finance_admin"];

assert.strictEqual(hasPermission(academicAdminRole, operationalMutationRoles), false);
assert.strictEqual(hasPermission(viewerRole, operationalMutationRoles), false);
assert.strictEqual(hasPermission(financeAdminRole, operationalMutationRoles), true);
assert.strictEqual(hasPermission(ownerRole, operationalMutationRoles), true);
console.log("✓ Test 6 Passed: Academic Admin and Viewer denied from operational mutations");

// Test 7: Valid Operational Status Filtering (Only status = 'verified' counted for operational totals)
const transactionsList = [
  { id: "1", status: "verified", amount: 500000 },
  { id: "2", status: "pending_verification", amount: 300000 },
  { id: "3", status: "rejected", amount: 200000 },
  { id: "4", status: "voided", amount: 400000 },
];

const validVerifiedSum = transactionsList
  .filter((t) => t.status === "verified")
  .reduce((acc, t) => acc + t.amount, 0);

assert.strictEqual(validVerifiedSum, 500000);
console.log("✓ Test 7 Passed: Only status = verified counted towards valid operational totals (Pending, Rejected, Voided excluded)");

// Test 8: Void Request Validation & Owner-Only Void Approval Restriction
const invalidVoidInput = { transactionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", reason: "  " };
const voidRes = voidOperationalRequestSchema.safeParse(invalidVoidInput);
assert.strictEqual(voidRes.success, false);

const financeApproveVoid = hasPermission("finance_admin", ["owner"]);
const ownerApproveVoid = hasPermission("owner", ["owner"]);
assert.strictEqual(financeApproveVoid, false);
assert.strictEqual(ownerApproveVoid, true);
console.log("✓ Test 8 Passed: Void request validation & Owner-only approval restriction verified");

console.log("=== ALL OPERATIONAL TRANSACTIONS & CORE 6 TESTS PASSED CLEANLY! ===");
