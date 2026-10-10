import { createClient } from "@/lib/supabase/server";
import {
  NimSubmission,
  RegistrationInvoiceOption,
  CandidateNimEligibilitySummary,
} from "@/types/nim-submission";

export async function getCandidateNimEligibilitySummary(
  studentId: string,
  selectedInvoiceId?: string
): Promise<CandidateNimEligibilitySummary> {
  const supabase = await createClient();

  try {
    // 1. Fetch student info
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("id, nim, student_statuses ( code, name )")
      .eq("id", studentId)
      .single();

    if (studentErr || !student) {
      return {
        studentId,
        studentNim: null,
        studentStatus: "UNKNOWN",
        hasActiveNIM: false,
        activeSubmission: null,
        latestCompletedSubmission: null,
        registrationOptions: [],
        selectedOption: null,
        queryError: studentErr?.message || "Data calon mahasiswa tidak ditemukan.",
      };
    }

    const studentNim = student.nim && student.nim.trim() !== "" ? student.nim.trim() : null;
    const statusData: any = student.student_statuses;
    const studentStatus = statusData?.code || "CALON";
    const hasActiveNIM = !!studentNim;

    // 2. Fetch submissions for this student
    const { data: submissions, error: subErr } = await supabase
      .from("nim_submissions")
      .select(`
        id,
        student_id,
        registration_id,
        invoice_id,
        status,
        submission_date,
        reference_number,
        notes,
        submitted_by,
        created_at,
        updated_at,
        profiles!submitted_by ( full_name )
      `)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (subErr) {
      return {
        studentId,
        studentNim,
        studentStatus,
        hasActiveNIM,
        activeSubmission: null,
        latestCompletedSubmission: null,
        registrationOptions: [],
        selectedOption: null,
        queryError: "Gagal memuat data riwayat pengajuan NIM: " + subErr.message,
      };
    }

    const mappedSubmissions: NimSubmission[] = (submissions || []).map((s: any) => ({
      id: s.id,
      studentId: s.student_id,
      registrationId: s.registration_id,
      invoiceId: s.invoice_id,
      status: s.status,
      submissionDate: s.submission_date,
      referenceNumber: s.reference_number,
      notes: s.notes,
      submittedBy: s.submitted_by,
      submittedByName: s.profiles?.full_name || undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    const activeSubmission = mappedSubmissions.find((s) => s.status === "submitted") || null;
    const latestCompletedSubmission =
      mappedSubmissions.find((s) => s.status === "completed") || null;

    // 3. Fetch candidate's registrations with their active invoice and items
    const { data: registrations, error: regErr } = await supabase
      .from("registrations")
      .select(`
        id,
        registration_number,
        status,
        academic_periods ( name ),
        study_programs ( name ),
        invoices (
          id,
          invoice_number,
          status,
          invoice_items (
            id,
            item_type,
            amount
          )
        )
      `)
      .eq("student_id", studentId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (regErr) {
      return {
        studentId,
        studentNim,
        studentStatus,
        hasActiveNIM,
        activeSubmission,
        latestCompletedSubmission,
        registrationOptions: [],
        selectedOption: null,
        queryError: "Gagal memuat registrasi dan invoice calon mahasiswa: " + regErr.message,
      };
    }

    // Collect all invoice IDs
    const invoiceIds: string[] = [];
    (registrations || []).forEach((reg: any) => {
      const invList: any[] = reg.invoices || [];
      invList.forEach((inv) => {
        if (inv.status !== "cancelled") {
          invoiceIds.push(inv.id);
        }
      });
    });

    // 4. Fetch PCA service_fee posted entries for these invoices
    let pcaRecords: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: pcas, error: pcaErr } = await supabase
        .from("payment_component_allocations")
        .select("id, invoice_id, component_type, entry_type, amount, status")
        .in("invoice_id", invoiceIds)
        .eq("component_type", "service_fee")
        .eq("status", "posted");

      if (pcaErr) {
        return {
          studentId,
          studentNim,
          studentStatus,
          hasActiveNIM,
          activeSubmission,
          latestCompletedSubmission,
          registrationOptions: [],
          selectedOption: null,
          queryError: "Gagal memuat alokasi pembayaran komisi SALUT: " + pcaErr.message,
        };
      }
      pcaRecords = pcas || [];
    }

    // 5. Build RegistrationInvoiceOption array
    const registrationOptions: RegistrationInvoiceOption[] = [];

    (registrations || []).forEach((reg: any) => {
      const invList: any[] = reg.invoices || [];
      const activeInvoices = invList.filter((inv) => inv.status !== "cancelled");

      activeInvoices.forEach((inv: any) => {
        const items: any[] = inv.invoice_items || [];
        const requiredSalutFee = items
          .filter((item) => item.item_type === "service_fee")
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const invPcas = pcaRecords.filter((p) => p.invoice_id === inv.id);
        let netSalutPaid = 0;
        let hasReversal = false;

        invPcas.forEach((p) => {
          const amt = Number(p.amount || 0);
          if (p.entry_type === "allocation") {
            netSalutPaid += amt;
          } else if (p.entry_type === "reversal") {
            netSalutPaid -= amt;
            hasReversal = true;
          }
        });

        const isEligible = requiredSalutFee > 0 && netSalutPaid >= requiredSalutFee;

        registrationOptions.push({
          registrationId: reg.id,
          registrationNumber: reg.registration_number,
          academicPeriodName: reg.academic_periods?.name || undefined,
          studyProgramName: reg.study_programs?.name || undefined,
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceStatus: inv.status,
          requiredSalutFee,
          netSalutPaid,
          hasReversal,
          isEligible,
        });
      });
    });

    // 6. Resolve selectedOption
    let selectedOption: RegistrationInvoiceOption | null = null;
    if (selectedInvoiceId) {
      selectedOption =
        registrationOptions.find((opt) => opt.invoiceId === selectedInvoiceId) || null;
    }

    if (!selectedOption) {
      // If student has an active submission, lock on the submitted invoice
      if (activeSubmission) {
        selectedOption =
          registrationOptions.find((opt) => opt.invoiceId === activeSubmission.invoiceId) || null;
      }
    }

    if (!selectedOption && registrationOptions.length > 0) {
      // Default to first eligible option, or simply first option
      selectedOption =
        registrationOptions.find((opt) => opt.isEligible) || registrationOptions[0];
    }

    return {
      studentId,
      studentNim,
      studentStatus,
      hasActiveNIM,
      activeSubmission,
      latestCompletedSubmission,
      registrationOptions,
      selectedOption,
    };
  } catch (err: any) {
    return {
      studentId,
      studentNim: null,
      studentStatus: "UNKNOWN",
      hasActiveNIM: false,
      activeSubmission: null,
      latestCompletedSubmission: null,
      registrationOptions: [],
      selectedOption: null,
      queryError: err?.message || "Terjadi kesalahan sistem saat memuat status kelayakan NIM.",
    };
  }
}
