import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/features/settings/queries";
import {
  Registration,
  RegistrationFeeSnapshot,
  RegistrationFilterParams,
  CandidateFeeRate,
  RegistrationType,
} from "@/types/registration";

export async function getRegistrationsList(params: RegistrationFilterParams = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("registrations")
    .select(
      `
      id,
      registration_number,
      student_id,
      academic_period_id,
      registration_type_id,
      study_program_id,
      service_scheme_id,
      credits,
      status,
      notes,
      cancelled_at,
      cancelled_by,
      cancellation_reason,
      created_at,
      updated_at,
      created_by,
      updated_by,
      students ( nim, full_name ),
      academic_periods ( code, name ),
      registration_types ( code, name ),
      study_programs ( code, name ),
      service_schemes ( code, name ),
      registration_fee_snapshots ( total_amount )
    `,
      { count: "exact" }
    );

  // Student Filter
  if (params.studentId) {
    query = query.eq("student_id", params.studentId);
  }

  // Filters
  if (params.academicPeriodId) {
    query = query.eq("academic_period_id", params.academicPeriodId);
  }
  if (params.registrationTypeId) {
    query = query.eq("registration_type_id", params.registrationTypeId);
  }
  if (params.studyProgramId) {
    query = query.eq("study_program_id", params.studyProgramId);
  }
  if (params.serviceSchemeId) {
    query = query.eq("service_scheme_id", params.serviceSchemeId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }

  // Search (registration_number, NIM, or Student Name)
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`registration_number.ilike.${s}`);
  }

  // Sorting
  const sortByMap: Record<string, string> = {
    createdAt: "created_at",
    registrationNumber: "registration_number",
  };
  const sortCol = sortByMap[params.sortBy || "createdAt"] || "created_at";
  const ascending = params.sortOrder === "asc";

  query = query.order(sortCol, { ascending }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching registrations:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: Registration[] = (data || []).map((item: any) => {
    // Calculate total estimate amount from snapshot lines
    const totalEstimateAmount = (item.registration_fee_snapshots || []).reduce(
      (acc: number, line: any) => acc + (Number(line.total_amount) || 0),
      0
    );

    return {
      id: item.id,
      registrationNumber: item.registration_number,
      studentId: item.student_id,
      academicPeriodId: item.academic_period_id,
      registrationTypeId: item.registration_type_id,
      studyProgramId: item.study_program_id,
      serviceSchemeId: item.service_scheme_id,
      credits: item.credits,
      status: item.status,
      notes: item.notes,
      cancelledAt: item.cancelled_at,
      cancelledBy: item.cancelled_by,
      cancellationReason: item.cancellation_reason,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      updatedBy: item.updated_by,
      studentNim: item.students?.nim,
      studentName: item.students?.full_name,
      academicPeriodName: item.academic_periods?.name,
      academicPeriodCode: item.academic_periods?.code,
      registrationTypeName: item.registration_types?.name,
      registrationTypeCode: item.registration_types?.code,
      studyProgramName: item.study_programs?.name,
      studyProgramCode: item.study_programs?.code,
      serviceSchemeName: item.service_schemes?.name,
      serviceSchemeCode: item.service_schemes?.code,
      totalEstimateAmount,
    };
  });

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: mappedData,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getRegistrationById(id: string): Promise<Registration | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("registrations")
    .select(
      `
      *,
      students ( nim, nik, full_name, whatsapp ),
      academic_periods ( code, name ),
      registration_types ( code, name ),
      study_programs ( code, name ),
      service_schemes ( code, name ),
      registration_fee_snapshots (
        id,
        registration_id,
        source_fee_rate_id,
        fee_type_id,
        fee_name_snapshot,
        calculation_type,
        quantity,
        unit_amount,
        total_amount,
        source_snapshot,
        notes,
        created_at,
        fee_types ( name, code, category )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  const item: any = data;

  const feeSnapshots: RegistrationFeeSnapshot[] = (item.registration_fee_snapshots || []).map(
    (line: any) => ({
      id: line.id,
      registrationId: line.registration_id,
      sourceFeeRateId: line.source_fee_rate_id,
      feeTypeId: line.fee_type_id,
      feeNameSnapshot: line.fee_name_snapshot,
      calculationType: line.calculation_type,
      quantity: line.quantity,
      unitAmount: Number(line.unit_amount),
      totalAmount: Number(line.total_amount),
      sourceSnapshot: line.source_snapshot,
      notes: line.notes,
      createdAt: line.created_at,
      feeTypeName: line.fee_types?.name,
      feeTypeCode: line.fee_types?.code,
      feeTypeCategory: line.fee_types?.category,
    })
  );

  const totalEstimateAmount = feeSnapshots.reduce((acc, line) => acc + line.totalAmount, 0);

  return {
    id: item.id,
    registrationNumber: item.registration_number,
    studentId: item.student_id,
    academicPeriodId: item.academic_period_id,
    registrationTypeId: item.registration_type_id,
    studyProgramId: item.study_program_id,
    serviceSchemeId: item.service_scheme_id,
    credits: item.credits,
    status: item.status,
    notes: item.notes,
    cancelledAt: item.cancelled_at,
    cancelledBy: item.cancelled_by,
    cancellationReason: item.cancellation_reason,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    studentNim: item.students?.nim,
    studentName: item.students?.full_name,
    academicPeriodName: item.academic_periods?.name,
    academicPeriodCode: item.academic_periods?.code,
    registrationTypeName: item.registration_types?.name,
    registrationTypeCode: item.registration_types?.code,
    studyProgramName: item.study_programs?.name,
    studyProgramCode: item.study_programs?.code,
    serviceSchemeName: item.service_schemes?.name,
    serviceSchemeCode: item.service_schemes?.code,
    totalEstimateAmount,
    feeSnapshots,
  };
}

export async function getStudentRegistrations(studentId: string): Promise<Registration[]> {
  const result = await getRegistrationsList({ studentId, limit: 50 });
  return result.data;
}

export async function getAvailableCandidateFeeRates(
  studyProgramId?: string,
  serviceSchemeId?: string,
  academicPeriodId?: string
): Promise<CandidateFeeRate[]> {
  const supabase = await createClient();

  let query = supabase
    .from("fee_rates")
    .select(
      `
      id,
      fee_type_id,
      name,
      calculation_type,
      unit_amount,
      source,
      verification_status,
      is_active,
      fee_types ( code, name, category, is_per_sks )
    `
    )
    .eq("is_active", true)
    .eq("verification_status", "VERIFIED");

  if (studyProgramId) {
    query = query.or(`study_program_id.eq.${studyProgramId},study_program_id.is.null`);
  }
  if (serviceSchemeId) {
    query = query.or(`service_scheme_id.eq.${serviceSchemeId},service_scheme_id.is.null`);
  }
  if (academicPeriodId) {
    query = query.or(`academic_period_id.eq.${academicPeriodId},academic_period_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Error fetching candidate fee rates:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    feeTypeId: item.fee_type_id,
    feeTypeName: item.fee_types?.name || item.name,
    feeTypeCode: item.fee_types?.code || "",
    feeTypeCategory: item.fee_types?.category || "UT_OFFICIAL",
    name: item.name,
    calculationType: item.calculation_type === "PER_SKS" ? "PER_SKS" : "FIXED",
    unitAmount: Number(item.unit_amount),
    source: item.source || "SK Resmi",
    isPerSks: item.fee_types?.is_per_sks || item.calculation_type === "PER_SKS",
  }));
}

