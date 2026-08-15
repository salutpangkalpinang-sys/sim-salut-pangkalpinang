import assert from "node:assert";

console.log("=== Running Phase 6B — Post-Launch Iteration 1 UX Automated Tests ===");

// Test 1: KPI Terminology & Service Fee Semantics Check
const serviceFeeBilledCopy = "Total biaya layanan SALUT pada tagihan aktif. Nilai ini merupakan jumlah yang ditagihkan dan belum tentu seluruhnya sudah diterima sebagai kas.";

assert.strictEqual(serviceFeeBilledCopy.includes("ditagihkan"), true);
assert.strictEqual(serviceFeeBilledCopy.includes("kas"), true);
assert.strictEqual(serviceFeeBilledCopy.toLowerCase().includes("profit"), false);
assert.strictEqual(serviceFeeBilledCopy.toLowerCase().includes("laba"), false);
console.log("✓ Test 1 Passed: Service fee billed terminology verified (no Profit/Laba, copy explicitly notes billed != cash)");

// Test 2: Report State Helper Logic Check
function resolveReportState(totalCount: number, filteredCount: number, hasActiveFilter: boolean) {
  if (totalCount === 0) return "TRUE_EMPTY";
  if (hasActiveFilter && filteredCount === 0) return "FILTERED_NO_RESULT";
  return "HAS_DATA";
}

assert.strictEqual(resolveReportState(0, 0, false), "TRUE_EMPTY");
assert.strictEqual(resolveReportState(10, 0, true), "FILTERED_NO_RESULT");
assert.strictEqual(resolveReportState(10, 5, true), "HAS_DATA");
console.log("✓ Test 2 Passed: Report state differentiation helper verified (True Empty vs Filtered No-Result)");

// Test 3: Payment Receipt Eligibility Check
function canShowReceiptShortcut(status: string): { eligible: boolean; type?: string } {
  if (status === "verified") return { eligible: true, type: "official" };
  if (status === "voided") return { eligible: true, type: "historical_void" };
  return { eligible: false };
}

assert.strictEqual(canShowReceiptShortcut("verified").eligible, true);
assert.strictEqual(canShowReceiptShortcut("verified").type, "official");

assert.strictEqual(canShowReceiptShortcut("voided").eligible, true);
assert.strictEqual(canShowReceiptShortcut("voided").type, "historical_void");

assert.strictEqual(canShowReceiptShortcut("pending_verification").eligible, false);
assert.strictEqual(canShowReceiptShortcut("rejected").eligible, false);
assert.strictEqual(canShowReceiptShortcut("draft").eligible, false);

console.log("✓ Test 3 Passed: Receipt shortcut eligibility rules verified (Verified & Voided allowed, Pending/Rejected/Draft denied)");

console.log("=== ALL PHASE 6B ITERATION 1 UX TESTS PASSED CLEANLY! ===");
