"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, hasPermission } from "@/lib/auth/permissions";
import { studentSchema, statusChangeSchema, StudentFormInput, StatusChangeFormInput } from "@/lib/validation/student";
import { revalidatePath } from "next/cache";

export async function createStudentAction(input: StudentFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk menambah data mahasiswa." };
  }

  const validation = studentSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data masukan tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("students")
    .insert({
      nim: data.nim,
      nik: data.nik,
      full_name: data.fullName,
      birth_place: data.birthPlace,
      birth_date: data.birthDate,
      gender: data.gender,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      entry_year: data.entryYear,
      faculty_id: data.facultyId,
      study_level_id: data.studyLevelId,
      study_program_id: data.studyProgramId,
      service_scheme_id: data.serviceSchemeId,
      status_id: data.statusId,
      internal_notes: data.internalNotes,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Database error inserting student:", error);
    if (error.code === "23505") {
      if (error.message.includes("nim")) {
        return { error: "NIM sudah digunakan oleh mahasiswa lain." };
      }
      if (error.message.includes("nik")) {
        return { error: "NIK sudah digunakan oleh mahasiswa lain." };
      }
    }
    return { error: "Gagal menyimpan data mahasiswa: " + error.message };
  }

  revalidatePath("/mahasiswa");
  revalidatePath("/calon-mahasiswa");

  return { success: true, studentId: inserted.id };
}

export async function updateStudentAction(studentId: string, input: StudentFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengubah data mahasiswa." };
  }

  const validation = studentSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data masukan tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({
      nim: data.nim,
      nik: data.nik,
      full_name: data.fullName,
      birth_place: data.birthPlace,
      birth_date: data.birthDate,
      gender: data.gender,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      entry_year: data.entryYear,
      faculty_id: data.facultyId,
      study_level_id: data.studyLevelId,
      study_program_id: data.studyProgramId,
      service_scheme_id: data.serviceSchemeId,
      status_id: data.statusId,
      internal_notes: data.internalNotes,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  if (error) {
    console.error("Database error updating student:", error);
    if (error.code === "23505") {
      if (error.message.includes("nim")) {
        return { error: "NIM sudah digunakan oleh mahasiswa lain." };
      }
      if (error.message.includes("nik")) {
        return { error: "NIK sudah digunakan oleh mahasiswa lain." };
      }
    }
    return { error: "Gagal memperbarui data mahasiswa: " + error.message };
  }

  revalidatePath("/mahasiswa");
  revalidatePath("/calon-mahasiswa");
  revalidatePath(`/mahasiswa/${studentId}`);
  revalidatePath(`/calon-mahasiswa/${studentId}`);

  return { success: true };
}

export async function changeStudentStatusAction(input: StatusChangeFormInput) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk mengubah status mahasiswa." };
  }

  const validation = statusChangeSchema.safeParse(input);

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Data perubahan status tidak valid.",
    };
  }

  const data = validation.data;
  const supabase = await createClient();

  // Call atomic PostgreSQL stored procedure `change_student_status`
  const { error } = await supabase.rpc("change_student_status", {
    p_student_id: data.studentId,
    p_new_status_id: data.newStatusId,
    p_effective_at: data.effectiveAt || new Date().toISOString(),
    p_reason: data.reason,
    p_changed_by: profile.id,
  });

  if (error) {
    console.error("Database error changing student status:", error);
    return { error: "Gagal mengubah status mahasiswa: " + error.message };
  }

  revalidatePath("/mahasiswa");
  revalidatePath("/calon-mahasiswa");
  revalidatePath(`/mahasiswa/${data.studentId}`);
  revalidatePath(`/calon-mahasiswa/${data.studentId}`);

  return { success: true };
}
