import { createClient } from "@/lib/supabase/server";

export interface DashboardKpiMetrics {
  activeStudents: number;
  candidateStudents: number;
  semesterRegistrations: number;
  totalInvoicesBilled: number;
  studentPaymentsVerified: number;
  studentReceivables: number;
  utLiability: number;
  utRemittancesVerified: number;
  outstandingUtLiability: number;
  serviceFeeBilled: number;
  operationalIncomeVerified: number;
  operationalExpenseVerified: number;
  netCashMovement: number;
  selectedPeriodId: string | null;
  selectedPeriodName: string;
}

export async function getDashboardKpiMetrics(periodId?: string): Promise<DashboardKpiMetrics> {
  const supabase = await createClient();

  // 1. Fetch Academic Periods to resolve selected or default active period
  const { data: periodsData } = await supabase
    .from("academic_periods")
    .select("id, code, name, is_active")
    .order("code", { ascending: false });

  const periods = periodsData || [];
  let currentPeriod = periods.find((p) => p.is_active) || periods[0] || null;

  if (periodId) {
    const found = periods.find((p) => p.id === periodId);
    if (found) currentPeriod = found;
  }

  const activePeriodId = currentPeriod?.id || null;
  const activePeriodName = currentPeriod ? `${currentPeriod.name} (${currentPeriod.code})` : "Semua Periode";

  // 2. Query Students by Status (Mahasiswa Aktif & Calon Mahasiswa)
  const { data: studentsData } = await supabase
    .from("students")
    .select("id, student_statuses ( code, name )");

  let activeStudents = 0;
  let candidateStudents = 0;

  (studentsData || []).forEach((s: any) => {
    const statusCode = (s.student_statuses?.code || "").toLowerCase();
    if (statusCode === "aktif" || statusCode === "active") {
      activeStudents++;
    } else if (statusCode === "calon" || statusCode === "candidate") {
      candidateStudents++;
    }
  });

  // 3. Query Registrations (Semester Registrations Count)
  let regQuery = supabase.from("registrations").select("id, status", { count: "exact" }).neq("status", "cancelled");
  if (activePeriodId) {
    regQuery = regQuery.eq("academic_period_id", activePeriodId);
  }
  const { count: regCount } = await regQuery;
  const semesterRegistrations = regCount || 0;

  // 4. Query Invoices, Invoice Items & Payment Allocations
  const invoiceQuery = supabase
    .from("invoices")
    .select(
      `
      id,
      registration_id,
      status,
      registrations ( academic_period_id ),
      invoice_items ( item_type, amount, is_discount, is_approved ),
      payment_allocations (
        amount,
        student_payments ( status )
      )
    `
    )
    .neq("status", "cancelled");

  const { data: invoicesData } = await invoiceQuery;
  const filteredInvoices = (invoicesData || []).filter((inv: any) => {
    if (!activePeriodId) return true;
    return inv.registrations?.academic_period_id === activePeriodId;
  });

  let totalInvoicesBilled = 0;
  let studentReceivables = 0;
  let serviceFeeBilled = 0;

  filteredInvoices.forEach((inv: any) => {
    let invTotal = 0;

    (inv.invoice_items || []).forEach((item: any) => {
      const amt = Number(item.amount) || 0;
      if (item.is_discount) {
        if (item.is_approved) {
          invTotal -= amt;
        }
      } else {
        invTotal += amt;
        if (item.item_type === "service_fee") {
          serviceFeeBilled += amt;
        }
      }
    });

    invTotal = Math.max(0, invTotal);
    totalInvoicesBilled += invTotal;

    let verifiedAllocated = 0;
    (inv.payment_allocations || []).forEach((alloc: any) => {
      if (alloc.student_payments?.status === "verified") {
        verifiedAllocated += Number(alloc.amount) || 0;
      }
    });

    const remaining = Math.max(0, invTotal - verifiedAllocated);
    studentReceivables += remaining;
  });

  // 5. Query Student Payments Verified (Full Payment Amount)
  const { data: paymentsData } = await supabase
    .from("student_payments")
    .select("amount")
    .eq("status", "verified");

  let studentPaymentsVerified = 0;
  (paymentsData || []).forEach((p: any) => {
    studentPaymentsVerified += Number(p.amount) || 0;
  });

  // 6. Query LIP Documents & UT Remittances (Kewajiban UT, Setoran UT, Outstanding UT)
  const lipQuery = supabase
    .from("lip_documents")
    .select(
      `
      id,
      official_amount,
      status,
      registration_id,
      registrations ( academic_period_id ),
      ut_remittance_items (
        amount,
        ut_remittances ( status )
      )
    `
    )
    .in("status", ["verified", "paid_to_ut"]);

  const { data: lipsData } = await lipQuery;
  const filteredLips = (lipsData || []).filter((lip: any) => {
    if (!activePeriodId) return true;
    return lip.registrations?.academic_period_id === activePeriodId;
  });

  let utLiability = 0;
  let utRemittancesVerified = 0;
  let outstandingUtLiability = 0;

  filteredLips.forEach((lip: any) => {
    const officialAmt = Number(lip.official_amount) || 0;
    utLiability += officialAmt;

    let verifiedUtPaid = 0;
    (lip.ut_remittance_items || []).forEach((ri: any) => {
      if (ri.ut_remittances?.status === "verified") {
        verifiedUtPaid += Number(ri.amount) || 0;
      }
    });

    utRemittancesVerified += verifiedUtPaid;
    const outstanding = Math.max(0, officialAmt - verifiedUtPaid);
    outstandingUtLiability += outstanding;
  });

  // 7. Query Operational Transactions (Income & Expense Verified)
  const { data: opsData } = await supabase
    .from("operational_transactions")
    .select("transaction_type, amount")
    .eq("status", "verified");

  let operationalIncomeVerified = 0;
  let operationalExpenseVerified = 0;

  (opsData || []).forEach((op: any) => {
    const amt = Number(op.amount) || 0;
    if (op.transaction_type === "income") {
      operationalIncomeVerified += amt;
    } else if (op.transaction_type === "expense") {
      operationalExpenseVerified += amt;
    }
  });

  // 8. Net Cash Movement (Arus Kas Bersih Sederhana)
  const netCashMovement =
    studentPaymentsVerified +
    operationalIncomeVerified -
    utRemittancesVerified -
    operationalExpenseVerified;

  return {
    activeStudents,
    candidateStudents,
    semesterRegistrations,
    totalInvoicesBilled,
    studentPaymentsVerified,
    studentReceivables,
    utLiability,
    utRemittancesVerified,
    outstandingUtLiability,
    serviceFeeBilled,
    operationalIncomeVerified,
    operationalExpenseVerified,
    netCashMovement,
    selectedPeriodId: activePeriodId,
    selectedPeriodName: activePeriodName,
  };
}

