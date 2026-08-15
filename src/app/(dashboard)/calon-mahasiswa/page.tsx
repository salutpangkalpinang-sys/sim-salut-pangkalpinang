import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getStudentsList, getMasterOptions } from "@/features/students/queries";
import { StudentListContainer } from "@/components/students/student-list-container";
import { redirect } from "next/navigation";

export default async function CalonMahasiswaPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Fetch Calon Mahasiswa list (isCalon = true)
  const { data: students, total, page, limit, totalPages } = await getStudentsList({
    isCalon: true,
    page: 1,
    limit: 20,
  });

  const options = await getMasterOptions();

  return (
    <StudentListContainer
      initialStudents={students}
      initialTotal={total}
      initialPage={page}
      initialLimit={limit}
      initialTotalPages={totalPages}
      userRole={profile.role}
      options={options}
      isCalonView={true}
    />
  );
}
