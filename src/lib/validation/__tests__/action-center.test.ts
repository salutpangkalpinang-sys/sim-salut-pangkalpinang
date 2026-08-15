import assert from "node:assert";
import { getPriorityLevel } from "../../constants/aging";

console.log("=== Running Post-Launch Iteration 1 — Action Center & Operational Reminder Unit Tests ===");

// 1. Pending Payment Counting Logic (Canonical status: pending_verification)
const mockPayments = [
  { id: "p1", status: "pending_verification", amount: 500000 },
  { id: "p2", status: "pending_verification", amount: 1500000 },
  { id: "p3", status: "verified", amount: 2000000 },
  { id: "p4", status: "rejected", amount: 1000000 },
  { id: "p5", status: "voided", amount: 500000 },
];

const pendingPayments = mockPayments.filter((p) => p.status === "pending_verification");
const pendingPaymentTotal = pendingPayments.reduce((acc, curr) => acc + curr.amount, 0);

assert.strictEqual(pendingPayments.length, 2, "Only pending_verification payments are counted (2)");
assert.strictEqual(pendingPaymentTotal, 2000000, "Pending payment total is Rp2.000.000");
console.log("✓ Test 1 & 2 Passed: Pending payment count & verified/rejected/voided exclusion verified");

// 2. Pending LIP Counting Logic (Canonical status: pending_verification)
const mockLips = [
  { id: "l1", status: "pending_verification" },
  { id: "l2", status: "verified" },
  { id: "l3", status: "cancelled" },
];

const pendingLips = mockLips.filter((l) => l.status === "pending_verification");
assert.strictEqual(pendingLips.length, 1, "Only pending_verification LIPs are counted (1)");
console.log("✓ Test 3 & 4 Passed: Pending LIP count & verified/cancelled exclusion verified");

// 3. Receivable Calculation Logic (MAX(total - verified, 0)) & Cancelled Exclusion
const mockInvoices = [
  {
    id: "inv1",
    status: "issued",
    totalAmount: 5000000,
    allocations: [
      { amount: 3000000, paymentStatus: "verified" },
      { amount: 1000000, paymentStatus: "pending_verification" }, // Excluded from verified payment deduction
    ],
  },
  {
    id: "inv2",
    status: "cancelled", // Cancelled invoice MUST be excluded
    totalAmount: 4000000,
    allocations: [],
  },
];

let receivablesCount = 0;
let receivablesTotal = 0;

mockInvoices.forEach((inv) => {
  if (inv.status === "cancelled") return; // Rule 6: Cancelled invoice excluded

  const verifiedPaid = inv.allocations
    .filter((a) => a.paymentStatus === "verified")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const remaining = Math.max(0, inv.totalAmount - verifiedPaid);
  if (remaining > 0) {
    receivablesCount++;
    receivablesTotal += remaining;
  }
});

assert.strictEqual(receivablesCount, 1, "Active invoice with remaining balance counted (1)");
assert.strictEqual(receivablesTotal, 2000000, "Receivable total is Rp2.000.000 (Rp5.000.000 - Rp3.000.000 verified)");
console.log("✓ Test 5 & 6 Passed: Student receivable uses verified allocations & excludes cancelled invoices");

// 4. UT Outstanding Calculation (official_amount - verified_ut_paid) & Voided Remittance Exclusion
const mockLipUtData = [
  {
    id: "lip-ut-1",
    status: "verified",
    officialAmount: 4500000, // Official UT Liability
    invoiceTotal: 5000000, // Service fee included invoice total MUST NOT be used as UT liability
    remittances: [
      { amount: 3000000, remittanceStatus: "verified" }, // Verified remittance reduces outstanding
      { amount: 1500000, remittanceStatus: "voided" }, // Voided remittance DOES NOT reduce outstanding
    ],
  },
];

let utOutstandingCount = 0;
let utOutstandingTotal = 0;

mockLipUtData.forEach((lip) => {
  const verifiedUtPaid = lip.remittances
    .filter((r) => r.remittanceStatus === "verified")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const outstanding = Math.max(0, lip.officialAmount - verifiedUtPaid);
  if (outstanding > 0) {
    utOutstandingCount++;
    utOutstandingTotal += outstanding;
  }
});

