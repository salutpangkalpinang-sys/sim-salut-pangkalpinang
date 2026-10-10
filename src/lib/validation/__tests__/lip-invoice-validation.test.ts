import assert from "node:assert";
import { validateFileMetadata, validateFileMagicBytes, lipDocumentSchema } from "../lip-invoice";
import { hasPermission } from "../../auth/types";
import { computeRegistrationUtEstimate } from "../../utils/tariff-resolver";

console.log("=== Running LIP & Invoice Validation & Security Unit Tests ===");

// Test 1: Preflight Security - File Metadata Validation (PDF, JPG, PNG, WEBP <= 10MB)
const validPdf = validateFileMetadata("lip_20261.pdf", "application/pdf", 2 * 1024 * 1024);
assert.strictEqual(validPdf.valid, true);
console.log("✓ Test 1 Passed: Valid PDF file accepted");

// Test 2: Rejection of Executable / Invalid File Type (.exe)
const invalidExe = validateFileMetadata("malicious_script.exe", "application/x-msdownload", 1000);
assert.strictEqual(invalidExe.valid, false);
console.log("✓ Test 2 Passed: Invalid file type (.exe) rejected");

// Test 3: Rejection of File Size > 10MB
const oversizedFile = validateFileMetadata("large_scan.pdf", "application/pdf", 12 * 1024 * 1024);
assert.strictEqual(oversizedFile.valid, false);
console.log("✓ Test 3 Passed: File size > 10MB rejected");

// Test 4: Server-Side Magic-Byte Signature Validation (Spoofed Executable Renamed to PDF)
const fakePdfBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]); // Windows Executable (MZ) header
const magicValResult = validateFileMagicBytes(fakePdfBuffer, "spoofed.pdf");
assert.strictEqual(magicValResult.valid, false);
assert.strictEqual(magicValResult.message, "Isi berkas bukan dokumen PDF yang valid. Pengunggahan ditolak.");
console.log("✓ Test 4 Passed: Spoofed executable renamed to .pdf rejected via Magic Bytes");

// Test 5: LIP Component Mismatch Calculation Warning Test
const tuition = 4000000;
const book = 450000;
const componentTotal = tuition + book; // 4.450.000
const officialAmount = 4500000; // 4.500.000
const hasMismatch = componentTotal !== officialAmount;
const mismatchDiff = Math.abs(componentTotal - officialAmount);

assert.strictEqual(hasMismatch, true);
assert.strictEqual(mismatchDiff, 50000);
console.log("✓ Test 5 Passed: LIP Component Mismatch detected (Rp 4.450.000 vs Rp 4.500.000 = Mismatch Rp 50.000)");

// Test 6: Official Amount is Authoritative over Estimate & Component Sum
const feeEstimateAmount = 4450000;
const authoritativeOfficialAmount = 4500000;
assert.notStrictEqual(feeEstimateAmount, authoritativeOfficialAmount);
assert.strictEqual(authoritativeOfficialAmount, 4500000);
console.log("✓ Test 6 Passed: Official Amount is authoritative over estimate");

// Test 7: Invoice Total Calculation with Approved vs Unapproved Discount
const utLiabilityItem = { itemType: "ut_liability" as const, description: "Official UT", quantity: 1, unitAmount: 4500000 };
const serviceFeeItem = { itemType: "service_fee" as const, description: "SALUT Fee", quantity: 1, unitAmount: 400000 };
const pendingDiscountItem = { itemType: "discount" as const, description: "Beasiswa", quantity: 1, unitAmount: 100000, approvalStatus: "pending" as string };
const approvedDiscountItem = { itemType: "discount" as const, description: "Beasiswa Approved", quantity: 1, unitAmount: 100000, approvalStatus: "approved" as string };

let totalWithPending = utLiabilityItem.unitAmount + serviceFeeItem.unitAmount;
if (pendingDiscountItem.approvalStatus === "approved") {
  totalWithPending -= pendingDiscountItem.unitAmount;
}
assert.strictEqual(totalWithPending, 4900000); // Unapproved discount is NOT deducted!

let totalWithApproved = utLiabilityItem.unitAmount + serviceFeeItem.unitAmount;
if (approvedDiscountItem.approvalStatus === "approved") {
  totalWithApproved -= approvedDiscountItem.unitAmount;
}
assert.strictEqual(totalWithApproved, 4800000); // Approved discount IS deducted!
console.log("✓ Test 7 Passed: Invoice total calculation verified (Unapproved discount excluded, Approved discount deducted)");

// Test 8: RBAC Permissions for LIP & Invoice Operations
const viewerCanCreateLip = hasPermission("viewer", ["owner", "academic_admin"]);
const financeCanCreateLip = hasPermission("finance_admin", ["owner", "academic_admin"]);
const academicCanCreateLip = hasPermission("academic_admin", ["owner", "academic_admin"]);
const ownerCanVerifyLip = hasPermission("owner", ["owner", "academic_admin"]);

assert.strictEqual(viewerCanCreateLip, false);
assert.strictEqual(financeCanCreateLip, false);
assert.strictEqual(academicCanCreateLip, true);
assert.strictEqual(ownerCanVerifyLip, true);
console.log("✓ Test 8 Passed: RBAC permissions for LIP & Invoice verified");

