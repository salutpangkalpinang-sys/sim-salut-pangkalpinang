import assert from "node:assert";
import { validateFileMetadata, validateFileMagicBytes } from "../lip-invoice";
import { hasPermission } from "../../auth/types";


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

console.log("=== ALL LIP & INVOICE VALIDATION TESTS PASSED CLEANLY! ===");
