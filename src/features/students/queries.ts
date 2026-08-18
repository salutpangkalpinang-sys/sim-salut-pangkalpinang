import { createClient } from "@/lib/supabase/server";
import { Student, StudentFilterParams, StudentStatusHistory, MasterOption } from "@/types/student";

export async function getStudentsList(params: StudentFilterParams = {}) {
  const supabase = await createClient();

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("students")
    .select(
      `
      id,
      nim,
      nik,
      full_name,
      birth_place,
      birth_date,
      gender,
      whatsapp,
      email,
      address,
      city,
      entry_year,
      faculty_id,
      study_level_id,
      study_program_id,
      service_scheme_id,
      status_id,
      status_effective_at,
      internal_notes,
      created_at,
      updated_at,
      created_by,
      updated_by,
      faculties ( code, name ),
      study_levels ( code, name ),
      study_programs ( code, name ),
      service_schemes ( code, name ),
      student_statuses ( code, name )
    `,
      { count: "exact" }
    );

  // Calon Mahasiswa Filter (NIM IS NULL OR status = CALON)
  if (params.isCalon) {
    query = query.is("nim", null);
  } else if (params.isCalon === false) {
    query = query.not("nim", "is", null);
  }

  // Multi-field Search (full_name, nim, nik, whatsapp)
  if (params.search && params.search.trim() !== "") {
    const s = `%${params.search.trim()}%`;
    query = query.or(`full_name.ilike.${s},nim.ilike.${s},nik.ilike.${s},whatsapp.ilike.${s}`);
  }

  // Master Filters
  if (params.facultyId) {
    query = query.eq("faculty_id", params.facultyId);
  }
  if (params.studyProgramId) {
    query = query.eq("study_program_id", params.studyProgramId);
  }
  if (params.entryYear) {
    query = query.eq("entry_year", params.entryYear);
  }
  if (params.serviceSchemeId) {
    query = query.eq("service_scheme_id", params.serviceSchemeId);
  }
  if (params.statusId) {
    query = query.eq("status_id", params.statusId);
  }

  // Sorting
  const sortByMap: Record<string, string> = {
    fullName: "full_name",
    nim: "nim",
    entryYear: "entry_year",
    createdAt: "created_at",
  };
  const sortCol = sortByMap[params.sortBy || "createdAt"] || "created_at";
  const ascending = params.sortOrder === "asc";

  query = query.order(sortCol, { ascending, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.warn("Error fetching students:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  const mappedData: Student[] = (data || []).map((item: any) => ({
    id: item.id,
    nim: item.nim,
    nik: item.nik,
    fullName: item.full_name,
    birthPlace: item.birth_place,
    birthDate: item.birth_date,
    gender: item.gender,
    whatsapp: item.whatsapp,
    email: item.email,
    address: item.address,
    city: item.city,
    entryYear: item.entry_year,
    facultyId: item.faculty_id,
    studyLevelId: item.study_level_id,
    studyProgramId: item.study_program_id,
    serviceSchemeId: item.service_scheme_id,
    statusId: item.status_id,
    statusEffectiveAt: item.status_effective_at,
    internalNotes: item.internal_notes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    facultyName: item.faculties?.name,
    facultyCode: item.faculties?.code,
    studyLevelName: item.study_levels?.name,
    studyLevelCode: item.study_levels?.code,
    studyProgramName: item.study_programs?.name,
    studyProgramCode: item.study_programs?.code,
    serviceSchemeName: item.service_schemes?.name,
    serviceSchemeCode: item.service_schemes?.code,
    statusName: item.student_statuses?.name,
    statusCode: item.student_statuses?.code,
  }));

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

export async function getStudentById(id: string): Promise<Student | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(
      `
      *,
      faculties ( code, name ),
      study_levels ( code, name ),
      study_programs ( code, name ),
      service_schemes ( code, name ),
      student_statuses ( code, name )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  const item: any = data;
  return {
    id: item.id,
    nim: item.nim,
    nik: item.nik,
    fullName: item.full_name,
    birthPlace: item.birth_place,
    birthDate: item.birth_date,
    gender: item.gender,
    whatsapp: item.whatsapp,
    email: item.email,
    address: item.address,
    city: item.city,
    entryYear: item.entry_year,
    facultyId: item.faculty_id,
    studyLevelId: item.study_level_id,
    studyProgramId: item.study_program_id,
    serviceSchemeId: item.service_scheme_id,
    statusId: item.status_id,
    statusEffectiveAt: item.status_effective_at,
    internalNotes: item.internal_notes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    facultyName: item.faculties?.name,
    facultyCode: item.faculties?.code,
    studyLevelName: item.study_levels?.name,
    studyLevelCode: item.study_levels?.code,
    studyProgramName: item.study_programs?.name,
    studyProgramCode: item.study_programs?.code,
    serviceSchemeName: item.service_schemes?.name,
    serviceSchemeCode: item.service_schemes?.code,
    statusName: item.student_statuses?.name,
    statusCode: item.student_statuses?.code,
  };
}

export async function getStudentStatusHistory(studentId: string): Promise<StudentStatusHistory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("student_status_history")
    .select(
      `
      id,
      student_id,
      previous_status_id,
      new_status_id,
      effective_at,
      reason,
      changed_by,
      created_at,
      prev:student_statuses!previous_status_id ( name ),
      next:student_statuses!new_status_id ( name ),
      profiles:changed_by ( full_name )
    `
    )
    .eq("student_id", studentId)
    .order("effective_at", { ascending: false });

  if (error) {
    console.warn("Error fetching status history:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    studentId: item.student_id,
    previousStatusId: item.previous_status_id,
    newStatusId: item.new_status_id,
    effectiveAt: item.effective_at,
    reason: item.reason,
    changedBy: item.changed_by,
    createdAt: item.created_at,
    previousStatusName: item.prev?.name || "-",
    newStatusName: item.next?.name || "-",
    changedByName: item.profiles?.full_name || "Sistem",
  }));
}

export async function getMasterOptions() {
  const supabase = await createClient();

  const [facultiesRes, levelsRes, programsRes, schemesRes, statusesRes, activePeriodRes] = await Promise.all([
    supabase.from("faculties").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("study_levels").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("study_programs").select("id, code, name, faculty_id, study_level_id").eq("is_active", true).order("name"),
    supabase.from("service_schemes").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("student_statuses").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("academic_periods").select("id, code, name").eq("is_active", true).single(),
  ]);

  return {
    faculties: (facultiesRes.data || []) as MasterOption[],
    studyLevels: (levelsRes.data || []) as MasterOption[],
    studyPrograms: (programsRes.data || []) as (MasterOption & { faculty_id?: string; study_level_id?: string })[],
    serviceSchemes: (schemesRes.data || []) as MasterOption[],
    statuses: (statusesRes.data || []) as MasterOption[],
    activeAcademicPeriod: activePeriodRes.data as MasterOption | null,
  };
}
