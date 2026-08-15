import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { generateCsvString } from "@/lib/csv-exporter";
import {
  getStudentReport,
  getRegistrationReport,
  getInvoiceReport,
  getReceivablesReport,
  getPaymentReport,
  getUtRemittanceReport,
  getUtOutstandingReport,
  getServiceFeeReport,
  getOperationalReport,
  getCashFlowReport,
} from "@/features/reports/queries";

const ALLOWED_REPORT_TYPES = [
  "students",
  "registrations",
  "invoices",
  "receivables",
  "payments",
  "ut-remittances",
  "ut-outstanding",
  "service-fees",
  "operational",
  "cash-flow",
] as const;

const FINANCIAL_REPORT_TYPES = [
  "invoices",
  "receivables",
  "payments",
  "ut-remittances",
  "ut-outstanding",
  "service-fees",
  "operational",
  "cash-flow",
];

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get("report");

  if (!reportType || !(ALLOWED_REPORT_TYPES as readonly string[]).includes(reportType)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  // Server-Side Authorization: Academic Admin is denied from financial exports!
  if (profile.role === "academic_admin" && FINANCIAL_REPORT_TYPES.includes(reportType)) {
    return NextResponse.json(
      { error: "Permission denied: Academic Admin cannot export financial reports" },
      { status: 403 }
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const filename = `${reportType}-${todayStr}.csv`;
  let csvContent = "";

  switch (reportType) {
    case "students": {
      const res = await getStudentReport({ page: 1, limit: 5000 });
      const headers = ["NIM", "Nama Mahasiswa", "NIK Masked", "Fakultas", "Program Studi", "Angkatan", "Skema Layanan", "Status"];
      const rows = res.data.map((s) => [
        s.nim,
        s.fullName,
        s.nikMasked,
        s.facultyName,
        s.studyProgramName,
        s.entryYear,
        s.serviceSchemeName,
        s.statusName,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "registrations": {
      const res = await getRegistrationReport({ page: 1, limit: 5000 });
      const headers = ["No. Registrasi", "NIM", "Nama Mahasiswa", "Periode Akademik", "Jenis Registrasi", "Program Studi", "Skema", "SKS", "Estimasi Tarif (Rp)", "Status"];
      const rows = res.data.map((r) => [
        r.registrationNumber,
        r.nim,
        r.studentName,
        r.academicPeriodName,
        r.registrationTypeName,
        r.studyProgramName,
        r.serviceSchemeName,
        r.totalSks,
        r.feeEstimateAmount,
        r.status,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "invoices": {
      const res = await getInvoiceReport({ page: 1, limit: 5000 });
      const headers = ["No. Invoice", "NIM", "Nama Mahasiswa", "Periode Akademik", "Total Tagihan (Rp)", "Alokasi Terbayar (Rp)", "Sisa Tagihan (Rp)", "Status Pembayaran", "Jatuh Tempo"];
      const rows = res.data.map((inv) => [
        inv.invoiceNumber,
        inv.nim,
        inv.studentName,
        inv.academicPeriodName,
        inv.invoiceTotalAmount,
        inv.verifiedPaidAmount,
        inv.remainingBalance,
        inv.paymentStatus,
        inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("id-ID") : "-",
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "receivables": {
      const res = await getReceivablesReport({ page: 1, limit: 5000 });
      const headers = ["No. Invoice", "NIM", "Nama Mahasiswa", "Total Tagihan (Rp)", "Terbayar (Rp)", "Sisa Piutang (Rp)", "Jatuh Tempo"];
      const rows = res.data.map((r) => [
        r.invoiceNumber,
        r.nim,
        r.studentName,
        r.invoiceTotalAmount,
        r.verifiedPaidAmount,
        r.remainingBalance,
        r.dueAt ? new Date(r.dueAt).toLocaleDateString("id-ID") : "-",
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "payments": {
      const res = await getPaymentReport({ page: 1, limit: 5000 });
      const headers = ["No. Transaksi", "Tanggal Setor", "NIM", "Nama Mahasiswa", "Metode Pembayaran", "Total Bayar (Rp)", "Teralokasi (Rp)", "Unallocated (Rp)", "No. Ref", "Status"];
      const rows = res.data.map((p) => [
        p.transactionNumber,
        new Date(p.paidAt).toLocaleDateString("id-ID"),
        p.nim,
        p.studentName,
        p.paymentMethodName,
        p.paymentAmount,
        p.allocatedAmount,
        p.unallocatedAmount,
        p.referenceNumber,
        p.status,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "ut-remittances": {
      const res = await getUtRemittanceReport({ page: 1, limit: 5000 });
      const headers = ["No. Setoran UT", "Tanggal Setor", "Total Setoran (Rp)", "Sumber Rekening Kas", "No. Referensi", "Status"];
      const rows = res.data.map((r) => [
        r.remittanceNumber,
        new Date(r.paidAt).toLocaleDateString("id-ID"),
        r.amount,
        r.cashAccountName,
        r.referenceNumber,
        r.status,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "ut-outstanding": {
      const res = await getUtOutstandingReport({ page: 1, limit: 5000 });
      const headers = ["No. LIP", "No. Registrasi", "NIM", "Nama Mahasiswa", "Resmi UT (Rp)", "Disetor (Rp)", "Sisa Kewajiban UT (Rp)", "Status LIP"];
      const rows = res.data.map((lip) => [
        lip.lipNumber,
        lip.registrationNumber,
        lip.nim,
        lip.studentName,
        lip.officialAmount,
        lip.verifiedUtPaid,
        lip.outstandingUtAmount,
        lip.status,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "service-fees": {
      const res = await getServiceFeeReport({ page: 1, limit: 5000 });
      const headers = ["No. Invoice", "NIM", "Nama Mahasiswa", "Periode Akademik", "Biaya Layanan SALUT Ditagihkan (Rp)", "Status Invoice"];
      const rows = res.data.map((f) => [
        f.invoiceNumber,
        f.nim,
        f.studentName,
        f.academicPeriodName,
        f.serviceFeeAmount,
        f.invoiceStatus,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "operational": {
      const res = await getOperationalReport({ page: 1, limit: 5000 });
      const headers = ["No. Transaksi", "Tanggal", "Jenis", "Kategori", "Deskripsi", "Sumber Kas", "Nominal (Rp)", "Status"];
      const rows = res.data.map((o) => [
        o.transactionNumber,
        new Date(o.transactionDate).toLocaleDateString("id-ID"),
        o.transactionType === "income" ? "Pemasukan" : "Pengeluaran",
        o.categoryName,
        o.description,
        o.cashAccountName,
        o.amount,
        o.status,
      ]);
      csvContent = generateCsvString(headers, rows);
      break;
    }

    case "cash-flow": {
      const res = await getCashFlowReport();
      const headers = ["Komponen Arus Kas", "Nominal (Rp)"];
      const rows = [
        ["Penerimaan Mahasiswa Terverifikasi (+)", res.verifiedStudentPayments],
        ["Pemasukan Operasional Terverifikasi (+)", res.verifiedOperationalIncome],
        ["TOTAL ARUS KAS MASUK (INFLOW)", res.totalInflow],
        ["Setoran UT Terverifikasi (-)", res.verifiedUtRemittances],
        ["Pengeluaran Operasional Terverifikasi (-)", res.verifiedOperationalExpense],
        ["TOTAL ARUS KAS KELUAR (OUTFLOW)", res.totalOutflow],
        ["PERGERAKAN ARUS KAS BERSIH (NET CASH MOVEMENT)", res.netCashMovement],
      ];
      csvContent = generateCsvString(headers, rows);
      break;
    }
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
