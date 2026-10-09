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

// Test 6: Dixit Correction Case (INV-2026-10006)
// Items:
// 1. service_fee: Rp 400.000
// 2. ut_liability (registrasi awal): Rp 1.300.000
// 3. ut_liability (shortage lama sebelum koreksi): Rp 517.600
// 4. discount (reversal shortage lama, source_type: lip_reconciliation): Rp 517.600
// 5. ut_liability (shortage terkoreksi baru): Rp 117.600
// Net UT Liability = (1.300.000 + 517.600 + 117.600) - 517.600 = Rp 1.417.600
// Total Invoice = 400.000 + 1.417.600 = Rp 1.817.600
const dixitInvoiceItems = [
  { item_type: "service_fee", amount: 400000 },
  { item_type: "ut_liability", amount: 1300000, source_type: "registration" },
  { item_type: "ut_liability", amount: 517600, source_type: "lip_reconciliation" },
  {
    item_type: "discount",
    amount: 517600,
    source_type: "lip_reconciliation",
    approval_status: "approved",
    description: "Pembatalan/Reversal Penyesuaian Rekonsiliasi LIP Lama (Ref: rec-old)",
  },
  { item_type: "ut_liability", amount: 117600, source_type: "lip_reconciliation" },
];

// Test 6.1: Dixit setelah pembayaran awal Rp 1.700.000 (sebelum pelunasan sisa)
// SALUT: Rp 400.000 (Lunas), UT: Rp 1.300.000 / Rp 1.417.600 (Terbayar Sebagian, Sisa Rp 117.600)
const dixitPartialRes = calculateInvoicePaymentAllocation(dixitInvoiceItems, 1700000);
assert.strictEqual(dixitPartialRes.serviceFeeTotal, 400000);
assert.strictEqual(dixitPartialRes.serviceFeePaid, 400000);
assert.strictEqual(dixitPartialRes.serviceFeeRemaining, 0);
assert.strictEqual(dixitPartialRes.serviceFeeStatus, "paid");
assert.strictEqual(dixitPartialRes.utLiabilityTotal, 1417600); // Harus Net UT 1.417.600, BUKAN Gross 1.935.200!
assert.strictEqual(dixitPartialRes.utLiabilityPaid, 1300000);
assert.strictEqual(dixitPartialRes.utLiabilityRemaining, 117600);
assert.strictEqual(dixitPartialRes.utLiabilityStatus, "partial");
assert.strictEqual(dixitPartialRes.invoiceTotalAmount, 1817600);
assert.strictEqual(dixitPartialRes.remainingInvoiceBalance, 117600);
assert.strictEqual(dixitPartialRes.invoicePaymentStatus, "partial");
console.log("✓ Test 6.1 Passed: Dixit partial payment (Rp 1.700.000) gives net UT Rp 1.417.600 and remaining Rp 117.600");

// Test 6.2: Dixit setelah pelunasan uji PAY-2026-10014 Rp 117.600 (Total verified Rp 1.817.600)
// SALUT: Rp 400.000 (Lunas), UT: Rp 1.417.600 / Rp 1.417.600 (Lunas, Sisa Rp 0)
const dixitFullRes = calculateInvoicePaymentAllocation(dixitInvoiceItems, 1817600);
assert.strictEqual(dixitFullRes.serviceFeeTotal, 400000);
assert.strictEqual(dixitFullRes.serviceFeePaid, 400000);
assert.strictEqual(dixitFullRes.serviceFeeRemaining, 0);
assert.strictEqual(dixitFullRes.serviceFeeStatus, "paid");
assert.strictEqual(dixitFullRes.utLiabilityTotal, 1417600); // Net UT 1.417.600!
assert.strictEqual(dixitFullRes.utLiabilityPaid, 1417600);
assert.strictEqual(dixitFullRes.utLiabilityRemaining, 0);
assert.strictEqual(dixitFullRes.utLiabilityStatus, "paid"); // Badge harus LUNAS, BUKAN Terbayar Sebagian!
assert.strictEqual(dixitFullRes.invoiceTotalAmount, 1817600);
assert.strictEqual(dixitFullRes.remainingInvoiceBalance, 0);
assert.strictEqual(dixitFullRes.invoicePaymentStatus, "paid");
console.log("✓ Test 6.2 Passed: Dixit fully settled (Rp 1.817.600) marks UT liability LUNAS (Rp 1.417.600 / Rp 1.417.600)");

// Test 7: Non-UT discount should NOT reduce utLiabilityTotal
// Fixture: service_fee 400k, ut_liability 1.500k, general discount (promosi) 100k
// Total invoice: 1.800k. utLiabilityTotal must stay 1.500.000.
const generalDiscountItems = [
  { item_type: "service_fee", amount: 400000 },
  { item_type: "ut_liability", amount: 1500000 },
  { item_type: "discount", amount: 100000, approval_status: "approved", description: "Diskon Promosi Beasiswa" },
];
const genDiscRes = calculateInvoicePaymentAllocation(generalDiscountItems, 1800000);
assert.strictEqual(genDiscRes.utLiabilityTotal, 1500000); // NOT 1.400.000!
assert.strictEqual(genDiscRes.invoiceTotalAmount, 1800000);
console.log("✓ Test 7 Passed: General non-reconciliation discount does NOT arbitrarily reduce UT liability total");

// Test 8: Discount pending or rejected must NOT reduce invoice total or UT liability
const unapprovedDiscountItems = [
  { item_type: "service_fee", amount: 400000 },
  { item_type: "ut_liability", amount: 1500000 },
  { item_type: "discount", amount: 200000, source_type: "lip_reconciliation", approval_status: "pending" },
  { item_type: "discount", amount: 100000, source_type: "lip_reconciliation", approval_status: "rejected" },
];
const unapprovedRes = calculateInvoicePaymentAllocation(unapprovedDiscountItems, 1900000);
assert.strictEqual(unapprovedRes.discountTotal, 0);
assert.strictEqual(unapprovedRes.utLiabilityTotal, 1500000); // Pending/rejected did not reduce UT liability
assert.strictEqual(unapprovedRes.invoiceTotalAmount, 1900000); // Pending/rejected did not reduce invoice total
console.log("✓ Test 8 Passed: Pending or rejected discounts are strictly ignored and do NOT reduce UT liability or invoice total");

// Test 9: Description resembling reversal without valid source_type ('lip_reconciliation') must NOT reduce UT liability
const fakeReversalDescItems = [
  { item_type: "service_fee", amount: 400000 },
  { item_type: "ut_liability", amount: 1500000 },
  {
    item_type: "discount",
    amount: 150000,
    source_type: "manual", // Bukan 'lip_reconciliation'!
    approval_status: "approved",
    description: "Reversal penyesuaian rekonsiliasi LIP lama palsu",
  },
];
const fakeReversalRes = calculateInvoicePaymentAllocation(fakeReversalDescItems, 1750000);
assert.strictEqual(fakeReversalRes.utLiabilityTotal, 1500000); // UT liability TETAP 1.500.000!
assert.strictEqual(fakeReversalRes.discountTotal, 150000); // Diakui di level invoice total
assert.strictEqual(fakeReversalRes.invoiceTotalAmount, 1750000); // Invoice berkurang 150.000
console.log("✓ Test 9 Passed: Description resembling reversal without source_type = 'lip_reconciliation' does NOT reduce UT liability");

console.log("=== ALL PAYMENT PRIORITY ALLOCATION TESTS PASSED CLEANLY! ===");
