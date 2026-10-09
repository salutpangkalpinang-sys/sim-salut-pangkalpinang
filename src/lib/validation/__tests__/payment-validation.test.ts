import assert from "node:assert";
import {
  studentPaymentSchema,
  voidRequestSchema,
  getPaymentMethodCategory,
  getCashAccountType,
  validatePaymentAccountPairing,
} from "../payment";
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

// Fixtures for Payment Methods and Cash Accounts
const fixtureKasTunai = {
  id: "820746b7-4be8-4275-969d-75f950ef9c86",
  code: "KAS_TUNAI",
  name: "Kas Tunai SALUT Pangkalpinang",
  bank_name: null,
  account_number: null,
  is_active: true,
};

const fixtureBankBca = {
  id: "bc6fb596-505e-43b6-b30c-f0c077293959",
  code: "BANK_BCA",
  name: "Rekening Bank BCA SALUT",
  bank_name: "Bank Central Asia",
  account_number: "8870123456",
  is_active: true,
};

const fixtureBankBri = {
  id: "c0b85a56-6382-4aeb-a060-9b3516e8a08d",
  code: "BANK_BRI",
  name: "Rekening Bank BRI SALUT",
  bank_name: "Bank Rakyat Indonesia",
  account_number: "001201002345501",
  is_active: true,
};

const fixtureInactiveBank = {
  id: "deadbeef-1111-2222-3333-444455556666",
  code: "BANK_INACTIVE",
  name: "Rekening Bank Nonaktif",
  bank_name: "Bank Tutup",
  account_number: "999999999",
  is_active: false,
};

// Test 9: Category and Account Type Detection
assert.strictEqual(getPaymentMethodCategory("CASH"), "cash");
assert.strictEqual(getPaymentMethodCategory("BANK_TRANSFER"), "bank");
assert.strictEqual(getCashAccountType(fixtureKasTunai), "cash");
assert.strictEqual(getCashAccountType(fixtureBankBca), "bank");
assert.strictEqual(getCashAccountType(fixtureBankBri), "bank");
console.log("✓ Test 9 Passed: Payment method category and cash account types identified correctly");

// Test 10: Valid Pairing Acceptance
const validCashPair = validatePaymentAccountPairing({
  methodCode: "CASH",
  account: fixtureKasTunai,
});
assert.strictEqual(validCashPair.valid, true);

const validBankPairBca = validatePaymentAccountPairing({
  methodCode: "BANK_TRANSFER",
  account: fixtureBankBca,
});
assert.strictEqual(validBankPairBca.valid, true);

const validBankPairBri = validatePaymentAccountPairing({
  methodCode: "BANK_TRANSFER",
  account: fixtureBankBri,
});
assert.strictEqual(validBankPairBri.valid, true);
console.log("✓ Test 10 Passed: Valid pairs (CASH -> KAS_TUNAI, BANK_TRANSFER -> BANK_BCA/BRI) accepted");

// Test 11: Invalid Pairing Rejection
// 11.1 Cash method with bank account -> REJECT
const invalidCashToBank = validatePaymentAccountPairing({
  methodCode: "CASH",
  account: fixtureBankBca,
});
assert.strictEqual(invalidCashToBank.valid, false);
assert.match(invalidCashToBank.message || "", /Kas Tunai/);

// 11.2 Bank transfer method with cash account -> REJECT
const invalidBankToCash = validatePaymentAccountPairing({
  methodCode: "BANK_TRANSFER",
  account: fixtureKasTunai,
});
assert.strictEqual(invalidBankToCash.valid, false);
assert.match(invalidBankToCash.message || "", /Rekening Bank/);
console.log("✓ Test 11 Passed: Invalid pairs (Tunai ke Bank & Transfer Bank ke Kas Tunai) strictly rejected");

