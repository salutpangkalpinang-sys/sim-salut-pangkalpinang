"use client";

import { useState } from "react";
import { Registration, RegistrationType } from "@/types/registration";
import { RegistrationTable } from "@/components/registrations/registration-table";
import { RegistrationFilter } from "@/components/registrations/registration-filter";
import { RegistrationForm } from "@/components/registrations/registration-form";
import { CancelRegistrationDialog } from "@/components/registrations/cancel-registration-dialog";
import { RoleCode } from "@/lib/auth/types";
import { Plus, FileCheck, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface RegistrationListContainerProps {
  initialRegistrations: Registration[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  userRole: RoleCode;
  options: {
    academicPeriods: { id: string; code: string; name: string }[];
    registrationTypes: RegistrationType[];
    studyPrograms: { id: string; code: string; name: string }[];
    serviceSchemes: { id: string; code: string; name: string }[];
    students: { id: string; nim: string | null; full_name: string; study_program_id: string | null; service_scheme_id: string | null }[];
    feeTypes?: { id: string; code: string; name: string }[];
    defaultSalutFee?: number;
  };
  initialStatusFilter?: string;
}

export function RegistrationListContainer({
  initialRegistrations,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  userRole,
  options,
  initialStatusFilter,
}: RegistrationListContainerProps) {
  const router = useRouter();

  // Filter States
  const [search, setSearch] = useState("");
  const [academicPeriodId, setAcademicPeriodId] = useState("");
  const [registrationTypeId, setRegistrationTypeId] = useState("");
  const [studyProgramId, setStudyProgramId] = useState("");
  const [serviceSchemeId, setServiceSchemeId] = useState("");
  const [status, setStatus] = useState(initialStatusFilter || "");
  const [page, setPage] = useState(initialPage);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [cancellingRegistration, setCancellingRegistration] = useState<Registration | null>(null);

  const canMutate = userRole === "owner" || userRole === "academic_admin";

  const handleResetFilters = () => {
    setSearch("");
    setAcademicPeriodId("");
    setRegistrationTypeId("");
    setStudyProgramId("");
    setServiceSchemeId("");
    setStatus("");
    setPage(1);
    router.refresh();
  };

  const filteredRegistrations = initialRegistrations.filter((reg) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = reg.registrationNumber.toLowerCase().includes(q);
      const nimMatch = reg.studentNim?.toLowerCase().includes(q) || false;
      const nameMatch = reg.studentName?.toLowerCase().includes(q) || false;
      if (!numMatch && !nimMatch && !nameMatch) return false;
    }

    if (academicPeriodId && reg.academicPeriodId !== academicPeriodId) return false;
    if (registrationTypeId && reg.registrationTypeId !== registrationTypeId) return false;
    if (studyProgramId && reg.studyProgramId !== studyProgramId) return false;
    if (serviceSchemeId && reg.serviceSchemeId !== serviceSchemeId) return false;
    if (status && reg.status !== status) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <span>Registrasi Semester & Snapshot Tarif</span>
          </h1>
          <p className="text-xs text-slate-500">
            Kelola pendaftaran semester mahasiswa dan snapshot nominal tarif master
          </p>
        </div>

        {canMutate && (
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (confirm("Reset seluruh data registrasi, LIP, invoice, pembayaran, & setoran UT untuk mahasiswa Dixit Mutama Winanda?")) {
                  const { resetStudentTestTransactionsAction } = await import("@/features/registrations/actions");
                  const res = await resetStudentTestTransactionsAction("Dixit");
                  if (res.error) {
                    alert(res.error);
                  } else {
                    alert(res.message);
                    router.refresh();
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-lg border border-amber-300 transition"
              title="Reset data transaksi uji coba a.n. Dixit"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Reset Uji Coba (Dixit)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-600/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Registrasi Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Component */}
      <RegistrationFilter
        search={search}
        onSearchChange={setSearch}
        academicPeriodId={academicPeriodId}
        onAcademicPeriodChange={setAcademicPeriodId}
        registrationTypeId={registrationTypeId}
        onRegistrationTypeChange={setRegistrationTypeId}
        studyProgramId={studyProgramId}
        onStudyProgramChange={setStudyProgramId}
        serviceSchemeId={serviceSchemeId}
        onServiceSchemeChange={setServiceSchemeId}
        status={status}
        onStatusChange={setStatus}
        onReset={handleResetFilters}
        options={options}
      />

      {/* Table Component */}
      <RegistrationTable
        registrations={filteredRegistrations}
        total={initialTotal}
        page={page}
        limit={initialLimit}
        totalPages={initialTotalPages}
        userRole={userRole}
        onPageChange={(newPage) => setPage(newPage)}
        onCancel={(reg) => setCancellingRegistration(reg)}
      />

      {/* Registration Form Modal */}
      {isFormOpen && (
        <RegistrationForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => router.refresh()}
          options={options}
        />
      )}

      {/* Cancel Registration Dialog */}
      {cancellingRegistration && (
        <CancelRegistrationDialog
          registration={cancellingRegistration}
          isOpen={Boolean(cancellingRegistration)}
          onClose={() => setCancellingRegistration(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
