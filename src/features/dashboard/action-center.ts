import { createClient } from "@/lib/supabase/server";
import { RoleCode } from "@/lib/auth/types";
import { PriorityLevel, getPriorityLevel } from "@/lib/constants/aging";

export interface ActionCenterItem {
  category: "pending_payments" | "pending_lips" | "student_receivables" | "outstanding_ut" | "draft_registrations";
  title: string;
  count: number;
  totalAmount?: number | null;
  oldestAgeDays?: number | null;
  oldestAgeLabel?: string | null;
  overdueCount?: number | null;
  academicPeriodName?: string | null;
  priority: PriorityLevel;
  ctaText: string;
  ctaHref: string;
  description: string;
}

export interface ActionCenterSummary {
  items: ActionCenterItem[];
  totalActionsCount: number;
  urgentCount: number;
  attentionCount: number;
  newCount: number;
}

export async function getActionCenterSummary(userRole: RoleCode): Promise<ActionCenterSummary> {
  const supabase = await createClient();
  const nowMs = Date.now();

  // 1. Query Pembayaran Menunggu Verifikasi
  const { data: pendingPayments } = await supabase
    .from("student_payments")
    .select("id, amount, created_at, paid_at")
    .eq("status", "pending_verification");

  const pendingPaymentsCount = (pendingPayments || []).length;
  let pendingPaymentsTotal = 0;
  let oldestPaymentDate: string | null = null;
  let oldestPaymentAgeDays = 0;

  if (pendingPaymentsCount > 0) {
    let oldestMs = nowMs;
    pendingPayments?.forEach((p: any) => {
      pendingPaymentsTotal += Number(p.amount) || 0;
      const createdMs = new Date(p.created_at || p.paid_at).getTime();
      if (createdMs < oldestMs) {
        oldestMs = createdMs;
        oldestPaymentDate = p.created_at || p.paid_at;
      }
    });
    oldestPaymentAgeDays = Math.max(0, Math.floor((nowMs - oldestMs) / (1000 * 60 * 60 * 24)));
  }

  // 2. Query LIP Menunggu Verifikasi
  const { data: pendingLips } = await supabase
    .from("lip_documents")
    .select("id, created_at")
    .eq("status", "pending_verification");

  const pendingLipsCount = (pendingLips || []).length;
  let oldestLipDate: string | null = null;
  let oldestLipAgeDays = 0;

  if (pendingLipsCount > 0) {
    let oldestMs = nowMs;
    pendingLips?.forEach((l: any) => {
      const createdMs = new Date(l.created_at).getTime();
      if (createdMs < oldestMs) {
        oldestMs = createdMs;
        oldestLipDate = l.created_at;
      }
    });
    oldestLipAgeDays = Math.max(0, Math.floor((nowMs - oldestMs) / (1000 * 60 * 60 * 24)));
  }

  // 3. Query Piutang Mahasiswa (Invoices Remaining > 0)
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select(`
      id,
      created_at,
      due_at,
      status,
      invoice_items ( item_type, amount, is_discount, is_approved ),
      payment_allocations (
        amount,
        student_payments ( status )
      )
    `)
    .neq("status", "cancelled");

  let receivablesCount = 0;
  let receivablesTotal = 0;
  let overdueInvoiceCount = 0;
  let oldestInvoiceDate: string | null = null;

  (invoicesData || []).forEach((inv: any) => {
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

    const remaining = Math.max(0, invTotal - verifiedAllocated);

    if (remaining > 0) {
      receivablesCount++;
      receivablesTotal += remaining;

      if (inv.due_at && new Date(inv.due_at).getTime() < nowMs) {
        overdueInvoiceCount++;
      }

      if (!oldestInvoiceDate || new Date(inv.created_at).getTime() < new Date(oldestInvoiceDate).getTime()) {
        oldestInvoiceDate = inv.created_at;
      }
    }
  });

  // 4. Query Outstanding Setoran UT (Official Amount - Verified Remittances)
  const { data: lipsForUt } = await supabase
    .from("lip_documents")
    .select(`
      id,
      official_amount,
      created_at,
      status,
      ut_remittance_items (
        amount,
        ut_remittances ( status )
      )
    `)
    .in("status", ["verified", "paid_to_ut"]);

  let outstandingUtCount = 0;
  let outstandingUtTotal = 0;
  let oldestUtLipDate: string | null = null;

  (lipsForUt || []).forEach((lip: any) => {
    const officialAmt = Number(lip.official_amount) || 0;
    let verifiedUtPaid = 0;

    (lip.ut_remittance_items || []).forEach((ri: any) => {
      if (ri.ut_remittances?.status === "verified") {
        verifiedUtPaid += Number(ri.amount) || 0;
      }
    });

    const outstanding = Math.max(0, officialAmt - verifiedUtPaid);

    if (outstanding > 0) {
      outstandingUtCount++;
      outstandingUtTotal += outstanding;

      if (!oldestUtLipDate || new Date(lip.created_at).getTime() < new Date(oldestUtLipDate).getTime()) {
        oldestUtLipDate = lip.created_at;
      }
    }
  });

  // 5. Query Registrasi Draft
  const { data: draftRegs } = await supabase
    .from("registrations")
    .select("id, created_at, academic_periods ( name, code )")
    .eq("status", "draft");

  const draftRegsCount = (draftRegs || []).length;
  let oldestDraftRegDate: string | null = null;
  let draftPeriodName: string | null = null;

  if (draftRegsCount > 0) {
    let oldestMs = nowMs;
    draftRegs?.forEach((r: any) => {
      const createdMs = new Date(r.created_at).getTime();
      if (createdMs < oldestMs) {
        oldestMs = createdMs;
        oldestDraftRegDate = r.created_at;
      }
      if (!draftPeriodName && r.academic_periods?.name) {
        draftPeriodName = r.academic_periods.name;
      }
    });
  }

  // Construct Action Items list based on User Role Scope
  const allItems: ActionCenterItem[] = [];

  // Item 1: Pembayaran Menunggu Verifikasi (Owner & Finance Admin)
  if ((userRole === "owner" || userRole === "finance_admin" || userRole === "viewer") && pendingPaymentsCount > 0) {
    allItems.push({
      category: "pending_payments",
      title: "Pembayaran Menunggu Verifikasi",
      count: pendingPaymentsCount,
      totalAmount: pendingPaymentsTotal,
      oldestAgeDays: oldestPaymentAgeDays,
      oldestAgeLabel: oldestPaymentAgeDays > 0 ? `${oldestPaymentAgeDays} hari` : "Hari ini",
      priority: getPriorityLevel(oldestPaymentDate || new Date().toISOString()),
      ctaText: "Lihat Pembayaran",
      ctaHref: "/pembayaran?status=pending_verification",
      description: `${pendingPaymentsCount} transaksi pembayaran mahasiswa perlu diverifikasi kasir.`,
    });
  }

  // Item 2: LIP Menunggu Verifikasi (Owner, Academic Admin, Viewer)
  if ((userRole === "owner" || userRole === "academic_admin" || userRole === "viewer") && pendingLipsCount > 0) {
    allItems.push({
      category: "pending_lips",
      title: "LIP Menunggu Verifikasi",
      count: pendingLipsCount,
      oldestAgeDays: oldestLipAgeDays,
      oldestAgeLabel: oldestLipAgeDays > 0 ? `${oldestLipAgeDays} hari` : "Hari ini",
      priority: getPriorityLevel(oldestLipDate || new Date().toISOString()),
      ctaText: "Lihat LIP",
      ctaHref: "/lip-tagihan?tab=lip&status=pending_verification",
      description: `${pendingLipsCount} dokumen LIP UT perlu divalidasi oleh admin akademik.`,
    });
  }

  // Item 3: Piutang Mahasiswa (Owner, Finance Admin, Viewer)
  if ((userRole === "owner" || userRole === "finance_admin" || userRole === "viewer") && receivablesCount > 0) {
    allItems.push({
      category: "student_receivables",
      title: "Piutang Mahasiswa Perlu Ditindak",
      count: receivablesCount,
      totalAmount: receivablesTotal,
      overdueCount: overdueInvoiceCount,
      priority: getPriorityLevel(oldestInvoiceDate || new Date().toISOString(), overdueInvoiceCount > 0),
      ctaText: "Lihat Piutang",
      ctaHref: "/laporan?report=invoices&balance=outstanding",
      description: `${receivablesCount} invoice tagihan mahasiswa memiliki sisa kewajiban pembayaran (${overdueInvoiceCount} jatuh tempo).`,
    });
  }

  // Item 4: Outstanding Setoran UT (Owner, Finance Admin, Viewer)
  if ((userRole === "owner" || userRole === "finance_admin" || userRole === "viewer") && outstandingUtCount > 0) {
    allItems.push({
      category: "outstanding_ut",
      title: "Outstanding Setoran SALUT ke UT",
      count: outstandingUtCount,
      totalAmount: outstandingUtTotal,
      priority: getPriorityLevel(oldestUtLipDate || new Date().toISOString()),
      ctaText: "Lihat Setoran UT",
      ctaHref: "/setoran-ut?filter=outstanding",
      description: `${outstandingUtCount} LIP terverifikasi memiliki sisa kewajiban setoran resmi ke UT.`,
    });
  }

  // Item 5: Registrasi Draft (Owner, Academic Admin, Viewer)
  if ((userRole === "owner" || userRole === "academic_admin" || userRole === "viewer") && draftRegsCount > 0) {
    allItems.push({
      category: "draft_registrations",
      title: "Registrasi Draft Perlu Dilengkapi",
      count: draftRegsCount,
      academicPeriodName: draftPeriodName || undefined,
      priority: getPriorityLevel(oldestDraftRegDate || new Date().toISOString()),
      ctaText: "Lihat Registrasi",
      ctaHref: "/registrasi?status=draft",
      description: `${draftRegsCount} registrasi semester mahasiswa masih berstatus draft.`,
    });
  }

  const urgentCount = allItems.filter((i) => i.priority === "URGENT").length;
  const attentionCount = allItems.filter((i) => i.priority === "PERLU_PERHATIAN").length;
  const newCount = allItems.filter((i) => i.priority === "BARU").length;

  return {
    items: allItems,
    totalActionsCount: allItems.length,
    urgentCount,
    attentionCount,
    newCount,
  };
}
