"use client";

import { useState } from "react";
import { LipDocument, Invoice } from "@/types/lip-invoice";
import { LipTable } from "@/components/lip-invoices/lip-table";
import { InvoiceTable } from "@/components/lip-invoices/invoice-table";
import { LipFormModal } from "@/components/lip-invoices/lip-form-modal";
import { InvoiceFormModal } from "@/components/lip-invoices/invoice-form-modal";
import { RoleCode } from "@/lib/auth/types";
import { FileText, Receipt, Plus, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface RegistrationLipInvoiceListProps {
  registrationId: string;
  registrationNumber: string;
  studentName: string;
  studentNim: string | null;
  academicPeriodName: string;
  feeEstimateAmount: number;
  lipDocuments: LipDocument[];
  invoices: Invoice[];
  userRole: RoleCode;
}

export function RegistrationLipInvoiceList({
  registrationId,
  registrationNumber,
  studentName,
  studentNim,
  academicPeriodName,
  feeEstimateAmount,
  lipDocuments,
  invoices,
  userRole,
}: RegistrationLipInvoiceListProps) {
  const router = useRouter();

  const [isLipModalOpen, setIsLipModalOpen] = useState(false);
  const [selectedLipForInvoice, setSelectedLipForInvoice] = useState<LipDocument | null>(null);

  const canMutate = userRole === "owner" || userRole === "academic_admin";

  const verifiedLip = lipDocuments.find((l) => l.status === "verified");
  const officialLipAmount = verifiedLip ? verifiedLip.officialAmount : null;
  const hasMismatchWithEstimate = officialLipAmount !== null && officialLipAmount !== feeEstimateAmount;

  return (
    <div className="space-y-6 text-xs">
      {/* Mismatch Warning Comparison Banner: Tariff Estimate vs Official LIP Amount */}
      {hasMismatchWithEstimate && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 space-y-1 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-amber-700">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>PERBEDAAN ESTIMASI TARIF VS TOTAL RESMI LIP UT</span>
          </div>
          <p className="leading-relaxed text-xs">
            Estimasi Master Tarif Registrasi: <strong>Rp {feeEstimateAmount.toLocaleString("id-ID")}</strong> | Total Resmi Dokumen LIP UT: <strong>Rp {officialLipAmount.toLocaleString("id-ID")}</strong>.
            Total resmi kewajiban UT untuk tagihan mahasiswa secara mengikat mengacu pada Total Resmi Dokumen LIP.
          </p>
        </div>
      )}

      {/* SECTION 1: DOKUMEN LIP UT */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Dokumen LIP (Lembar Informasi Pembayaran) UT</h2>
              <p className="text-[11px] text-slate-500">Kelola berkas fisik LIP dan total resmi kewajiban UT</p>
            </div>
          </div>

          {canMutate && (
            <button
              type="button"
              onClick={() => setIsLipModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Unggah / Input LIP</span>
            </button>
          )}
        </div>

        <LipTable
          lipDocuments={lipDocuments}
          total={lipDocuments.length}
          page={1}
          limit={50}
          totalPages={1}
          userRole={userRole}
          onPageChange={() => {}}
          onCreateInvoice={(lip) => setSelectedLipForInvoice(lip)}
        />
      </div>

      {/* SECTION 2: TAGIHAN INVOICE MAHASISWA */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tagihan Invoice Internal Mahasiswa</h2>
              <p className="text-[11px] text-slate-500">
                Total Kewajiban = Total LIP Resmi UT + Service Fee SALUT + Internal Fee - Diskon Approved
              </p>
            </div>
          </div>

          {canMutate && verifiedLip && invoices.length === 0 && (
            <button
              type="button"
              onClick={() => setSelectedLipForInvoice(verifiedLip)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Terbitkan Invoice</span>
            </button>
          )}
        </div>

        <InvoiceTable
          invoices={invoices}
          total={invoices.length}
          page={1}
          limit={50}
          totalPages={1}
          onPageChange={() => {}}
        />
      </div>

      {/* Upload LIP Modal */}
      {isLipModalOpen && (
        <LipFormModal
          isOpen={isLipModalOpen}
          onClose={() => setIsLipModalOpen(false)}
          onSuccess={() => router.refresh()}
          registrationsOptions={[
            {
              id: registrationId,
              registrationNumber,
              studentName,
              studentNim,
              academicPeriodName,
            },
          ]}
          defaultRegistrationId={registrationId}
        />
      )}

      {/* Create Invoice Modal */}
      {selectedLipForInvoice && (
        <InvoiceFormModal
          lipDocument={selectedLipForInvoice}
          isOpen={Boolean(selectedLipForInvoice)}
          onClose={() => setSelectedLipForInvoice(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
