import assert from "node:assert";
import { studentSchema, statusChangeSchema, normalizeWhatsApp } from "../student";
import { hasPermission } from "../../auth/types";

console.log("=== Running Student & Core 1 Validation Unit Tests ===");

// Test 1: Normalize WhatsApp Number
assert.strictEqual(normalizeWhatsApp("08123456789"), "628123456789");
assert.strictEqual(normalizeWhatsApp("+62 812-3456-789"), "628123456789");
assert.strictEqual(normalizeWhatsApp(""), null);
assert.strictEqual(normalizeWhatsApp(null), null);
console.log("✓ Test 1 Passed: WhatsApp Normalization");

// Test 2: Calon Mahasiswa without NIM and NIK (NULL allowed)
const calonInput = {
  fullName: "Budi Santoso",
  nim: "",
  nik: "",
  statusId: "11111111-1111-1111-1111-111111111111",
};
const calonResult = studentSchema.safeParse(calonInput);
assert.strictEqual(calonResult.success, true);
if (calonResult.success) {
  assert.strictEqual(calonResult.data.nim, null);
  assert.strictEqual(calonResult.data.nik, null);
  assert.strictEqual(calonResult.data.fullName, "Budi Santoso");
}
console.log("✓ Test 2 Passed: Calon Mahasiswa without NIM/NIK allowed");

// Test 3: Invalid NIK (less than 16 digits)
const invalidNikInput = {
  fullName: "Siti Rahma",
  nik: "12345", // Invalid length
  statusId: "11111111-1111-1111-1111-111111111111",
};
const invalidNikResult = studentSchema.safeParse(invalidNikInput);
assert.strictEqual(invalidNikResult.success, false);
console.log("✓ Test 3 Passed: Invalid NIK rejected");

// Test 4: Birth date in the future
const futureDateInput = {
  fullName: "Ahmad Dani",
  birthDate: "2099-01-01",
  statusId: "11111111-1111-1111-1111-111111111111",
};
const futureDateResult = studentSchema.safeParse(futureDateInput);
assert.strictEqual(futureDateResult.success, false);
console.log("✓ Test 4 Passed: Future birth date rejected");

// Test 5: Empty Full Name
const emptyNameInput = {
  fullName: "   ",
  statusId: "11111111-1111-1111-1111-111111111111",
};
const emptyNameResult = studentSchema.safeParse(emptyNameInput);
assert.strictEqual(emptyNameResult.success, false);
console.log("✓ Test 5 Passed: Empty full name rejected");

// Test 6: Status Change Schema Validation
const statusChangeInput = {
  studentId: "11111111-1111-1111-1111-111111111111",
  newStatusId: "22222222-2222-2222-2222-222222222222",
  reason: "Diterima sebagai mahasiswa aktif",
};
const statusChangeResult = statusChangeSchema.safeParse(statusChangeInput);
assert.strictEqual(statusChangeResult.success, true);
console.log("✓ Test 6 Passed: Status change validation");

// Test 7: RBAC - Viewer Mutation Denied
const viewerCanEdit = hasPermission("viewer", ["owner", "academic_admin"]);
assert.strictEqual(viewerCanEdit, false);
console.log("✓ Test 7 Passed: Viewer mutation denied");

// Test 8: RBAC - Finance Admin Student Edit Denied
const financeCanEditStudent = hasPermission("finance_admin", ["owner", "academic_admin"]);
assert.strictEqual(financeCanEditStudent, false);
console.log("✓ Test 8 Passed: Finance Admin student edit denied");

// Test 9: RBAC - Academic Admin & Owner Allowed
const academicCanEdit = hasPermission("academic_admin", ["owner", "academic_admin"]);
const ownerCanEdit = hasPermission("owner", ["owner", "academic_admin"]);
assert.strictEqual(academicCanEdit, true);
assert.strictEqual(ownerCanEdit, true);
// Test 10: NIM Boundary Validations (Kosong, 1-2 Karakter, 30 Karakter, 31 Karakter, Ilegal, Leading Zero)
// 10a. Leading Zero Dipertahankan
const nimLeadingZero = studentSchema.safeParse({
  fullName: "Ahmad Leading Zero",
  nim: "0487654321",
  statusId: "11111111-1111-1111-1111-111111111111",
});
assert.strictEqual(nimLeadingZero.success, true);
if (nimLeadingZero.success) {
  assert.strictEqual(nimLeadingZero.data.nim, "0487654321");
}

// 10b. NIM Pendek 1-2 Karakter Sah
const nimShort = studentSchema.safeParse({
  fullName: "Budi Short NIM",
  nim: "AB",
  statusId: "11111111-1111-1111-1111-111111111111",
});
assert.strictEqual(nimShort.success, true);
if (nimShort.success) {
  assert.strictEqual(nimShort.data.nim, "AB");
}

// 10c. NIM Tepat 30 Karakter Sah
const nimExact30 = studentSchema.safeParse({
  fullName: "Citra Exact 30",
  nim: "123456789012345678901234567890",
  statusId: "11111111-1111-1111-1111-111111111111",
});
assert.strictEqual(nimExact30.success, true);
if (nimExact30.success) {
  assert.strictEqual(nimExact30.data.nim, "123456789012345678901234567890");
}

// 10d. NIM 31 Karakter Ditolak
const nimTooLong31 = studentSchema.safeParse({
  fullName: "Dewi Too Long",
  nim: "1234567890123456789012345678901",
  statusId: "11111111-1111-1111-1111-111111111111",
});
assert.strictEqual(nimTooLong31.success, false);
if (!nimTooLong31.success) {
  assert.strictEqual(nimTooLong31.error.errors[0]?.message, "NIM maksimal 30 karakter");
}

// 10e. Karakter Ilegal Ditolak
const nimIllegal = studentSchema.safeParse({
  fullName: "Eko Illegal Char",
  nim: "04-8765-4321",
  statusId: "11111111-1111-1111-1111-111111111111",
});
assert.strictEqual(nimIllegal.success, false);
if (!nimIllegal.success) {
  assert.strictEqual(nimIllegal.error.errors[0]?.message, "NIM hanya boleh berisi huruf dan angka");
}
console.log("✓ Test 10 Passed: NIM Boundary Validations (Kosong, 1-2 char, 30 char, 31 char, Ilegal, Leading Zero)");

console.log("=== ALL STUDENT & CORE 1 VALIDATION TESTS PASSED CLEANLY! ===");
