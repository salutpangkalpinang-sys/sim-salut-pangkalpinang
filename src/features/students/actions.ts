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

  // Auto-resolve status: If NIM is provided, switch status from CALON to AKTIF
  let targetStatusId = data.statusId;
  const { data: statuses } = await supabase.from("student_statuses").select("id, code");
  const calonStatus = statuses?.find((s) => s.code === "CALON");
  const aktifStatus = statuses?.find((s) => s.code === "AKTIF");

  if (data.nim && data.nim.trim() !== "") {
    if (aktifStatus && (!targetStatusId || targetStatusId === calonStatus?.id)) {
      targetStatusId = aktifStatus.id;
    }
  } else {
    if (calonStatus && !targetStatusId) {
      targetStatusId = calonStatus.id;
    }
  }

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
      status_id: targetStatusId,
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

  // Auto-resolve status: If NIM is filled in, switch status from CALON to AKTIF
  let targetStatusId = data.statusId;
  const { data: statuses } = await supabase.from("student_statuses").select("id, code");
  const calonStatus = statuses?.find((s) => s.code === "CALON");
  const aktifStatus = statuses?.find((s) => s.code === "AKTIF");

  // Fetch current student to detect transition
  const { data: currentStudent } = await supabase
    .from("students")
    .select("nim, status_id, student_statuses ( code )")
    .eq("id", studentId)
    .single();

  const currentStatusCode = (currentStudent?.student_statuses as any)?.code || "CALON";
  const hadNoNim = !currentStudent?.nim || currentStudent.nim.trim() === "";
  const isSettingNewNim = Boolean(data.nim && data.nim.trim() !== "");
  const isInitialNimAssignment = hadNoNim && isSettingNewNim;

  // If a candidate (or student without NIM) is being assigned an official NIM for the first time,
  // enforce execution through the canonical atomic assign_official_nim RPC
  if (isInitialNimAssignment) {
    const { error: assignErr } = await supabase.rpc("assign_official_nim", {
      p_student_id: studentId,
      p_nim: data.nim!.trim(),
      p_effective_date: new Date().toISOString(),
      p_reason: "Penetapan NIM resmi melalui pembaruan data mahasiswa",
    });

    if (assignErr) {
      console.error("assign_official_nim via updateStudentAction failed:", assignErr);
      if (assignErr.message.includes("NIM_DUPLICATE")) {
        return { error: "NIM sudah digunakan oleh mahasiswa lain." };
      }
      return {
        error:
          assignErr.message.replace(/^[A-Z_]+:\s*/, "") ||
          "Gagal menetapkan NIM resmi mahasiswa secara atomik.",
      };
    }
  } else if (data.nim && data.nim.trim() !== "") {
    if (
      aktifStatus &&
      (targetStatusId === calonStatus?.id || currentStatusCode === "CALON")
    ) {
      targetStatusId = aktifStatus.id;
    }
  }

  // Construct update payload
  // When isInitialNimAssignment succeeded, nim and status_id were already mutated atomically
  // by assign_official_nim (with status history & audit log). Do not include them in the subsequent update
  // to avoid race conditions or overwriting with stale CALON status.
  const updatePayload: Record<string, any> = {
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
    internal_notes: data.internalNotes,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  };

  if (!isInitialNimAssignment) {
    updatePayload.nim = data.nim;
    updatePayload.status_id = targetStatusId;
  }

  const { error } = await supabase
    .from("students")
    .update(updatePayload)
    .eq("id", studentId);

  if (error) {
    console.error("Database error updating student:", error);
    // If NIM assignment succeeded via RPC but updating secondary profile fields failed:
    if (isInitialNimAssignment) {
      revalidatePath("/mahasiswa");
      revalidatePath("/calon-mahasiswa");
      revalidatePath(`/mahasiswa/${studentId}`);
      revalidatePath(`/calon-mahasiswa/${studentId}`);
      return {
        error: `NIM resmi berhasil ditetapkan dan status mahasiswa telah AKTIF, namun pembaruan profil pelengkap gagal: ${error.message}. Silakan periksa kembali data profil.`,
      };
    }
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

export async function deleteStudentAction(studentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || !hasPermission(profile.role, ["owner", "admin", "academic_admin"])) {
    return { error: "Anda tidak memiliki izin untuk menghapus data mahasiswa." };
  }

  const supabase = await createClient();

  // Execute canonical RPC delete_student_cascade
  const { data, error: rpcErr } = await supabase.rpc("delete_student_cascade", { p_student_id: studentId });

  if (rpcErr) {
    console.error("RPC delete_student_cascade failed:", rpcErr);
    return { error: "Gagal menghapus data mahasiswa: " + (rpcErr.message || "Terjadi kesalahan pada database.") };
  }

  if (data && typeof data === "object" && "success" in data && !data.success) {
    return { error: (data as { error?: string }).error || "Gagal menghapus data mahasiswa." };
  }

  revalidatePath("/mahasiswa");
  revalidatePath("/calon-mahasiswa");
  revalidatePath("/registrasi");
  return { success: true };
}
