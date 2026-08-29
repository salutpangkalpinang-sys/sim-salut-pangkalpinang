import assert from "node:assert";
import { calculateInvoicePaymentAllocation } from "../../utils/payment-allocation";

console.log("=== Running Payment Priority Allocation Unit Tests (SALUT Fee -> UT Liability) ===");

// Fixture invoice items: SALUT Fee Rp 400.000, UT Liability Rp 1.500.000 (Total invoice Rp 1.900.000)
const sampleInvoiceItems = [
  { item_type: "service_fee", amount: 400000 },
  { item_type: "ut_liability", amount: 1500000 },
];

// Test 1: Partial payment under Rp 400.000 (e.g. Rp 250.000)
// Must go 100% to SALUT fee (250k / 400k), and 0 to UT liability.
const test1Res = calculateInvoicePaymentAllocation(sampleInvoiceItems, 250000);
assert.strictEqual(test1Res.serviceFeePaid, 250000);
assert.strictEqual(test1Res.serviceFeeRemaining, 150000);
assert.strictEqual(test1Res.serviceFeeStatus, "partial");
assert.strictEqual(test1Res.utLiabilityPaid, 0);
assert.strictEqual(test1Res.utLiabilityRemaining, 1500000);
assert.strictEqual(test1Res.utLiabilityStatus, "unpaid");
assert.strictEqual(test1Res.remainingInvoiceBalance, 1650000);
console.log("✓ Test 1 Passed: Payment < Rp 400.000 (Rp 250.000) fills SALUT fee first, UT liability = Rp 0");

// Test 2: Payment exactly Rp 400.000
// Must fill 100% of SALUT fee (400k / 400k), and 0 to UT liability.
const test2Res = calculateInvoicePaymentAllocation(sampleInvoiceItems, 400000);
assert.strictEqual(test2Res.serviceFeePaid, 400000);
assert.strictEqual(test2Res.serviceFeeRemaining, 0);
assert.strictEqual(test2Res.serviceFeeStatus, "paid");
assert.strictEqual(test2Res.utLiabilityPaid, 0);
assert.strictEqual(test2Res.utLiabilityRemaining, 1500000);
assert.strictEqual(test2Res.utLiabilityStatus, "unpaid");
assert.strictEqual(test2Res.remainingInvoiceBalance, 1500000);
console.log("✓ Test 2 Passed: Payment = Rp 400.000 fully pays SALUT fee, UT liability = Rp 0");

// Test 3: Partial payment > Rp 400.000 (e.g. Rp 1.000.000)
// First 400.000 pays SALUT fee. Remaining 600.000 goes to UT liability.
const test3Res = calculateInvoicePaymentAllocation(sampleInvoiceItems, 1000000);
assert.strictEqual(test3Res.serviceFeePaid, 400000);
assert.strictEqual(test3Res.serviceFeeRemaining, 0);
assert.strictEqual(test3Res.serviceFeeStatus, "paid");
assert.strictEqual(test3Res.utLiabilityPaid, 600000);
assert.strictEqual(test3Res.utLiabilityRemaining, 900000);
assert.strictEqual(test3Res.utLiabilityStatus, "partial");
assert.strictEqual(test3Res.remainingInvoiceBalance, 900000);
console.log("✓ Test 3 Passed: Payment > Rp 400.000 (Rp 1.000.000) pays SALUT fee fully + Rp 600.000 to UT liability");

// Test 4: Full payment of Rp 1.900.000
const test4Res = calculateInvoicePaymentAllocation(sampleInvoiceItems, 1900000);
assert.strictEqual(test4Res.serviceFeePaid, 400000);
assert.strictEqual(test4Res.serviceFeeStatus, "paid");
assert.strictEqual(test4Res.utLiabilityPaid, 1500000);
assert.strictEqual(test4Res.utLiabilityStatus, "paid");
assert.strictEqual(test4Res.remainingInvoiceBalance, 0);
assert.strictEqual(test4Res.invoicePaymentStatus, "paid");
console.log("✓ Test 4 Passed: Full payment (Rp 1.900.000) fully pays SALUT fee & UT liability");

// Test 5: Overpayment (e.g. Rp 2.000.000)
const test5Res = calculateInvoicePaymentAllocation(sampleInvoiceItems, 2000000);
assert.strictEqual(test5Res.serviceFeePaid, 400000);
assert.strictEqual(test5Res.utLiabilityPaid, 1500000);
assert.strictEqual(test5Res.remainingInvoiceBalance, 0);
console.log("✓ Test 5 Passed: Overpayment clamped correctly without breaking item max totals");

console.log("=== ALL PAYMENT PRIORITY ALLOCATION TESTS PASSED CLEANLY! ===");
