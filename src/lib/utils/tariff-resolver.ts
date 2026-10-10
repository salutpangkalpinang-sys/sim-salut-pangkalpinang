import { CandidateFeeRate } from "@/types/registration";

export interface TariffResolutionContext {
  studyProgramId: string;
  serviceSchemeId: string;
  academicPeriodId: string;
  schemeCode?: string;
  schemeName?: string;
}

export type TariffResolutionResult =
  | { success: true; rate: CandidateFeeRate }
  | { success: false; error: string };

/**
 * Resolves the official fee rate from candidate master rates deterministically:
 * 1. Strict rejection of incompatible / inactive / unverified / non-UT_OFFICIAL / wrong calculation_type candidates.
 * 2. Candidates must be compatible with the selected context (matching the ID or null for general rate).
 * 3. Priority hierarchy:
 *    - Level A: Program-specific rate (studyProgramId matches selected program)
 *               Sub-priority: Period-bound (+2) > Scheme-bound (+1) > Universal (0)
 *    - Level B: General rate (studyProgramId is null)
 *               Sub-priority: Period-bound (+2) > Scheme-bound (+1) > Universal (0)
 *    Note: A program-specific rate ALWAYS beats a general rate, even if the general rate is period-bound!
 * 4. Fail-closed on ambiguity: if multiple candidates share the exact highest priority with different IDs, reject!
 */
