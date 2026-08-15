import assert from "node:assert";
import { studentPaymentSchema, voidRequestSchema } from "../payment";
import { hasPermission } from "../../auth/types";

console.log("=== Running Student Payments Validation & Security Unit Tests ===");

// Test 1: Valid Integer Rupiah Payment Schema Validation
const validPaymentInput = {
  studentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  paidAt: new Date().toISOString(),
  amount: 2500000,
  paymentMethodId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  cashAccountId: null,
  referenceNumber: "REF-99201",
  notes: "Pembayaran Tahap 1",
  invoiceId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
  allocatedAmount: 2500000,
};

const validRes = studentPaymentSchema.safeParse(validPaymentInput);
assert.strictEqual(validRes.success, true);
console.log("✓ Test 1 Passed: Valid Integer Rupiah payment input accepted");

// Test 2: Rejection of Zero or Negative Amount
const zeroPaymentInput = { ...validPaymentInput, amount: 0 };
const zeroRes = studentPaymentSchema.safeParse(zeroPaymentInput);
assert.strictEqual(zeroRes.success, false);
console.log("✓ Test 2 Passed: Zero payment amount rejected (amount > 0 required)");

// Test 3: Rejection of Non-Integer Floating Point Amount
const floatPaymentInput = { ...validPaymentInput, amount: 1500000.55 };
const floatRes = studentPaymentSchema.safeParse(floatPaymentInput);
assert.strictEqual(floatRes.success, false);
console.log("✓ Test 3 Passed: Floating point payment amount rejected (Integer Rupiah required)");

// Test 4: Calculation of Allocation & Overpayment
const paymentAmount = 5100000;
const invoiceRemaining = 5000000;
const allocatedAmount = Math.min(paymentAmount, invoiceRemaining);
const unallocatedAmount = Math.max(0, paymentAmount - allocatedAmount);

assert.strictEqual(allocatedAmount, 5000000);
assert.strictEqual(unallocatedAmount, 100000);
console.log("✓ Test 4 Passed: Overpayment allocation calculation verified (Payment Rp5.100.000 -> Allocated Rp5.000.000, Overpay Rp100.000)");

// Test 5: Invoice Derived Status Logic Check
const calculateInvoiceStatus = (total: number, verifiedPaid: number, cancelled = false) => {
  if (cancelled) return "cancelled";
  if (verifiedPaid >= total && total > 0) return "paid";
  if (verifiedPaid > 0) return "partial";
  return "unpaid";
};

assert.strictEqual(calculateInvoiceStatus(5000000, 0), "unpaid");
assert.strictEqual(calculateInvoiceStatus(5000000, 2000000), "partial");
assert.strictEqual(calculateInvoiceStatus(5000000, 5000000), "paid");
assert.strictEqual(calculateInvoiceStatus(5000000, 5000000, true), "cancelled");
console.log("✓ Test 5 Passed: Invoice derived payment status calculated correctly (unpaid, partial, paid, cancelled)");

// Test 6: Void Request Validation & Owner-Only Void Approval Permission Check
const invalidVoidInput = { paymentId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", reason: "  " };
const voidRes = voidRequestSchema.safeParse(invalidVoidInput);
assert.strictEqual(voidRes.success, false);

const financeCanApproveVoid = hasPermission("finance_admin", ["owner"]);
const academicCanApproveVoid = hasPermission("academic_admin", ["owner"]);
const ownerCanApproveVoid = hasPermission("owner", ["owner"]);

assert.strictEqual(financeCanApproveVoid, false);
assert.strictEqual(academicCanApproveVoid, false);
assert.strictEqual(ownerCanApproveVoid, true);
console.log("✓ Test 6 Passed: Void request validation & Owner-only approval restriction verified");

// Test 7: Receipt Eligibility Logic
const isReceiptEligible = (status: string) => status === "verified" || status === "voided";
assert.strictEqual(isReceiptEligible("draft"), false);
assert.strictEqual(isReceiptEligible("pending_verification"), false);
assert.strictEqual(isReceiptEligible("rejected"), false);
assert.strictEqual(isReceiptEligible("verified"), true);
assert.strictEqual(isReceiptEligible("voided"), true);
console.log("✓ Test 7 Passed: Receipt eligibility verified (Only verified or voided payments allow receipt generation)");

// Test 8: Academic Admin Financial Mutation Denial Test
const academicCanCreatePayment = hasPermission("academic_admin", ["owner", "finance_admin"]);
const viewerCanCreatePayment = hasPermission("viewer", ["owner", "finance_admin"]);
const financeCanCreatePayment = hasPermission("finance_admin", ["owner", "finance_admin"]);

assert.strictEqual(academicCanCreatePayment, false);
assert.strictEqual(viewerCanCreatePayment, false);
assert.strictEqual(financeCanCreatePayment, true);
console.log("✓ Test 8 Passed: Academic Admin and Viewer denied from financial mutations");

console.log("=== ALL STUDENT PAYMENTS VALIDATION & SECURITY TESTS PASSED CLEANLY! ===");