export async function getRegistrationMasterOptions() {
  const supabase = await createClient();

  const [periodsRes, typesRes, programsRes, schemesRes, studentsRes, feeTypesRes, settings] = await Promise.all([
    supabase.from("academic_periods").select("id, code, name").order("code", { ascending: false }),
    supabase.from("registration_types").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("study_programs").select("id, code, name, faculty_id, study_level_id").eq("is_active", true).order("name"),
    supabase.from("service_schemes").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("students").select("id, nim, full_name, study_program_id, service_scheme_id").not("nim", "is", null).neq("nim", "").order("full_name"),
    supabase.from("fee_types").select("id, code, name").order("name"),
    getAppSettings(),
  ]);

  return {
    academicPeriods: (periodsRes.data || []) as { id: string; code: string; name: string }[],
    registrationTypes: (typesRes.data || []) as RegistrationType[],
    studyPrograms: (programsRes.data || []) as { id: string; code: string; name: string; faculty_id?: string; study_level_id?: string }[],
    serviceSchemes: (schemesRes.data || []) as { id: string; code: string; name: string }[],
    students: (studentsRes.data || []) as { id: string; nim: string | null; full_name: string; study_program_id: string | null; service_scheme_id: string | null }[],
    feeTypes: (feeTypesRes.data || []) as { id: string; code: string; name: string }[],
    defaultSalutFee: settings?.default_salut_fee ?? 400000,
  };
}