export function resolveOfficialTariff(
  rates: CandidateFeeRate[],
  context: TariffResolutionContext,
  requirement: {
    category?: string; // Default: "UT_OFFICIAL"
    calculationType?: "FIXED" | "PER_SKS";
    feeTypeKeyword?: string; // e.g. "NON_SIPAS", "NON_TTM", "SEMI", "SALUT"
  }
): TariffResolutionResult {
  const { studyProgramId, serviceSchemeId, academicPeriodId } = context;
  const targetCategory = requirement.category || "UT_OFFICIAL";

  // 1. Strict contextual, status, category, and calculation_type compatibility filter
  const compatible = rates.filter((r) => {
    // A. Must be active (fail-closed: null, undefined, or false rejected)
    if (r.isActive !== true) return false;

    // B. Must be VERIFIED (fail-closed: null, undefined, or non-VERIFIED rejected)
    if (r.verificationStatus !== "VERIFIED") return false;

    // C. Must match requested feeTypeCategory exactly (fail-closed: null, undefined, or non-matching rejected)
    if (!r.feeTypeCategory || r.feeTypeCategory !== targetCategory) {
      return false;
    }

    // D. Must match calculationType strictly
    if (requirement.calculationType && r.calculationType !== requirement.calculationType) {
      return false;
    }

    // E. Must not belong to a different study program
    if (r.studyProgramId && r.studyProgramId !== studyProgramId) {
      return false;
    }

    // F. Must not belong to a different service scheme
    if (r.serviceSchemeId && r.serviceSchemeId !== serviceSchemeId) {
      return false;
    }

    // G. Must not belong to a different academic period
    if (r.academicPeriodId && r.academicPeriodId !== academicPeriodId) {
      return false;
    }

    // H. Optional keyword filter for fee name/code
    if (requirement.feeTypeKeyword) {
      const kw = requirement.feeTypeKeyword.toUpperCase();
      const code = (r.feeTypeCode || "").toUpperCase();
      const name = (r.name || "").toUpperCase();
      const typeName = (r.feeTypeName || "").toUpperCase();
      const matches = code.includes(kw) || name.includes(kw) || typeName.includes(kw);
      if (!matches) return false;
    }

    return true;
  });

  if (compatible.length === 0) {
    const desc = requirement.feeTypeKeyword || requirement.calculationType || "tarif";
    return {
      success: false,
      error: `Master tarif untuk komponen ${desc} tidak ditemukan pada program studi, skema, dan periode yang dipilih.`,
    };
  }

  // 2. Compute priority score based on explicit hierarchy:
  // Program-specific rate ALWAYS beats general rate.
  // Base score: Program-specific = 100, General = 0.
  // Sub-priority within each group:
  // - Period-specific match: +2
  // - Scheme-specific match: +1
  const scored = compatible.map((r) => {
    const isProgramSpecific = Boolean(r.studyProgramId && r.studyProgramId === studyProgramId);
    let score = isProgramSpecific ? 100 : 0;

    if (r.academicPeriodId && r.academicPeriodId === academicPeriodId) {
      score += 2;
    }
    if (r.serviceSchemeId && r.serviceSchemeId === serviceSchemeId) {
      score += 1;
    }

    return { rate: r, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const highestScore = scored[0].score;
  const topCandidates = scored.filter((s) => s.score === highestScore);

  // 3. Ambiguity check: fail-closed if multiple records share identical highest priority with different IDs
  if (topCandidates.length > 1) {
    const distinctIds = new Set(topCandidates.map((c) => c.rate.id));
    if (distinctIds.size > 1) {
      const names = topCandidates
        .map((c) => `"${c.rate.name}" (Rp ${c.rate.unitAmount.toLocaleString("id-ID")})`)
        .join(", ");
      return {
        success: false,
        error: `Ditemukan beberapa master tarif dengan tingkat prioritas yang sama: ${names}. Harap periksa konfigurasi master tarif agar tidak ambigu.`,
      };
    }
  }

  return { success: true, rate: topCandidates[0].rate };
}

export interface InitialFeeRowsParams {
  rates: CandidateFeeRate[];
  context: TariffResolutionContext;
  schemeCode: string;
  credits: number;
  defaultSalutFee?: number;
  getValidFeeTypeId: (keyword: string, candidateRateFeeTypeId?: string) => string;
}

export interface FeeSnapshotRow {
  sourceFeeRateId?: string;
  feeTypeId: string;
  feeNameSnapshot: string;
  calculationType: "FIXED" | "PER_SKS";
  quantity: number;
  unitAmount: number;
  totalAmount: number;
}

/**
 * Authoritative production logic to build initial fee snapshot rows for registration.
 * Used by both UI RegistrationForm and automated verification tests.
 */
export function buildInitialRegistrationFeeRows(
  params: InitialFeeRowsParams
): { success: true; rows: FeeSnapshotRow[] } | { success: false; error: string } {
  const { rates, context, schemeCode, credits, defaultSalutFee, getValidFeeTypeId } = params;
  const isNonSipas = schemeCode.includes("NON_SIPAS") || schemeCode.includes("NON-SIPAS");
  const isSemi = schemeCode.includes("SEMI");
  const isNonTtm = schemeCode.includes("NON_TTM") || schemeCode.includes("NON-TTM");

  const rows: FeeSnapshotRow[] = [];

  if (isNonSipas) {
    const perSksResolution = resolveOfficialTariff(rates, context, {
      category: "UT_OFFICIAL",
      calculationType: "PER_SKS",
      feeTypeKeyword: "PER_SKS",
    });

    if (!perSksResolution.success) {
      return { success: false, error: perSksResolution.error };
    }

    const perSksRate = perSksResolution.rate;
    const sksUnitPrice = perSksRate.unitAmount;

    if (credits > 0) {
      const sksQty = credits;
      rows.push({
        sourceFeeRateId: perSksRate.id,
        feeTypeId: getValidFeeTypeId("PER_SKS", perSksRate.feeTypeId),
        feeNameSnapshot: perSksRate.name || "Total Biaya Mata Kuliah (Per SKS)",
        calculationType: "PER_SKS",
        quantity: sksQty,
        unitAmount: sksUnitPrice,
        totalAmount: sksQty * sksUnitPrice,
      });
    }

    rows.push({
      feeTypeId: getValidFeeTypeId("NON_SIPAS", perSksRate.feeTypeId),
      feeNameSnapshot: "Total Biaya Buku / Bahan Ajar Cetak",
      calculationType: "FIXED",
      quantity: 1,
      unitAmount: 0,
      totalAmount: 0,
    });

    rows.push({
      feeTypeId: getValidFeeTypeId("NON_SIPAS", perSksRate.feeTypeId),
      feeNameSnapshot: "Biaya Pengiriman Bahan Ajar",
      calculationType: "FIXED",
      quantity: 1,
      unitAmount: 0,
      totalAmount: 0,
    });
  } else if (isSemi) {
    const semiResolution = resolveOfficialTariff(rates, context, {
      category: "UT_OFFICIAL",
      calculationType: "FIXED",
      feeTypeKeyword: "SEMI",
    });

    if (!semiResolution.success) {
      return { success: false, error: semiResolution.error };
    }

    const semiRate = semiResolution.rate;
    const unitPrice = semiRate.unitAmount;

    rows.push({
      sourceFeeRateId: semiRate.id,
      feeTypeId: getValidFeeTypeId("SEMI", semiRate.feeTypeId),
      feeNameSnapshot: semiRate.name || "Total Biaya Mata Kuliah (SIPAS Semi Paket)",
      calculationType: "FIXED",
      quantity: 1,
      unitAmount: unitPrice,
      totalAmount: unitPrice,
    });
  } else if (isNonTtm) {
    const nonTtmResolution = resolveOfficialTariff(rates, context, {
      category: "UT_OFFICIAL",
      calculationType: "FIXED",
      feeTypeKeyword: "NON_TTM",
    });

    if (!nonTtmResolution.success) {
      return { success: false, error: nonTtmResolution.error };
    }

    const nonTtmRate = nonTtmResolution.rate;
    const unitPrice = nonTtmRate.unitAmount;

    rows.push({
      sourceFeeRateId: nonTtmRate.id,
      feeTypeId: getValidFeeTypeId("NON_TTM", nonTtmRate.feeTypeId),
      feeNameSnapshot: nonTtmRate.name || "Total Biaya Mata Kuliah (SIPAS Non TTM Paket)",
      calculationType: "FIXED",
      quantity: 1,
      unitAmount: unitPrice,
      totalAmount: unitPrice,
    });

    rows.push({
      feeTypeId: getValidFeeTypeId("NON_TTM", nonTtmRate.feeTypeId),
      feeNameSnapshot: "Biaya Pengiriman Bahan Ajar",
      calculationType: "FIXED",
      quantity: 1,
      unitAmount: 0,
      totalAmount: 0,
    });
  }

  // Biaya Layanan & Pendampingan SALUT
  const salutAmount = defaultSalutFee ?? 400000;
  const salutRate = rates.find(
    (r) => (r.name || "").includes("SALUT") || (r.feeTypeCode || "").includes("SALUT")
  );
  rows.push({
    sourceFeeRateId: salutRate?.id,
    feeTypeId: getValidFeeTypeId("SALUT", salutRate?.feeTypeId),
    feeNameSnapshot: "Biaya Layanan & Pendampingan SALUT",
    calculationType: "FIXED",
    quantity: 1,
    unitAmount: salutAmount,
    totalAmount: salutAmount,
  });

  return { success: true, rows };
}

/**
 * Calculates official UT estimated obligation from registration fee snapshots strictly.
 * Requirements:
 * - Only counts snapshots with verified feeTypeCategory === 'UT_OFFICIAL'.
 * - Any internal fees (e.g. 'SALUT_INTERNAL', 'service_fee') are strictly excluded.
 * - If snapshots are missing or do not contain valid category metadata, returns null (tidak tersedia)
 *   rather than guessing from fee name or invoice/registration grand totals.
 */
export function computeRegistrationUtEstimate(
  snapshots?: Array<{
    totalAmount: number;
    feeTypeCategory?: string | null;
  }> | null
): number | null {
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  // Fail-safe: if any snapshot has missing, null, or empty feeTypeCategory,
  // we cannot determine full category coverage -> return null (tidak tersedia)
  // to prevent partial or misleading 0 estimates.
  const allHaveCategoryMetadata = snapshots.every(
    (s) => typeof s.feeTypeCategory === "string" && s.feeTypeCategory.trim() !== ""
  );

  if (!allHaveCategoryMetadata) {
    return null;
  }

  // Filter strictly by UT_OFFICIAL category
  const utOfficialSnapshots = snapshots.filter((s) => s.feeTypeCategory === "UT_OFFICIAL");

  return utOfficialSnapshots.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
}

