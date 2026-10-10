import assert from "node:assert";
import {
  resolveOfficialTariff,
  buildInitialRegistrationFeeRows,
  TariffResolutionContext,
} from "../tariff-resolver";
import { CandidateFeeRate } from "@/types/registration";

console.log("=== Running Tariff Resolution Engine Unit Tests ===");

const PRODI_313_ID = "161538a3-7704-4b37-b468-e61a97a9387a"; // Administrasi Bisnis
const PRODI_312_ID = "eadc7687-878d-42ef-9d5c-3508062991f9"; // Administrasi Publik
const SCHEME_NON_SIPAS = "94744e75-5053-48d9-b14e-a1e4514e55e0";
const SCHEME_SIPAS_NON_TTM = "8c4800df-10ef-4f5a-af3a-07d4766f207a";
const PERIOD_20271 = "5474ad38-3143-4d8a-bee1-46e49cc15a3c";
const PERIOD_OTHER = "99999999-9999-9999-9999-999999999999";

const rateProdi313Specific: CandidateFeeRate = {
  id: "ade35c8e-4cb1-4b21-b32f-20994249e9c0",
  feeTypeId: "ft-non-sipas",
  feeTypeName: "Biaya Uang Kuliah Non-SIPAS (Per SKS)",
  feeTypeCode: "NON_SIPAS_PER_SKS",
  feeTypeCategory: "UT_OFFICIAL",
  studyProgramId: PRODI_313_ID,
  serviceSchemeId: null,
  academicPeriodId: null,
  isActive: true,
  verificationStatus: "VERIFIED",
  name: "Biaya Uang Kuliah Non-SIPAS (Ilmu Administrasi Bisnis)",
  calculationType: "PER_SKS",
  unitAmount: 36000,
  source: "Rincian Biaya Resmi UT 2026 Brosur Owner",
  isPerSks: true,
};

const rateGeneralGeneric: CandidateFeeRate = {
  id: "f396c5bc-41f0-4711-ab8d-9d224ae13fc1",
  feeTypeId: "ft-non-sipas",
  feeTypeName: "Biaya Uang Kuliah Non-SIPAS (Per SKS)",
  feeTypeCode: "NON_SIPAS_PER_SKS",
  feeTypeCategory: "UT_OFFICIAL",
  studyProgramId: null,
  serviceSchemeId: null,
  academicPeriodId: null,
  isActive: true,
  verificationStatus: "VERIFIED",
  name: "Biaya Uang Kuliah Non-SIPAS (Per SKS)",
  calculationType: "PER_SKS",
  unitAmount: 40000,
  source: "SK Rektor UT Pedoman 2026/2027",
  isPerSks: true,
};

const contextYahya: TariffResolutionContext = {
  studyProgramId: PRODI_313_ID,
  serviceSchemeId: SCHEME_NON_SIPAS,
  academicPeriodId: PERIOD_20271,
};

// Mock helper getValidFeeTypeId used by form
const mockGetValidFeeTypeId = (kw: string, candidateFeeTypeId?: string) => {
  if (candidateFeeTypeId) return candidateFeeTypeId;
  return `ft-${kw.toLowerCase()}`;
};

// Test 1: Specific prodi rate (Rp 36.000) beats generic rate (Rp 40.000) regardless of array ordering
const ratesOrderA = [rateGeneralGeneric, rateProdi313Specific];
const resA = resolveOfficialTariff(ratesOrderA, contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
  feeTypeKeyword: "PER_SKS",
});
assert.strictEqual(resA.success, true);
if (resA.success) {
  assert.strictEqual(resA.rate.id, rateProdi313Specific.id);
  assert.strictEqual(resA.rate.unitAmount, 36000);
}

const ratesOrderB = [rateProdi313Specific, rateGeneralGeneric];
const resB = resolveOfficialTariff(ratesOrderB, contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
  feeTypeKeyword: "PER_SKS",
});
assert.strictEqual(resB.success, true);
if (resB.success) {
  assert.strictEqual(resB.rate.id, rateProdi313Specific.id);
  assert.strictEqual(resB.rate.unitAmount, 36000);
}
console.log("✓ Test 1 Passed: Specific prodi rate (36k) beats generic rate (40k) regardless of array order");