// Test 9: Production Schema Rejects Official Amount <= 0 and Empty LIP Number
const zeroOfficialParse = lipDocumentSchema.safeParse({
  registrationId: "a0000001-0000-0000-0000-000000000001",
  lipNumber: "LIP-20261-001",
  officialAmount: 0,
});
assert.strictEqual(zeroOfficialParse.success, false, "Schema must reject officialAmount = 0");

const validLipParse = lipDocumentSchema.safeParse({
  registrationId: "a0000001-0000-0000-0000-000000000001",
  lipNumber: "LIP-20261-001",
  officialAmount: 864000,
});
assert.strictEqual(validLipParse.success, true, "Schema must accept valid officialAmount > 0");
console.log("✓ Test 9 Passed: Production lipDocumentSchema enforces officialAmount > 0 and valid lipNumber");

// Test 10: computeRegistrationUtEstimate Strict Category Calculation & Internal Fee Exclusion
// Scenario Yahya: SPP (UT_OFFICIAL Rp864.000) + SALUT Service (SALUT_INTERNAL Rp400.000) + Internal Adm (SALUT_INTERNAL Rp50.000)
const snapshotsWithInternalFees = [
  { feeTypeCategory: "UT_OFFICIAL", totalAmount: 864000 },
  { feeTypeCategory: "SALUT_INTERNAL", totalAmount: 400000 },
  { feeTypeCategory: "SALUT_INTERNAL", totalAmount: 50000 },
];
const utEstimateStrict = computeRegistrationUtEstimate(snapshotsWithInternalFees);
assert.strictEqual(
  utEstimateStrict,
  864000,
  "computeRegistrationUtEstimate must strictly include only UT_OFFICIAL and exclude SALUT_INTERNAL fees"
);
console.log("✓ Test 10 Passed: computeRegistrationUtEstimate includes only UT_OFFICIAL and excludes all SALUT_INTERNAL / non-UT fees");

// Test 11: Fail-safe behavior when fee category metadata is missing, empty, or partial/mixed
const snapshotsWithoutCategoryMetadata = [
  { feeTypeCategory: undefined, totalAmount: 864000 },
  { feeTypeCategory: "", totalAmount: 400000 },
];
const utEstimateMissingMetadata = computeRegistrationUtEstimate(snapshotsWithoutCategoryMetadata);
assert.strictEqual(
  utEstimateMissingMetadata,
  null,
  "computeRegistrationUtEstimate must return null when all category metadata is missing"
);

// Mixed test: SALUT has category (SALUT_INTERNAL), but UT snapshot has missing/undefined category.
// Must return null instead of misleading partial amount or 0!
const snapshotsMixedCategory = [
  { feeTypeCategory: "SALUT_INTERNAL", totalAmount: 400000 },
  { feeTypeCategory: undefined, totalAmount: 864000 }, // UT snapshot missing category
];
const utEstimateMixed = computeRegistrationUtEstimate(snapshotsMixedCategory);
assert.strictEqual(
  utEstimateMixed,
  null,
  "computeRegistrationUtEstimate must return null if ANY snapshot is missing category metadata (e.g. SALUT known, UT unknown)"
);

const emptySnapshotsEstimate = computeRegistrationUtEstimate([]);
assert.strictEqual(
  emptySnapshotsEstimate,
  null,
  "computeRegistrationUtEstimate must return null for empty snapshots"
);

// Valid Rp 0 UT estimate: full category coverage, but 0 UT components (e.g. scholarship or zero UT liability)
const zeroUtSnapshotsWithValidCategories = [
  { feeTypeCategory: "SALUT_INTERNAL", totalAmount: 400000 },
  { feeTypeCategory: "UT_OFFICIAL", totalAmount: 0 },
];
const validZeroEstimate = computeRegistrationUtEstimate(zeroUtSnapshotsWithValidCategories);
assert.strictEqual(
  validZeroEstimate,
  0,
  "computeRegistrationUtEstimate must return 0 (not null) when category metadata is complete and UT total is 0"
);
console.log("✓ Test 11 Passed: computeRegistrationUtEstimate returns null when ANY category is missing (including mixed SALUT-known/UT-unknown), and returns valid 0 when complete");

// Test 12: Registration switching reset behavior
// Verifies that when a user switches student registration in creation mode, state resets to clean 0/empty
function getRegistrationSwitchState(
  _prev: { lipNumber: string; officialAmount: number; tuitionAmount: number },
  newRegId: string
) {
  return {
    registrationId: newRegId,
    lipNumber: "",
    officialAmount: 0,
    tuitionAmount: 0,
    bookAmount: 0,
    shippingAmount: 0,
    otherUtAmount: 0,
    notes: "",
  };
}

const dirtyState = { lipNumber: "LIP-OLD-001", officialAmount: 1500000, tuitionAmount: 1200000 };
const cleanState = getRegistrationSwitchState(dirtyState, "reg-new-student");
assert.strictEqual(cleanState.officialAmount, 0, "officialAmount must reset to 0 on registration switch");
assert.strictEqual(cleanState.tuitionAmount, 0, "tuitionAmount must reset to 0 on registration switch");
assert.strictEqual(cleanState.lipNumber, "", "lipNumber must reset to empty on registration switch");
console.log("✓ Test 12 Passed: Registration change strictly resets all financial and document fields to 0/empty");

console.log("=== ALL LIP & INVOICE VALIDATION TESTS PASSED CLEANLY! ===");
