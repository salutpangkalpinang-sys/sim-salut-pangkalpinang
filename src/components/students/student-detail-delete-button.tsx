"use client";

import { useState } from "react";
import { Student } from "@/types/student";
import { DeleteStudentDialog } from "@/components/students/delete-student-dialog";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface StudentDetailDeleteButtonProps {
  student: Student;
  canDelete: boolean;
}

export function StudentDetailDeleteButton({
  student,
  canDelete,
}: StudentDetailDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  if (!canDelete) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition shadow-xs"
        title="Hapus Mahasiswa"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-600" />
        <span>Hapus Mahasiswa</span>
      </button>

      {isOpen && (
        <DeleteStudentDialog
          student={student}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSuccess={() => {
            router.push("/mahasiswa");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