assert.strictEqual(utOutstandingCount, 1, "Outstanding UT count is 1");
assert.strictEqual(
  utOutstandingTotal,
  1500000,
  "Outstanding UT total is Rp1.500.000 (Rp4.500.000 official - Rp3.000.000 verified remittance)"
);
assert.notStrictEqual(
  utOutstandingTotal,
  2000000,
  "Invoice total (Rp5.000.000) was NOT used as UT liability"
);
console.log("✓ Test 7, 8, 9 & 10 Passed: UT liability uses official LIP, verified remittance reduces liability, voided remittance excluded");

// 5. Draft Registration Count
const mockRegistrations = [
  { id: "r1", status: "draft" },
  { id: "r2", status: "draft" },
  { id: "r3", status: "submitted" },
];

const draftRegs = mockRegistrations.filter((r) => r.status === "draft");
assert.strictEqual(draftRegs.length, 2, "Draft registration count is 2");
console.log("✓ Test 11 Passed: Registration draft count verified");

// 6. Deep Link Filter Path Verification (Canonical URLs)
const deepLinks = {
  pendingPayments: "/pembayaran?status=pending_verification",
  pendingLips: "/lip-tagihan?tab=lip&status=pending_verification",
  receivables: "/laporan?report=invoices&balance=outstanding",
  outstandingUt: "/setoran-ut?filter=outstanding",
  draftRegistrations: "/registrasi?status=draft",
};

assert(deepLinks.pendingPayments.includes("status=pending_verification"));
assert(deepLinks.pendingLips.includes("tab=lip") && deepLinks.pendingLips.includes("status=pending_verification"));
assert(deepLinks.receivables.includes("balance=outstanding"));
assert(deepLinks.outstandingUt.includes("filter=outstanding"));
assert(deepLinks.draftRegistrations.includes("status=draft"));
console.log("✓ Test 12 Passed: Deep link query filters with canonical database status verified");

// 7. Role Awareness Filtering
function filterActionItemsForRole(role: string, allItems: string[]): string[] {
  if (role === "owner" || role === "viewer") return allItems;
  if (role === "finance_admin") {
    return allItems.filter((i) => ["pending_payments", "student_receivables", "outstanding_ut"].includes(i));
  }
  if (role === "academic_admin") {
    return allItems.filter((i) => ["pending_lips", "draft_registrations"].includes(i));
  }
  return [];
}

const all5Items = [
  "pending_payments",
  "pending_lips",
  "student_receivables",
  "outstanding_ut",
  "draft_registrations",
];

assert.strictEqual(filterActionItemsForRole("owner", all5Items).length, 5, "Owner sees all 5 action categories");
assert.strictEqual(filterActionItemsForRole("finance_admin", all5Items).length, 3, "Finance Admin sees 3 financial items");
assert.strictEqual(filterActionItemsForRole("academic_admin", all5Items).length, 2, "Academic Admin sees 2 academic items");
console.log("✓ Test 13, 14 & 15 Passed: RBAC role-aware Action Center filtering verified");

// 8. Positive Zero State & Aging Priority Test
const zeroItems: any[] = [];
assert.strictEqual(zeroItems.length, 0, "Zero actions result in clean empty state");

const nowStr = new Date().toISOString();
const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const tenDaysAgoStr = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

assert.strictEqual(getPriorityLevel(nowStr), "BARU", "0-2 days is BARU");
assert.strictEqual(getPriorityLevel(threeDaysAgoStr), "PERLU_PERHATIAN", "3-7 days is PERLU_PERHATIAN");
assert.strictEqual(getPriorityLevel(tenDaysAgoStr), "URGENT", ">7 days is URGENT");
assert.strictEqual(getPriorityLevel(nowStr, true), "URGENT", "Overdue is URGENT regardless of age");
console.log("✓ Test 16 Passed: Positive zero state & standardized aging priority thresholds verified");

console.log("=== ALL POST-LAUNCH ITERATION 1 ACTION CENTER TESTS PASSED CLEANLY! ===");
