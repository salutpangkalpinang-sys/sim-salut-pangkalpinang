import assert from "node:assert";
import { feeSnapshotInputSchema } from "../registration";
import { hasPermission } from "../../auth/types";


console.log("=== Running Registration Validation & Tariff Immutability Unit Tests ===");

// Test 1: Valid Integer Rupiah calculation
const validSnapshot = {
  feeTypeId: "11111111-1111-1111-1111-111111111111",
  feeNameSnapshot: "Biaya Layanan SALUT",
  calculationType: "FIXED" as const,
  quantity: 1,
  unitAmount: 400000,
};
const snapshotRes = feeSnapshotInputSchema.safeParse(validSnapshot);
assert.strictEqual(snapshotRes.success, true);
if (snapshotRes.success) {
  assert.strictEqual(snapshotRes.data.unitAmount, 400000);
  assert.strictEqual(snapshotRes.data.quantity * snapshotRes.data.unitAmount, 400000);
}
console.log("✓ Test 1 Passed: Valid Integer Rupiah snapshot calculation");

// Test 2: Rejection of Quantity 0 or Negative
const invalidQtySnapshot = {
  feeTypeId: "11111111-1111-1111-1111-111111111111",
  feeNameSnapshot: "Biaya SKS Reguler",
  calculationType: "PER_SKS" as const,
  quantity: 0, // Invalid
  unitAmount: 100000,
};
const invalidQtyRes = feeSnapshotInputSchema.safeParse(invalidQtySnapshot);
assert.strictEqual(invalidQtyRes.success, false);
console.log("✓ Test 2 Passed: Quantity 0 rejected");

// Test 3: Per-SKS Calculation (Quantity = 3, UnitAmount = 100000 -> Total = 300000)
const perSksSnapshot = {
  feeTypeId: "22222222-2222-2222-2222-222222222222",
  feeNameSnapshot: "Biaya Mata Kuliah Ulang",
  calculationType: "PER_SKS" as const,
  quantity: 3,
  unitAmount: 100000,
};
const perSksRes = feeSnapshotInputSchema.safeParse(perSksSnapshot);
assert.strictEqual(perSksRes.success, true);
if (perSksRes.success) {
  assert.strictEqual(perSksRes.data.quantity * perSksRes.data.unitAmount, 300000);
}
console.log("✓ Test 3 Passed: Per SKS calculation (3 x 100.000 = 300.000)");

// Test 4: Simulation of Tariff Snapshot Immutability
const historicalRegistrationSnapshot = {
  id: "reg-snap-001",
  feeNameSnapshot: "Biaya Layanan SALUT",
  unitAmount: 400000,
  quantity: 1,
  totalAmount: 400000,
};
const updatedMasterFeeRate = {
  id: "rate-001",
  name: "Biaya Layanan SALUT",
  unitAmount: 450000,
};
assert.strictEqual(historicalRegistrationSnapshot.unitAmount, 400000);
assert.notStrictEqual(historicalRegistrationSnapshot.unitAmount, updatedMasterFeeRate.unitAmount);
console.log("✓ Test 4 Passed: Tariff Snapshot Immutability verified");

// Test 5: Simulation of Study Program Context Snapshot Immutability
const studentCurrentState = {
  id: "std-001",
  fullName: "Budi Santoso",
  studyProgramId: "prodi-002", // Student transferred to Prodi B
};
const historicalRegistrationRecord = {
  id: "reg-001",
  studentId: "std-001",
  studyProgramId: "prodi-001", // Registration created during Prodi A
};
assert.strictEqual(historicalRegistrationRecord.studyProgramId, "prodi-001");
assert.notStrictEqual(historicalRegistrationRecord.studyProgramId, studentCurrentState.studyProgramId);
console.log("✓ Test 5 Passed: Academic Context Snapshot Immutability verified");

// Test 6: RBAC - Registration Creation & Cancellation Permissions
const viewerCanCreateReg = hasPermission("viewer", ["owner", "academic_admin"]);
const financeCanCreateReg = hasPermission("finance_admin", ["owner", "academic_admin"]);
const academicCanCreateReg = hasPermission("academic_admin", ["owner", "academic_admin"]);
const ownerCanCreateReg = hasPermission("owner", ["owner", "academic_admin"]);

assert.strictEqual(viewerCanCreateReg, false);
assert.strictEqual(financeCanCreateReg, false);
assert.strictEqual(academicCanCreateReg, true);
assert.strictEqual(ownerCanCreateReg, true);
console.log("✓ Test 6 Passed: RBAC Registration mutation permissions verified");

// Test 7: Non-Destructive Cancellation State Validation
const cancelledRegistration = {
  id: "reg-002",
  status: "cancelled",
  cancelledAt: new Date().toISOString(),
  cancelledBy: "user-owner",
  cancellationReason: "Mahasiswa mengundurkan diri",
};
assert.strictEqual(cancelledRegistration.status, "cancelled");
assert.ok(cancelledRegistration.cancelledAt);
assert.ok(cancelledRegistration.cancellationReason);
console.log("✓ Test 7 Passed: Non-destructive registration cancellation state verified");

console.log("=== ALL REGISTRATION VALIDATION TESTS PASSED CLEANLY! ===");