// Test 2: BENTURAN PRIORITAS: Tarif khusus prodi tanpa periode vs Tarif umum khusus periode
// Sesuai aturan bisnis, tarif khusus prodi SELALU mengalahkan tarif umum.
const rateGeneralPeriodBound: CandidateFeeRate = {
  ...rateGeneralGeneric,
  id: "rate-general-period-20271",
  name: "Tarif Umum Non-SIPAS Khusus Periode 20271",
  academicPeriodId: PERIOD_20271, // terikat periode aktif
  unitAmount: 42000,
};
const resClash = resolveOfficialTariff(
  [rateGeneralPeriodBound, rateProdi313Specific],
  contextYahya,
  {
    category: "UT_OFFICIAL",
    calculationType: "PER_SKS",
    feeTypeKeyword: "PER_SKS",
  }
);
assert.strictEqual(resClash.success, true);
if (resClash.success) {
  assert.strictEqual(
    resClash.rate.id,
    rateProdi313Specific.id,
    "Tarif khusus prodi (36k) harus menang atas tarif umum meskipun tarif umum memiliki ikatan periode"
  );
  assert.strictEqual(resClash.rate.unitAmount, 36000);
}
console.log("✓ Test 2 Passed: Benturan tarif umum khusus periode vs khusus prodi dimenangkan oleh tarif khusus prodi");

// Test 3: Preview dan Payload kecocokan menggunakan FUNGSI PRODUKSI PEMBENTUK ITEM (buildInitialRegistrationFeeRows)
const initialRowsResult = buildInitialRegistrationFeeRows({
  rates: [rateProdi313Specific, rateGeneralGeneric],
  context: contextYahya,
  schemeCode: "NON_SIPAS",
  credits: 24,
  defaultSalutFee: 400000,
  getValidFeeTypeId: mockGetValidFeeTypeId,
});
assert.strictEqual(initialRowsResult.success, true);
if (initialRowsResult.success) {
  const rows = initialRowsResult.rows;
  // Item 1: SKS
  const sksRow = rows.find((r) => r.calculationType === "PER_SKS");
  assert(sksRow, "Harus terdapat baris PER_SKS");
  assert.strictEqual(sksRow.sourceFeeRateId, rateProdi313Specific.id);
  assert.strictEqual(sksRow.unitAmount, 36000);
  assert.strictEqual(sksRow.quantity, 24);
  assert.strictEqual(sksRow.totalAmount, 24 * 36000); // 864.000

  // Item SALUT: 400.000
  const salutRow = rows.find((r) => r.feeNameSnapshot.includes("SALUT"));
  assert(salutRow, "Harus terdapat baris SALUT");
  assert.strictEqual(salutRow.totalAmount, 400000);

  const grandTotal = rows.reduce((acc, r) => acc + r.totalAmount, 0);
  assert.strictEqual(grandTotal, 1264000);
}
console.log("✓ Test 3 Passed: Preview dan payload konsisten melalui buildInitialRegistrationFeeRows produksi (Rp 1.264.000)");

// Test 4: Incompatible context (different prodi, scheme, period) must be STRICTLY rejected
const contextOtherProdi: TariffResolutionContext = {
  studyProgramId: PRODI_312_ID,
  serviceSchemeId: SCHEME_NON_SIPAS,
  academicPeriodId: PERIOD_20271,
};
const resOther = resolveOfficialTariff([rateProdi313Specific, rateGeneralGeneric], contextOtherProdi, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
  feeTypeKeyword: "PER_SKS",
});
assert.strictEqual(resOther.success, true);
if (resOther.success) {
  assert.strictEqual(resOther.rate.id, rateGeneralGeneric.id);
  assert.strictEqual(resOther.rate.unitAmount, 40000);
}

// Terikat periode lain harus ditolak
const rateOtherPeriod: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-other-period",
  academicPeriodId: PERIOD_OTHER,
};
const resOtherPeriod = resolveOfficialTariff([rateOtherPeriod], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resOtherPeriod.success, false, "Tarif yang terikat periode lain wajib ditolak");

// Terikat skema lain harus ditolak
const rateOtherScheme: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-other-scheme",
  serviceSchemeId: SCHEME_SIPAS_NON_TTM,
};
const resOtherScheme = resolveOfficialTariff([rateOtherScheme], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resOtherScheme.success, false, "Tarif yang terikat skema lain wajib ditolak");
console.log("✓ Test 4 Passed: Penolakan ketat untuk tarif terikat prodi, skema, atau periode lain");

// Test 5: Rejection of non-UT_OFFICIAL category and calculation_type mismatch
const rateNonOfficial: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-salut-category",
  feeTypeCategory: "SALUT_INTERNAL",
};
const resCategoryMismatch = resolveOfficialTariff([rateNonOfficial], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resCategoryMismatch.success, false, "Tarif kategori selain UT_OFFICIAL wajib ditolak");

const rateWrongCalcType: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-fixed-calc",
  calculationType: "FIXED",
};
const resCalcMismatch = resolveOfficialTariff([rateWrongCalcType], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resCalcMismatch.success, false, "Calculation_type yang tidak sesuai jalur registrasi wajib ditolak");
console.log("✓ Test 5 Passed: Penolakan ketat untuk non-UT_OFFICIAL dan inkonsistensi calculation_type");

// Test 6: Rejection of inactive, unverified, or missing/null metadata (fail-closed)
const rateInactive: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-inactive",
  isActive: false,
};
const resInactive = resolveOfficialTariff([rateInactive], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resInactive.success, false, "Tarif isActive: false wajib ditolak");