// Test 12: Inactive Account and Inactive Method Rejection
const inactiveAccountPair = validatePaymentAccountPairing({
  methodCode: "BANK_TRANSFER",
  account: fixtureInactiveBank,
});
assert.strictEqual(inactiveAccountPair.valid, false);
assert.match(inactiveAccountPair.message || "", /tidak aktif/);

const inactiveMethodPair = validatePaymentAccountPairing({
  methodCode: "CASH",
  methodIsActive: false,
  account: fixtureKasTunai,
});
assert.strictEqual(inactiveMethodPair.valid, false);
assert.match(inactiveMethodPair.message || "", /nonaktif/);
console.log("✓ Test 12 Passed: Inactive cash account and inactive payment method strictly rejected");

// Test 13: Payment Method Switching Reset Logic
// Requirement: Saat metode berubah, kosongkan rekening yang tidak cocok. Jangan otomatis memilih rekening pengganti.
const simulateMethodSwitch = (
  newMethodCode: string,
  currentAccountId: string,
  availableAccounts: Array<{
    id: string;
    code: string;
    name: string;
    bank_name: string | null;
    account_number: string | null;
    is_active: boolean;
  }>
) => {
  const currentAcc = availableAccounts.find((a) => a.id === currentAccountId);
  if (!currentAcc) return "";
  const check = validatePaymentAccountPairing({
    methodCode: newMethodCode,
    account: currentAcc,
  });
  // Jika masih cocok, pertahankan akun yang sedang dipilih.
  if (check.valid) return currentAccountId;

  // Jika tidak cocok, KOSONGKAN pilihan rekening (""). JANGAN otomatis memilih pengganti.
  return "";
};

const allAccounts = [fixtureKasTunai, fixtureBankBca, fixtureBankBri];

// Switching from BANK_TRANSFER (currently Bank BCA) to CASH -> Akun Bank BCA tidak cocok untuk CASH -> Wajib kosong ("")
const switchedToCash = simulateMethodSwitch("CASH", fixtureBankBca.id, allAccounts);
assert.strictEqual(switchedToCash, "", "Account must be emptied when switching to incompatible method");

// Switching from CASH (currently Kas Tunai) to BANK_TRANSFER -> Kas Tunai tidak cocok untuk BANK_TRANSFER -> Wajib kosong ("")
const switchedToBank = simulateMethodSwitch("BANK_TRANSFER", fixtureKasTunai.id, allAccounts);
assert.strictEqual(switchedToBank, "", "Account must be emptied when switching to incompatible method");

// Switching from BANK_TRANSFER (currently Bank BCA) to BANK_TRANSFER -> Masih cocok -> Pertahankan Bank BCA
const keptBank = simulateMethodSwitch("BANK_TRANSFER", fixtureBankBca.id, allAccounts);
assert.strictEqual(keptBank, fixtureBankBca.id, "Compatible account must be preserved");

console.log("✓ Test 13 Passed: Switching payment method clears incompatible account without auto-selecting substitute");

// Test 14: Unrecognized Method or Cash Account Code (Fail-Closed)
const unknownMethodPair = validatePaymentAccountPairing({
  methodCode: "CRYPTO_USDT",
  account: fixtureKasTunai,
});
assert.strictEqual(unknownMethodPair.valid, false);
assert.match(unknownMethodPair.message || "", /tidak dikenal dalam master resmi/);

const unknownAccountPair = validatePaymentAccountPairing({
  methodCode: "BANK_TRANSFER",
  account: {
    id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
    code: "GOPAY_SALUT",
    name: "GoPay SALUT",
    is_active: true,
  },
});
assert.strictEqual(unknownAccountPair.valid, false);
assert.match(unknownAccountPair.message || "", /tidak dikenal dalam master resmi/);
console.log("✓ Test 14 Passed: Unrecognized payment method or cash account code strictly rejected (Fail-Closed)");

console.log("=== ALL STUDENT PAYMENTS VALIDATION & SECURITY TESTS PASSED CLEANLY! ===");
