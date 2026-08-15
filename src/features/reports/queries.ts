import { createClient } from "@/lib/supabase/server";

export async function getStudentReport(params: {
  page?: number;
  limit?: number;
  search?: string;
  statusId?: string;
  studyProgramId?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("students")
    .select(
      `
      id,
      nim,
      nik,
      full_name,
      entry_year,
      faculties ( name ),
      study_programs ( name ),
      service_schemes ( name ),
      student_statuses ( name, code )
    `,
      { count: "exact" }
    );

  if (params.statusId) query = query.eq("status_id", params.statusId);
  if (params.studyProgramId) query = query.eq("study_program_id", params.studyProgramId);
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    query = query.or(`full_name.ilike.${s},nim.ilike.${s},nik.ilike.${s}`);
  }

  query = query.order("full_name", { ascending: true }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || []).map((s: any) => ({
    id: s.id,
    nim: s.nim || "-",
    nikMasked: s.nik ? s.nik.substring(0, 4) + "**********" + s.nik.substring(14) : "-",
    fullName: s.full_name,
    entryYear: s.entry_year,
    facultyName: s.faculties?.name || "-",
    studyProgramName: s.study_programs?.name || "-",
    serviceSchemeName: s.service_schemes?.name || "-",
    statusName: s.student_statuses?.name || "-",
    statusCode: s.student_statuses?.code || "-",
  }));

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRegistrationReport(params: {
  page?: number;
  limit?: number;
  academicPeriodId?: string;
  studyProgramId?: string;
  status?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("registrations")
    .select(
      `
      id,
      registration_number,
      total_sks,
      fee_estimate_amount,
      status,
      created_at,
      academic_periods ( code, name ),
      registration_types ( name ),
      study_programs ( name ),
      service_schemes ( name ),
      students ( nim, full_name )
    `,
      { count: "exact" }
    );

  if (params.academicPeriodId) query = query.eq("academic_period_id", params.academicPeriodId);
  if (params.studyProgramId) query = query.eq("study_program_id", params.studyProgramId);
  if (params.status) query = query.eq("status", params.status);

  query = query.order("created_at", { ascending: false }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || []).map((r: any) => ({
    id: r.id,
    registrationNumber: r.registration_number,
    nim: r.students?.nim || "-",
    studentName: r.students?.full_name || "Mahasiswa",
    academicPeriodName: r.academic_periods ? `${r.academic_periods.name} (${r.academic_periods.code})` : "-",
    registrationTypeName: r.registration_types?.name || "-",
    studyProgramName: r.study_programs?.name || "-",
    serviceSchemeName: r.service_schemes?.name || "-",
    totalSks: Number(r.total_sks) || 0,
    feeEstimateAmount: Number(r.fee_estimate_amount) || 0,
    status: r.status,
    createdAt: r.created_at,
  }));

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceReport(params: {
  page?: number;
  limit?: number;
  academicPeriodId?: string;
  status?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      due_at,
      status,
      created_at,
      registrations (
        academic_periods ( name, code ),
        students ( nim, full_name )
      ),
      invoice_items ( amount, is_discount, is_approved ),
      payment_allocations (
        amount,
        student_payments ( status )
      )
    `,
      { count: "exact" }
    );

  if (params.status) query = query.eq("status", params.status);

  query = query.order("created_at", { ascending: false }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

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

    let paymentStatus = "unpaid";
    if (inv.status === "cancelled") {
      paymentStatus = "cancelled";
    } else if (remainingBalance <= 0) {
      paymentStatus = "paid";
    } else if (verifiedAllocated > 0) {
      paymentStatus = "partial";
    }

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      nim: inv.registrations?.students?.nim || "-",
      studentName: inv.registrations?.students?.full_name || "Mahasiswa",
      academicPeriodName: inv.registrations?.academic_periods
        ? `${inv.registrations.academic_periods.name} (${inv.registrations.academic_periods.code})`
        : "-",
      invoiceTotalAmount: invTotal,
      verifiedPaidAmount: verifiedAllocated,
      remainingBalance,
      paymentStatus,
      dueAt: inv.due_at,
      createdAt: inv.created_at,
    };
  });

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getReceivablesReport(params: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const allInvoices = await getInvoiceReport({ page: 1, limit: 1000 });
  const receivables = allInvoices.data.filter(
    (inv) => inv.remainingBalance > 0 && inv.paymentStatus !== "cancelled"
  );

  let filtered = receivables;
  if (params.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    filtered = receivables.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.nim.toLowerCase().includes(q)
    );
  }

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const total = filtered.length;
  const pagedData = filtered.slice((page - 1) * limit, page * limit);

  return { data: pagedData, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPaymentReport(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("student_payments")
    .select(
      `
      id,
      transaction_number,
      paid_at,
      amount,
      reference_number,
      status,
      students ( nim, full_name ),
      payment_methods ( name ),
      payment_allocations ( amount )
    `,
      { count: "exact" }
    );

  if (params.status) query = query.eq("status", params.status);
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    query = query.or(`transaction_number.ilike.${s},reference_number.ilike.${s}`);
  }

  query = query.order("paid_at", { ascending: false }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || []).map((p: any) => {
    const paymentAmount = Number(p.amount) || 0;
    let allocatedAmount = 0;
    (p.payment_allocations || []).forEach((alloc: any) => {
      allocatedAmount += Number(alloc.amount) || 0;
    });

    const unallocatedAmount = Math.max(0, paymentAmount - allocatedAmount);

    return {
      id: p.id,
      transactionNumber: p.transaction_number,
      paidAt: p.paid_at,
      nim: p.students?.nim || "-",
      studentName: p.students?.full_name || "Mahasiswa",
      paymentMethodName: p.payment_methods?.name || "Metode Pembayaran",
      paymentAmount,
      allocatedAmount,
      unallocatedAmount,
      referenceNumber: p.reference_number || "-",
      status: p.status,
    };
  });

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUtRemittanceReport(params: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("ut_remittances")
    .select(
      `
      id,
      remittance_number,
      paid_at,
      amount,
      reference_number,
      status,
      cash_accounts ( name )
    `,
      { count: "exact" }
    );

  if (params.status) query = query.eq("status", params.status);

  query = query.order("paid_at", { ascending: false }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || []).map((r: any) => ({
    id: r.id,
    remittanceNumber: r.remittance_number,
    paidAt: r.paid_at,
    amount: Number(r.amount) || 0,
    cashAccountName: r.cash_accounts?.name || "Kas / Bank",
    referenceNumber: r.reference_number || "-",
    status: r.status,
  }));

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUtOutstandingReport(params: {
  page?: number;
  limit?: number;
}) {
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
        students ( nim, full_name )
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
      registrationNumber: lip.registrations?.registration_number || "-",
      nim: lip.registrations?.students?.nim || "-",
      studentName: lip.registrations?.students?.full_name || "Mahasiswa",
      officialAmount,
      verifiedUtPaid,
      outstandingUtAmount,
      status: lip.status,
    };
  });

  const outstandingOnly = mapped.filter((lip) => lip.outstandingUtAmount > 0);
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const total = outstandingOnly.length;
  const pagedData = outstandingOnly.slice((page - 1) * limit, page * limit);

  return { data: pagedData, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getServiceFeeReport(params: {
  page?: number;
  limit?: number;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("invoice_items")
    .select(
      `
      id,
      amount,
      invoices (
        invoice_number,
        status,
        registrations (
          academic_periods ( code, name ),
          students ( nim, full_name )
        )
      )
    `,
      { count: "exact" }
    )
    .eq("item_type", "service_fee")
    .range(from, to);

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || [])
    .filter((item: any) => item.invoices?.status !== "cancelled")
    .map((item: any) => ({
      id: item.id,
      invoiceNumber: item.invoices?.invoice_number || "-",
      nim: item.invoices?.registrations?.students?.nim || "-",
      studentName: item.invoices?.registrations?.students?.full_name || "Mahasiswa",
      academicPeriodName: item.invoices?.registrations?.academic_periods
        ? `${item.invoices.registrations.academic_periods.name} (${item.invoices.registrations.academic_periods.code})`
        : "-",
      serviceFeeAmount: Number(item.amount) || 0,
      invoiceStatus: item.invoices?.status || "-",
    }));

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOperationalReport(params: {
  page?: number;
  limit?: number;
  transactionType?: string;
}) {
  const supabase = await createClient();
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("operational_transactions")
    .select(
      `
      id,
      transaction_number,
      transaction_type,
      transaction_date,
      amount,
      description,
      status,
      operational_categories ( name ),
      cash_accounts ( name )
    `,
      { count: "exact" }
    );

  if (params.transactionType) query = query.eq("transaction_type", params.transactionType);

  query = query.order("transaction_date", { ascending: false }).range(from, to);
  const { data, count, error } = await query;

  if (error) return { data: [], total: 0, page, limit, totalPages: 0 };

  const mapped = (data || []).map((t: any) => ({
    id: t.id,
    transactionNumber: t.transaction_number,
    transactionType: t.transaction_type,
    categoryName: t.operational_categories?.name || "-",
    cashAccountName: t.cash_accounts?.name || "Kas / Bank",
    transactionDate: t.transaction_date,
    amount: Number(t.amount) || 0,
    description: t.description,
    status: t.status,
  }));

  const total = count || 0;
  return { data: mapped, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCashFlowReport() {
  const supabase = await createClient();

  const [paymentsRes, opsRes, utRemRes] = await Promise.all([
    supabase.from("student_payments").select("amount").eq("status", "verified"),
    supabase.from("operational_transactions").select("transaction_type, amount").eq("status", "verified"),
    supabase.from("ut_remittance_items").select("amount, ut_remittances(status)"),
  ]);

  let verifiedStudentPayments = 0;
  (paymentsRes.data || []).forEach((p: any) => {
    verifiedStudentPayments += Number(p.amount) || 0;
  });

  let verifiedOperationalIncome = 0;
  let verifiedOperationalExpense = 0;
  (opsRes.data || []).forEach((o: any) => {
    const amt = Number(o.amount) || 0;
    if (o.transaction_type === "income") verifiedOperationalIncome += amt;
    else if (o.transaction_type === "expense") verifiedOperationalExpense += amt;
  });

  let verifiedUtRemittances = 0;
  (utRemRes.data || []).forEach((ri: any) => {
    if (ri.ut_remittances?.status === "verified") {
      verifiedUtRemittances += Number(ri.amount) || 0;
    }
  });

  const totalInflow = verifiedStudentPayments + verifiedOperationalIncome;
  const totalOutflow = verifiedUtRemittances + verifiedOperationalExpense;
  const netCashMovement = totalInflow - totalOutflow;

  return {
    verifiedStudentPayments,
    verifiedOperationalIncome,
    totalInflow,
    verifiedUtRemittances,
    verifiedOperationalExpense,
    totalOutflow,
    netCashMovement,
  };
}

export async function getStudentTimelineReport(studentId: string) {
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, nim, full_name, study_programs(name), service_schemes(name)")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  const [regsRes, invsRes, pmtsRes] = await Promise.all([
    supabase.from("registrations").select("id, registration_number, created_at, status").eq("student_id", studentId),
    supabase
      .from("invoices")
      .select("id, invoice_number, created_at, status, registration_id")
      .in(
        "registration_id",
        (
          await supabase.from("registrations").select("id").eq("student_id", studentId)
        ).data?.map((r) => r.id) || []
      ),
    supabase.from("student_payments").select("id, transaction_number, paid_at, amount, status").eq("student_id", studentId),
  ]);

  const timeline: { type: string; title: string; date: string; detail: string; status: string }[] = [];

  (regsRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "registrasi",
      title: `Registrasi #${r.registration_number}`,
      date: r.created_at,
      detail: `Registrasi semester mahasiswa`,
      status: r.status,
    });
  });

  (invsRes.data || []).forEach((inv: any) => {
    timeline.push({
      type: "invoice",
      title: `Invoice #${inv.invoice_number}`,
      date: inv.created_at,
      detail: `Tagihan semester`,
      status: inv.status,
    });
  });

  (pmtsRes.data || []).forEach((p: any) => {
    timeline.push({
      type: "pembayaran",
      title: `Pembayaran #${p.transaction_number}`,
      date: p.paid_at,
      detail: `Nominal Rp ${Number(p.amount).toLocaleString("id-ID")}`,
      status: p.status,
    });
  });

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    student: {
      id: student.id,
      nim: student.nim || "-",
      fullName: student.full_name,
      studyProgramName: (student as any).study_programs?.name || "-",
      serviceSchemeName: (student as any).service_schemes?.name || "-",
    },
    timeline,
  };
}
