import { createClient } from "@/lib/supabase/server";

export interface MasterAcademicPeriod {
  id: string;
  code: string;
  name: string;
  term: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface MasterFaculty {
  id: string;
  code: string;
  name: string;
}

export interface MasterStudyLevel {
  id: string;
  code: string;
  name: string;
}

export interface MasterStudyProgram {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  facultyName?: string;
  studyLevelId: string;
  studyLevelName?: string;
}

export interface MasterServiceScheme {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
}

export interface MasterStudentStatus {
  id: string;
  code: string;
  name: string;
}

export interface MasterFeeRate {
  id: string;
  feeTypeId: string;
  feeTypeName?: string;
  feeTypeCategory?: string;
  studyProgramId: string | null;
  studyProgramName?: string;
  serviceSchemeId: string | null;
  serviceSchemeName?: string;
  calculationType: string;
  amount: number;
  isActive: boolean;
}

export interface MasterCashAccount {
  id: string;
  code: string;
  name: string;
  accountNumber: string | null;
  bankName: string | null;
  isActive: boolean;
  createdAt?: string;
}

export async function getAllMasterData() {
  const supabase = await createClient();

  const [
    { data: periods },
    { data: faculties },
    { data: levels },
    { data: programs },
    { data: schemes },
    { data: statuses },
    { data: feeRates },
    { data: cashAccounts },
  ] = await Promise.all([
    supabase.from("academic_periods").select("*").order("code", { ascending: false }),
    supabase.from("faculties").select("*").order("code", { ascending: true }),
    supabase.from("study_levels").select("*").order("code", { ascending: true }),
    supabase.from("study_programs").select("*, faculties(name), study_levels(name)").order("code", { ascending: true }),
    supabase.from("service_schemes").select("*").order("code", { ascending: true }),
    supabase.from("student_statuses").select("*").order("code", { ascending: true }),
    supabase.from("fee_rates").select("*, fee_types(name, category), study_programs(name), service_schemes(name)").order("created_at", { ascending: false }),
    supabase.from("cash_accounts").select("*").order("code", { ascending: true }),
  ]);

  const formattedPrograms: MasterStudyProgram[] = (programs || []).map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    facultyId: p.faculty_id,
    facultyName: p.faculties?.name,
    studyLevelId: p.study_level_id,
    studyLevelName: p.study_levels?.name,
  }));

  const formattedFeeRates: MasterFeeRate[] = (feeRates || []).map((f: any) => ({
    id: f.id,
    feeTypeId: f.fee_type_id,
    feeTypeName: f.fee_types?.name,
    feeTypeCategory: f.fee_types?.category,
    studyProgramId: f.study_program_id,
    studyProgramName: f.study_programs?.name,
    serviceSchemeId: f.service_scheme_id,
    serviceSchemeName: f.service_schemes?.name,
    calculationType: f.calculation_type,
    amount: Number(f.amount || 0),
    isActive: f.is_active ?? true,
  }));

  const formattedCashAccounts: MasterCashAccount[] = (cashAccounts || []).map((c: any) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    accountNumber: c.account_number || null,
    bankName: c.bank_name || null,
    isActive: c.is_active ?? true,
    createdAt: c.created_at,
  }));

  return {
    academicPeriods: (periods || []).map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      term: p.term,
      isActive: p.is_active,
      createdAt: p.created_at,
    })) as MasterAcademicPeriod[],
    faculties: (faculties || []).map((f: any) => ({
      id: f.id,
      code: f.code,
      name: f.name,
    })) as MasterFaculty[],
    studyLevels: (levels || []).map((l: any) => ({
      id: l.id,
      code: l.code,
      name: l.name,
    })) as MasterStudyLevel[],
    studyPrograms: formattedPrograms,
    serviceSchemes: (schemes || []).map((s: any) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      description: s.description,
    })) as MasterServiceScheme[],
    studentStatuses: (statuses || []).map((st: any) => ({
      id: st.id,
      code: st.code,
      name: st.name,
    })) as MasterStudentStatus[],
    feeRates: formattedFeeRates,
    cashAccounts: formattedCashAccounts,
  };
}