const rateUnverified: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "rate-unverified",
  verificationStatus: "PENDING_VERIFICATION",
};
const resUnverified = resolveOfficialTariff([rateUnverified], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
});
assert.strictEqual(resUnverified.success, false, "Tarif verificationStatus != VERIFIED wajib ditolak");

// Test 6b: FAIL-CLOSED NULL / UNDEFINED METADATA TESTS
const rateNullActive = {
  ...rateProdi313Specific,
  id: "rate-null-active",
  isActive: null as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateNullActive], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif isActive: null wajib ditolak (fail-closed)"
);

const rateUndefinedActive = {
  ...rateProdi313Specific,
  id: "rate-undef-active",
  isActive: undefined as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateUndefinedActive], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif isActive: undefined wajib ditolak (fail-closed)"
);

const rateNullVerified = {
  ...rateProdi313Specific,
  id: "rate-null-verified",
  verificationStatus: null as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateNullVerified], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif verificationStatus: null wajib ditolak (fail-closed)"
);

const rateUndefinedVerified = {
  ...rateProdi313Specific,
  id: "rate-undef-verified",
  verificationStatus: undefined as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateUndefinedVerified], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif verificationStatus: undefined wajib ditolak (fail-closed)"
);

const rateNullCategory = {
  ...rateProdi313Specific,
  id: "rate-null-category",
  feeTypeCategory: null as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateNullCategory], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif feeTypeCategory: null wajib ditolak (fail-closed)"
);

const rateUndefinedCategory = {
  ...rateProdi313Specific,
  id: "rate-undef-category",
  feeTypeCategory: undefined as any,
};
assert.strictEqual(
  resolveOfficialTariff([rateUndefinedCategory], contextYahya, { calculationType: "PER_SKS" }).success,
  false,
  "Tarif feeTypeCategory: undefined wajib ditolak (fail-closed)"
);
console.log("✓ Test 6 Passed: Penolakan ketat untuk tarif tidak aktif, belum VERIFIED, atau metadata null/undefined");

// Test 7: Fail closed on missing rate & ambiguous candidates
const resMissing = resolveOfficialTariff([], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
  feeTypeKeyword: "PER_SKS",
});
assert.strictEqual(resMissing.success, false);

const rateConflictA: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "conflict-rate-aaa",
  name: "Tarif Konflik A",
  unitAmount: 36000,
};
const rateConflictB: CandidateFeeRate = {
  ...rateProdi313Specific,
  id: "conflict-rate-bbb",
  name: "Tarif Konflik B",
  unitAmount: 38000,
};
const resAmbiguous = resolveOfficialTariff([rateConflictA, rateConflictB], contextYahya, {
  category: "UT_OFFICIAL",
  calculationType: "PER_SKS",
  feeTypeKeyword: "PER_SKS",
});
assert.strictEqual(resAmbiguous.success, false);
assert(resAmbiguous.error.includes("ambigu"));
console.log("✓ Test 7 Passed: Missing rate & ambiguous candidates fail closed");

// Test 8: SIPAS Non-TTM package resolution operates properly
const rateSipasNonTtm: CandidateFeeRate = {
  id: "8d3702ff-6b0e-44fc-b759-513fff1a130f",
  feeTypeId: "ft-sipas-non-ttm",
  feeTypeName: "UKT 3 - SIPAS Non-TTM (Paket Semester)",
  feeTypeCode: "UKT_SIPAS_NON_TTM",
  feeTypeCategory: "UT_OFFICIAL",
  studyProgramId: null,
  serviceSchemeId: null,
  academicPeriodId: null,
  isActive: true,
  verificationStatus: "VERIFIED",
  name: "UKT 3 - SIPAS Non-TTM (Paket Semester)",
  calculationType: "FIXED",
  unitAmount: 1300000,
  source: "SK Rektor UT Pedoman 2026/2027",
  isPerSks: false,
};
const contextSipas: TariffResolutionContext = {
  studyProgramId: PRODI_313_ID,
  serviceSchemeId: SCHEME_SIPAS_NON_TTM,
  academicPeriodId: PERIOD_20271,
};
const resSipas = resolveOfficialTariff([rateSipasNonTtm, rateGeneralGeneric], contextSipas, {
  category: "UT_OFFICIAL",
  calculationType: "FIXED",
  feeTypeKeyword: "NON_TTM",
});
assert.strictEqual(resSipas.success, true);
if (resSipas.success) {
  assert.strictEqual(resSipas.rate.unitAmount, 1300000);
}
console.log("✓ Test 8 Passed: SIPAS Non-TTM package resolution operates properly");

console.log("=== ALL TARIFF RESOLUTION TESTS PASSED CLEANLY! ===");

