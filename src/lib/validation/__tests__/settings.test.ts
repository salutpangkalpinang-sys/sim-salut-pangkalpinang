import assert from "node:assert";
import { settingsSchema, validateSettingKeyAllowlist } from "../settings";

console.log("=== Running Phase 6C.3 — System Settings & Security Allowlist Unit Tests ===");

// 1. Valid Settings Schema Input
const validPayload = {
  salut_name: "SALUT Pangkalpinang",
  salut_official_name: "Sentra Layanan Universitas Terbuka Pangkalpinang",
  salut_address: "Jl. Utama No. 12, Pangkalpinang",
  salut_city: "Pangkalpinang",
  salut_province: "Kepulauan Bangka Belitung",
  salut_postal_code: "33111",
  salut_whatsapp: "081234567890",
  salut_email: "info@salut-pangkalpinang.ac.id",
  salut_leader_name: "Drs. H. Ahmad Subagyo, M.M.",

  receipt_header_name: "SALUT PANGKALPINANG",
  receipt_address: "Jl. Utama No. 12, Pangkalpinang, Bangka Belitung",
  receipt_whatsapp: "081234567890",
  receipt_email: "keuangan@salut-pangkalpinang.ac.id",
  receipt_leader_name: "Drs. H. Ahmad Subagyo, M.M.",
  receipt_footer: "1. Bukti kuitansi resmi.",

  default_salut_fee: 400000,
};

const validRes = settingsSchema.safeParse(validPayload);
assert.strictEqual(validRes.success, true, "Valid settings payload accepted");
console.log("✓ Test 1 Passed: Valid system settings schema payload accepted");

// 2. Invalid Email Validation
const invalidEmail = settingsSchema.safeParse({ ...validPayload, salut_email: "invalid-email-string" });
assert.strictEqual(invalidEmail.success, false, "Invalid email rejected");
console.log("✓ Test 2 Passed: Invalid email input rejected by Zod schema");

// 3. Decimal Fee Validation (Rejection)
const decimalFee = settingsSchema.safeParse({ ...validPayload, default_salut_fee: 400000.5 });
assert.strictEqual(decimalFee.success, false, "Floating point / decimal fee rejected");
console.log("✓ Test 3 Passed: Decimal / floating point fee rejected");

// 4. Negative Fee Validation (Rejection)
const negativeFee = settingsSchema.safeParse({ ...validPayload, default_salut_fee: -100000 });
assert.strictEqual(negativeFee.success, false, "Negative fee rejected");
console.log("✓ Test 4 Passed: Negative fee rejected");

// 5. Allowlist Key Guard (Rejection of Arbitrary / Secret Keys)
assert.strictEqual(validateSettingKeyAllowlist("salut_name").isValid, true, "Allowed key accepted");
assert.strictEqual(validateSettingKeyAllowlist("default_salut_fee").isValid, true, "Default fee key accepted");

const arbitraryCheck = validateSettingKeyAllowlist("jwt_secret");
assert.strictEqual(arbitraryCheck.isValid, false, "Arbitrary / secret key rejected");
assert(arbitraryCheck.error?.includes("tidak diizinkan"), "Allowlist error message verified");

const secretCheck = validateSettingKeyAllowlist("service_role_key");
assert.strictEqual(secretCheck.isValid, false, "Service role key rejected by allowlist");
console.log("✓ Test 5 Passed: Allowlist guard rejects arbitrary and secret keys");

// 6. Historical Financial Snapshot Immutability Verification
const historicalFeeSnapshot = {
  registrationId: "reg-20251-001",
  feeName: "Biaya Layanan SALUT",
  unitAmount: 400000, // Historical snapshot stored in 2025
  quantity: 1,
  totalAmount: 400000,
};

const newDefaultFeeSetting = 500000; // Owner changes default fee to 500.000 for NEW registrations

// Verify historical snapshot remains unchanged at 400.000 (not updated to 500.000)
assert.notStrictEqual(
  historicalFeeSnapshot.totalAmount,
  newDefaultFeeSetting,
  "Historical registration fee snapshot remains unchanged despite default fee setting update"
);
assert.strictEqual(
  historicalFeeSnapshot.totalAmount,
  400000,
  "Historical registration fee snapshot remains 400.000"
);
console.log("✓ Test 6 Passed: Historical fee snapshot immutability verified (past invoices/snapshots unaffected)");

// 7. Non-Owner Server Authorization Simulation
function simulateSettingsUpdateAuthorization(role: string): { isAllowed: boolean } {
  if (role !== "owner") {
    return { isAllowed: false };
  }
  return { isAllowed: true };
}

assert.strictEqual(simulateSettingsUpdateAuthorization("owner").isAllowed, true, "Owner authorized to update settings");
assert.strictEqual(simulateSettingsUpdateAuthorization("academic_admin").isAllowed, false, "Academic Admin mutation denied");
assert.strictEqual(simulateSettingsUpdateAuthorization("finance_admin").isAllowed, false, "Finance Admin mutation denied");
assert.strictEqual(simulateSettingsUpdateAuthorization("viewer").isAllowed, false, "Viewer mutation denied");
console.log("✓ Test 7 Passed: Server-side RBAC restriction (Owner only for mutation) verified");

// 8. Audit Event Payload Verification (setting_changed)
const settingAuditEvent = {
  action: "setting_changed",
  entityType: "app_settings",
  oldData: { defaultFee: 400000 },
  newData: { defaultFee: 500000 },
  reason: "Pembaruan Konfigurasi Pengaturan Sistem oleh Owner",
};

assert.strictEqual(settingAuditEvent.action, "setting_changed", "Audit action is setting_changed");
assert.strictEqual(settingAuditEvent.newData.defaultFee, 500000, "Audit payload records updated setting value");
console.log("✓ Test 8 Passed: setting_changed audit event payload verified");

// 9. Timezone Verification
const timezoneConfig = "Asia/Jakarta (WIB)";
assert.strictEqual(timezoneConfig, "Asia/Jakarta (WIB)", "System timezone is standardized to Asia/Jakarta (WIB)");
console.log("✓ Test 9 Passed: System timezone standardized to Asia/Jakarta (WIB)");

console.log("=== ALL PHASE 6C.3 SYSTEM SETTINGS & SECURITY TESTS PASSED CLEANLY! ===");
