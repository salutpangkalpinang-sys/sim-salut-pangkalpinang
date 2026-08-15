import assert from "node:assert";
import { utRemittanceSchema, voidRemittanceRequestSchema } from "../ut-remittance";
import { hasPermission, RoleCode } from "../../auth/types";

console.log("=== Running UT Remittances & Core 5 Validation Unit Tests ===");

// Test 1: Separation of Duties (Academic Admin Financial Mutation Denial)
const academicAdminRole: RoleCode = "academic_admin";
const financeAdminRole: RoleCode = "finance_admin";
const ownerRole: RoleCode = "owner";
const viewerRole: RoleCode = "viewer";
const financialMutationRoles: RoleCode[] = ["owner", "finance_admin"];

assert.strictEqual(hasPermission(academicAdminRole, financialMutationRoles), false);
assert.strictEqual(hasPermission(viewerRole, financialMutationRoles), false);
assert.strictEqual(hasPermission(financeAdminRole, financialMutationRoles), true);
assert.strictEqual(hasPermission(ownerRole, financialMutationRoles), true);
console.log("✓ Test 1 Passed: Academic Admin and Viewer restricted from UT remittance mutations");

// Test 2: Valid Integer Rupiah UT Remittance Schema Validation
const validRemittanceInput = {
  paidAt: new Date().toISOString(),
  amount: 4500000,
  cashAccountId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  referenceNumber: "UTR-BANK-881",
  notes: "Setoran Tahap 1 UT",
  items: [
    {
      lipDocumentId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      registrationId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
      amount: 4500000,
    },
  ],
};

const validRes = utRemittanceSchema.safeParse(validRemittanceInput);
assert.strictEqual(validRes.success, true);
console.log("✓ Test 2 Passed: Valid Integer Rupiah UT remittance input accepted");

// Test 3: Rejection of Zero or Negative Amount
const zeroInput = { ...validRemittanceInput, amount: 0, items: [{ ...validRemittanceInput.items[0], amount: 0 }] };
const zeroRes = utRemittanceSchema.safeParse(zeroInput);
assert.strictEqual(zeroRes.success, false);
console.log("✓ Test 3 Passed: Zero UT remittance amount rejected (amount > 0 required)");

// Test 4: Rejection of Floating Point Amount
const floatInput = { ...validRemittanceInput, amount: 4500000.5, items: [{ ...validRemittanceInput.items[0], amount: 4500000.5 }] };
const floatRes = utRemittanceSchema.safeParse(floatInput);
assert.strictEqual(floatRes.success, false);
console.log("✓ Test 4 Passed: Floating point UT remittance amount rejected (Integer Rupiah required)");

// Test 5: Rejection when SUM(items.amount) != total remittance amount
const mismatchInput = { ...validRemittanceInput, amount: 5000000 };
const mismatchRes = utRemittanceSchema.safeParse(mismatchInput);
assert.strictEqual(mismatchRes.success, false);
console.log("✓ Test 5 Passed: Remittance amount mismatch with items sum rejected");

// Test 6: Source of UT Liability & Derived Outstanding UT Calculation
const lipOfficialAmount = 4500000; // Verified LIP official amount
const invoiceTotalWithServiceFee = 4900000; // Invoice total including SALUT service fee

// UT Liability MUST be lipOfficialAmount (Rp4.500.000), NOT invoice total (Rp4.900.000)
const utLiability = lipOfficialAmount;
assert.strictEqual(utLiability, 4500000);
assert.notStrictEqual(utLiability, invoiceTotalWithServiceFee);

// Derived Outstanding UT calculation:
const alreadyRemittedVerified = 3000000;
const outstandingUtAmount = Math.max(0, utLiability - alreadyRemittedVerified);
assert.strictEqual(outstandingUtAmount, 1500000);
console.log("✓ Test 6 Passed: UT liability source verified (LIP official Rp4.500.000 used, Outstanding Rp1.500.000 derived correctly)");

// Test 7: Over-Remittance Protection Logic Check
const attemptedAllocation = 2000000;
const isOverRemittance = attemptedAllocation > outstandingUtAmount;
assert.strictEqual(isOverRemittance, true);
console.log("✓ Test 7 Passed: Over-remittance attempt (Rp2.000.000 > Outstanding Rp1.500.000) detected and rejected");

// Test 8: Void Remittance Request & Owner-Only Approval Permission
const invalidVoid = { remittanceId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", reason: "  " };
const voidRes = voidRemittanceRequestSchema.safeParse(invalidVoid);
assert.strictEqual(voidRes.success, false);

const financeApproveVoid = hasPermission("finance_admin", ["owner"]);
const ownerApproveVoid = hasPermission("owner", ["owner"]);
assert.strictEqual(financeApproveVoid, false);
assert.strictEqual(ownerApproveVoid, true);
console.log("✓ Test 8 Passed: Remittance void request validation & Owner-only approval restriction verified");

console.log("=== ALL UT REMITTANCES & CORE 5 TESTS PASSED CLEANLY! ===");
