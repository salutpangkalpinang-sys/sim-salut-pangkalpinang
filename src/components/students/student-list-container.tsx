"use client";

import { useState } from "react";
import { Student, MasterOption } from "@/types/student";
import { StudentTable } from "@/components/students/student-table";
import { StudentFilter } from "@/components/students/student-filter";
import { StudentForm } from "@/components/students/student-form";
import { StatusChangeDialog } from "@/components/students/status-change-dialog";
import { RoleCode } from "@/lib/auth/types";
import { UserPlus, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";
import { ImportModal } from "@/components/students/import-modal";

interface StudentListContainerProps {
  initialStudents: Student[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  userRole: RoleCode;
  options: {
    faculties: MasterOption[];
    studyLevels: MasterOption[];
    studyPrograms: (MasterOption & { faculty_id?: string; study_level_id?: string })[];
    serviceSchemes: MasterOption[];
    statuses: MasterOption[];
  };
  isCalonView?: boolean;
}

export function StudentListContainer({
  initialStudents,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  userRole,
  options,
  isCalonView = false,
}: StudentListContainerProps) {
  const router = useRouter();

  // Filters State
  const [search, setSearch] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [entryYear, setEntryYear] = useState("");
  const [serviceSchemeId, setServiceSchemeId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [page, setPage] = useState(initialPage);

  // Modal Dialogs State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [statusStudent, setStatusStudent] = useState<Student | null>(null);

  const canMutate = userRole === "owner" || userRole === "academic_admin";

  const handleResetFilters = () => {
    setSearch("");
    setFacultyId("");
    setStudyProgramId("");
    setEntryYear("");
    setServiceSchemeId("");
    setStatusId("");
    setSortBy("createdAt");
    setPage(1);
    router.refresh();
  };

  const handleCreate = () => {
    setEditingStudent(null);
    setIsFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleChangeStatus = (student: Student) => {
    setStatusStudent(student);
  };

  // Perform client-side filtering on loaded set if needed or trigger router refresh
  // For standard SSR pagination, filters can update URL query params or trigger router.refresh()
  const filteredStudents = initialStudents.filter((student) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = student.fullName.toLowerCase().includes(q);
      const nimMatch = student.nim?.toLowerCase().includes(q) || false;
      const nikMatch = student.nik?.toLowerCase().includes(q) || false;
      const waMatch = student.whatsapp?.toLowerCase().includes(q) || false;
      if (!nameMatch && !nimMatch && !nikMatch && !waMatch) return false;
    }

    if (facultyId && student.facultyId !== facultyId) return false;
    if (studyProgramId && student.studyProgramId !== studyProgramId) return false;
    if (entryYear && student.entryYear !== parseInt(entryYear, 10)) return false;
    if (serviceSchemeId && student.serviceSchemeId !== serviceSchemeId) return false;
    if (statusId && student.statusId !== statusId) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isCalonView ? "Database Calon Mahasiswa" : "Database Mahasiswa"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isCalonView
              ? "Kelola pendaftaran calon mahasiswa baru Sentra Layanan UT Pangkalpinang"
              : "Kelola data induk mahasiswa aktif, status akademik, dan filter pencarian cepat"}
          </p>
        </div>

        {canMutate && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Import Excel/CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-600/25 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCalonView ? "Tambah Calon Mahasiswa" : "Tambah Mahasiswa"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Component */}
      <StudentFilter
        search={search}
        onSearchChange={setSearch}
        facultyId={facultyId}
        onFacultyChange={setFacultyId}
        studyProgramId={studyProgramId}
        onStudyProgramChange={setStudyProgramId}
        entryYear={entryYear}
        onEntryYearChange={setEntryYear}
        serviceSchemeId={serviceSchemeId}
        onServiceSchemeChange={setServiceSchemeId}
        statusId={statusId}
        onStatusChange={setStatusId}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        onReset={handleResetFilters}
        options={options}
        isCalonView={isCalonView}
      />

      {/* Student Table */}
      <StudentTable
        students={filteredStudents}
        total={initialTotal}
        page={page}
        limit={initialLimit}
        totalPages={initialTotalPages}
        userRole={userRole}
        onPageChange={(newPage) => setPage(newPage)}
        onEdit={handleEdit}
        onChangeStatus={handleChangeStatus}
        isCalonView={isCalonView}
      />

      {/* Form Modal */}
      {isFormOpen && (
        <StudentForm
          initialData={editingStudent}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => router.refresh()}
          options={options}
          isCalonMode={isCalonView}
        />
      )}

      {/* Status Change Dialog */}
      {statusStudent && (
        <StatusChangeDialog
          student={statusStudent}
          isOpen={Boolean(statusStudent)}
          onClose={() => setStatusStudent(null)}
          onSuccess={() => router.refresh()}
          statuses={options.statuses}
        />
      )}

      {/* Mass Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultMode={isCalonView ? "calon" : "mahasiswa"}
      />
    </div>
  );
}
