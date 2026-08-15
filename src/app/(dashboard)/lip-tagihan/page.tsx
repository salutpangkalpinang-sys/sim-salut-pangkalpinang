import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getLipDocumentsList, getInvoicesList } from "@/features/lip-invoices/queries";
import { getRegistrationsList } from "@/features/registrations/queries";
import { LipInvoiceContainer } from "@/components/lip-invoices/lip-invoice-container";
import { redirect } from "next/navigation";

export default async function LipTagihanPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const [lipsRes, invoicesRes, regsRes] = await Promise.all([
    getLipDocumentsList({ limit: 50 }),
    getInvoicesList({ limit: 50 }),
    getRegistrationsList({ limit: 100 }),
  ]);

  const registrationsOptions = (regsRes.data || []).map((r) => ({
    id: r.id,
    registrationNumber: r.registrationNumber,
    studentName: r.studentName || "Mahasiswa",
    studentNim: r.studentNim || null,
    academicPeriodName: r.academicPeriodName || "-",
  }));

  return (
    <LipInvoiceContainer
      initialLips={lipsRes.data}
      initialLipTotal={lipsRes.total}
      initialInvoices={invoicesRes.data}
      initialInvoiceTotal={invoicesRes.total}
      userRole={profile.role}
      registrationsOptions={registrationsOptions}
    />
  );
}
