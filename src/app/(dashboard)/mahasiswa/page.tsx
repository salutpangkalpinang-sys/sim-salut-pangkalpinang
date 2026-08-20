import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getStudentsList, getMasterOptions } from "@/features/students/queries";
import { StudentListContainer } from "@/components/students/student-list-container";
import { redirect } from "next/navigation";

export default async function MahasiswaPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Fetch registered Mahasiswa list (isCalon = false)
  const { data: students, total, page, limit, totalPages } = await getStudentsList({
    isCalon: false,
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
      isCalonView={false}
    />
  );
}