export async function getLatestPaymentsWidget(limit = 5) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("student_payments")
    .select(
      `
      id,
      transaction_number,
      paid_at,
      amount,
      status,
      students ( full_name, nim ),
      payment_methods ( name )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((p: any) => ({
    id: p.id,
    transactionNumber: p.transaction_number,
    studentName: p.students?.full_name || "Mahasiswa",
    studentNim: p.students?.nim || null,
    paidAt: p.paid_at,
    amount: Number(p.amount) || 0,
    paymentMethodName: p.payment_methods?.name || "Metode Pembayaran",
    status: p.status,
  }));
}

export async function getOverdueInvoicesWidget(limit = 5) {
  const supabase = await createClient();
  const nowStr = new Date().toISOString();

  const { data } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      due_at,
      status,
      registrations (
        students ( full_name, nim )
      ),
      invoice_items ( amount, is_discount, is_approved ),
      payment_allocations (
        amount,
        student_payments ( status )
      )
    `
    )
    .neq("status", "cancelled")
    .lt("due_at", nowStr);

  const mapped = (data || []).map((inv: any) => {
    let invTotal = 0;
    (inv.invoice_items || []).forEach((item: any) => {
      const amt = Number(item.amount) || 0;
      if (item.is_discount) {
        if (item.is_approved) invTotal -= amt;
      } else {
        invTotal += amt;
      }
    });

    let verifiedAllocated = 0;
    (inv.payment_allocations || []).forEach((alloc: any) => {
      if (alloc.student_payments?.status === "verified") {
        verifiedAllocated += Number(alloc.amount) || 0;
      }
    });

    const remainingBalance = Math.max(0, invTotal - verifiedAllocated);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      studentName: inv.registrations?.students?.full_name || "Mahasiswa",
      studentNim: inv.registrations?.students?.nim || null,
      dueAt: inv.due_at,
      invoiceTotalAmount: invTotal,
      remainingBalance,
    };
  });

  return mapped
    .filter((inv) => inv.remainingBalance > 0)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, limit);
}

export async function getPendingLipsWidget(limit = 5) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lip_documents")
    .select(
      `
      id,
      lip_number,
      official_amount,
      created_at,
      registrations (
        registration_number,
        students ( full_name, nim )
      )
    `
    )
    .eq("status", "pending_verification")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((lip: any) => ({
    id: lip.id,
    lipNumber: lip.lip_number,
    studentName: lip.registrations?.students?.full_name || "Mahasiswa",
    studentNim: lip.registrations?.students?.nim || null,
    registrationNumber: lip.registrations?.registration_number || "-",
    officialAmount: Number(lip.official_amount) || 0,
    createdAt: lip.created_at,
  }));
}

export async function getOutstandingUtPriorityWidget(limit = 5) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lip_documents")
    .select(
      `
      id,
      lip_number,
      official_amount,
      status,
      registrations (
        registration_number,
        students ( full_name, nim )
      ),
      ut_remittance_items (
        amount,
        ut_remittances ( status )
      )
    `
    )
    .in("status", ["verified", "paid_to_ut"]);

  const mapped = (data || []).map((lip: any) => {
    const officialAmount = Number(lip.official_amount) || 0;
    let verifiedUtPaid = 0;

    (lip.ut_remittance_items || []).forEach((ri: any) => {
      if (ri.ut_remittances?.status === "verified") {
        verifiedUtPaid += Number(ri.amount) || 0;
      }
    });

    const outstandingUtAmount = Math.max(0, officialAmount - verifiedUtPaid);

    return {
      id: lip.id,
      lipNumber: lip.lip_number,
      studentName: lip.registrations?.students?.full_name || "Mahasiswa",
      studentNim: lip.registrations?.students?.nim || null,
      registrationNumber: lip.registrations?.registration_number || "-",
      officialAmount,
      verifiedUtPaid,
      outstandingUtAmount,
    };
  });

  return mapped
    .filter((lip) => lip.outstandingUtAmount > 0)
    .sort((a, b) => b.outstandingUtAmount - a.outstandingUtAmount)
    .slice(0, limit);
}
