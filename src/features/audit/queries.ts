import { createClient } from "@/lib/supabase/server";
import { AuditLogItem, AuditSummary, AuditFilter, PaginatedAuditResult } from "@/types/audit";
import { RoleCode } from "@/lib/auth/types";
import { formatWibTimestamp, sanitizeAuditPayload, maskNikInText } from "@/lib/audit/redaction";

const ROLE_LABELS: Record<RoleCode, string> = {
  owner: "Owner / Pimpinan",
  academic_admin: "Admin Akademik",
  finance_admin: "Admin Keuangan / Kasir",
  viewer: "Viewer / Auditor",
};

const ACTION_MODULE_MAP: Record<string, { module: string; moduleLabel: string; actionLabel: string }> = {
  // User Management
  user_invited: { module: "user_management", moduleLabel: "Pengguna & Hak Akses", actionLabel: "Undangan Pengguna Baru" },
  user_created: { module: "user_management", moduleLabel: "Pengguna & Hak Akses", actionLabel: "Pendaftaran Pengguna" },
  user_role_changed: { module: "user_management", moduleLabel: "Pengguna & Hak Akses", actionLabel: "Perubahan Role Pengguna" },
  user_deactivated: { module: "user_management", moduleLabel: "Pengguna & Hak Akses", actionLabel: "Penonaktifan Akses Pengguna" },
  user_reactivated: { module: "user_management", moduleLabel: "Pengguna & Hak Akses", actionLabel: "Pengaktifan Kembali Akses" },

  // Student
  student_status_changed: { module: "academic_student", moduleLabel: "Akademik & Mahasiswa", actionLabel: "Perubahan Status Mahasiswa" },

  // Registration
  registration_created: { module: "registration", moduleLabel: "Registrasi Semester", actionLabel: "Registrasi SKS Baru" },
  registration_cancelled: { module: "registration", moduleLabel: "Registrasi Semester", actionLabel: "Pembatalan Registrasi" },

  // LIP & Invoice
  lip_created: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Upload / Input LIP Baru" },
  lip_verified: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Verifikasi LIP UT Resmi" },
  lip_cancelled: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Pembatalan LIP UT" },
  invoice_created: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Penerbitan Invoice Tagihan" },
  invoice_cancelled: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Pembatalan Invoice Tagihan" },
  discount_approved: { module: "lip_invoice", moduleLabel: "LIP & Tagihan", actionLabel: "Persetujuan Diskon Internal" },

  // Payments
  payment_created: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Pencatatan Pembayaran" },
  payment_verified: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Verifikasi Pembayaran" },
  payment_rejected: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Penolakan Pembayaran" },
  payment_void_requested: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Pengajuan Void Pembayaran" },
  payment_void_approved: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Persetujuan Void Pembayaran" },
  payment_void_rejected: { module: "payments", moduleLabel: "Pembayaran Mahasiswa", actionLabel: "Penolakan Void Pembayaran" },

  // UT Remittances
  ut_remittance_created: { module: "ut_remittances", moduleLabel: "Setoran UT", actionLabel: "Pencatatan Setoran UT" },
  ut_remittance_verified: { module: "ut_remittances", moduleLabel: "Setoran UT", actionLabel: "Verifikasi Setoran UT" },
  ut_remittance_rejected: { module: "ut_remittances", moduleLabel: "Setoran UT", actionLabel: "Penolakan Setoran UT" },
  ut_remittance_void_approved: { module: "ut_remittances", moduleLabel: "Setoran UT", actionLabel: "Persetujuan Void Setoran UT" },

  // Operational
  operational_transaction_created: { module: "operational", moduleLabel: "Kas & Operasional", actionLabel: "Pencatatan Transaksi Kas" },
  operational_transaction_verified: { module: "operational", moduleLabel: "Kas & Operasional", actionLabel: "Verifikasi Transaksi Kas" },
  operational_transaction_rejected: { module: "operational", moduleLabel: "Kas & Operasional", actionLabel: "Penolakan Transaksi Kas" },
  operational_transaction_void_approved: { module: "operational", moduleLabel: "Kas & Operasional", actionLabel: "Persetujuan Void Transaksi Kas" },
};

// Comprehensive mock database store for audit events
const MOCK_AUDIT_STORE: AuditLogItem[] = [
  {
    id: "aud-001",
    actorUserId: "usr-owner-001",
    actorName: "Owner SIM-SALUT",
    actorEmail: "admin@salut-pangkalpinang.ac.id",
    actorRole: "owner",
    actorRoleName: "Owner / Pimpinan",
    action: "payment_verified",
    actionLabel: "Verifikasi Pembayaran",
    module: "payments",
    moduleLabel: "Pembayaran Mahasiswa",
    entityType: "student_payments",
    entityId: "pay-1002",
    summary: "Verifikasi pembayaran mahasiswa Rp 2.500.000 (INV-20261-008)",
    oldData: { status: "menunggu_verifikasi" },
    newData: { status: "terverifikasi", verifiedAt: "2026-08-15T11:20:00Z" },
    reason: "Bukti transfer sesuai dengan rekening bank SALUT",
    metadata: { referenceNumber: "TRX-BNI-88219" },
    createdAt: new Date("2026-08-15T11:20:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-15T11:20:00Z"),
  },
  {
    id: "aud-002",
    actorUserId: "usr-owner-001",
    actorName: "Owner SIM-SALUT",
    actorEmail: "admin@salut-pangkalpinang.ac.id",
    actorRole: "owner",
    actorRoleName: "Owner / Pimpinan",
    action: "user_invited",
    actionLabel: "Undangan Pengguna Baru",
    module: "user_management",
    moduleLabel: "Pengguna & Hak Akses",
    entityType: "user",
    entityId: "usr-finance-002",
    summary: "Penambahan pengguna baru Siti Rahma (keuangan@salut-pangkalpinang.ac.id) sebagai Admin Keuangan",
    oldData: null,
    newData: { fullName: "Siti Rahma", email: "keuangan@salut-pangkalpinang.ac.id", role: "finance_admin" },
    reason: "Penugasan kasir keuangan operasional semester 20261",
    metadata: null,
    createdAt: new Date("2026-08-15T10:15:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-15T10:15:00Z"),
  },
  {
    id: "aud-003",
    actorUserId: "usr-academic-001",
    actorName: "Budi Santoso",
    actorEmail: "akademik@salut-pangkalpinang.ac.id",
    actorRole: "academic_admin",
    actorRoleName: "Admin Akademik",
    action: "student_status_changed",
    actionLabel: "Perubahan Status Mahasiswa",
    module: "academic_student",
    moduleLabel: "Akademik & Mahasiswa",
    entityType: "students",
    entityId: "std-001",
    summary: "Perubahan status mahasiswa Hendra Wijaya (NIM: 041234567, NIK: 3671011508980001) dari CALON ke AKTIFF",
    oldData: { status: "CALON" },
    newData: { status: "AKTIFF" },
    reason: "Persyaratan berkas fisik pendaftaran telah lengkap dan diverifikasi",
    metadata: { nim: "041234567" },
    createdAt: new Date("2026-08-14T15:45:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-14T15:45:00Z"),
  },
  {
    id: "aud-004",
    actorUserId: "usr-owner-001",
    actorName: "Owner SIM-SALUT",
    actorEmail: "admin@salut-pangkalpinang.ac.id",
    actorRole: "owner",
    actorRoleName: "Owner / Pimpinan",
    action: "discount_approved",
    actionLabel: "Persetujuan Diskon Internal",
    module: "lip_invoice",
    moduleLabel: "LIP & Tagihan",
    entityType: "invoices",
    entityId: "inv-20261-002",
    summary: "Persetujuan potongan biaya internal Rp 100.000 untuk tagihan mahasiswa S1 Manajemen",
    oldData: { discountAmount: 0 },
    newData: { discountAmount: 100000, isApproved: true },
    reason: "Diskon Beasiswa Jalur Kemitraan SALUT",
    metadata: null,
    createdAt: new Date("2026-08-14T14:10:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-14T14:10:00Z"),
  },
  {
    id: "aud-005",
    actorUserId: "usr-finance-001",
    actorName: "Siti Rahma",
    actorEmail: "keuangan@salut-pangkalpinang.ac.id",
    actorRole: "finance_admin",
    actorRoleName: "Admin Keuangan / Kasir",
    action: "ut_remittance_verified",
    actionLabel: "Verifikasi Setoran UT",
    module: "ut_remittances",
    moduleLabel: "Setoran UT",
    entityType: "ut_remittances",
    entityId: "rem-20261-001",
    summary: "Verifikasi setoran SALUT ke UT sebesar Rp 4.500.000 (Bank Mandiri UT)",
    oldData: { status: "draft" },
    newData: { status: "terverifikasi" },
    reason: "Slip bukti transfer bank resmi UT telah divalidasi",
    metadata: null,
    createdAt: new Date("2026-08-13T09:30:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-13T09:30:00Z"),
  },
  {
    id: "aud-006",
    actorUserId: "usr-finance-001",
    actorName: "Siti Rahma",
    actorEmail: "keuangan@salut-pangkalpinang.ac.id",
    actorRole: "finance_admin",
    actorRoleName: "Admin Keuangan / Kasir",
    action: "operational_transaction_created",
    actionLabel: "Pencatatan Transaksi Kas",
    module: "operational",
    moduleLabel: "Kas & Operasional",
    entityType: "operational_transactions",
    entityId: "ops-001",
    summary: "Pencatatan pengeluaran kas operasional Rp 350.000 (Pembelian ATK Kantor SALUT)",
    oldData: null,
    newData: { amount: 350000, category: "ATK & Cetak", transactionType: "expense" },
    reason: "Pengadaan kertas A4 dan tinta printer operasional pendaftaran",
    metadata: null,
    createdAt: new Date("2026-08-12T16:00:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-12T16:00:00Z"),
  },
  {
    id: "aud-007",
    actorUserId: "usr-owner-001",
    actorName: "Owner SIM-SALUT",
    actorEmail: "admin@salut-pangkalpinang.ac.id",
    actorRole: "owner",
    actorRoleName: "Owner / Pimpinan",
    action: "user_role_changed",
    actionLabel: "Perubahan Role Pengguna",
    module: "user_management",
    moduleLabel: "Pengguna & Hak Akses",
    entityType: "role",
    entityId: "usr-academic-001",
    summary: "Perubahan peran pengguna Budi Santoso dari viewer ke academic_admin",
    oldData: { role: "viewer" },
    newData: { role: "academic_admin" },
    reason: "Promosi staf administrasi akademik resmi",
    metadata: null,
    createdAt: new Date("2026-08-10T10:00:00Z").toISOString(),
    createdAtWib: formatWibTimestamp("2026-08-10T10:00:00Z"),
  },
];

export async function getAuditLogsList(filter?: AuditFilter): Promise<PaginatedAuditResult> {
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  let items: AuditLogItem[] = [];

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();

      let query = supabase
        .from("audit_logs")
        .select(`
          id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          old_data,
          new_data,
          reason,
          metadata,
          created_at,
          profiles:actor_user_id (
            full_name,
            user_roles (
              roles (code)
            )
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (filter?.action && filter.action !== "ALL") {
        query = query.eq("action", filter.action);
      }

      if (filter?.startDate) {
        query = query.gte("created_at", filter.startDate);
      }

      if (filter?.endDate) {
        query = query.lte("created_at", filter.endDate);
      }

      const { data: dbLogs, error } = await query;

      if (!error && dbLogs) {
        items = dbLogs.map((log) => {
          const profileObj = log.profiles as unknown as { full_name?: string; user_roles?: Array<{ roles?: { code?: RoleCode } }> };
          const actorName = profileObj?.full_name || "Sistem / Anonymous";
          const roleCode: RoleCode = profileObj?.user_roles?.[0]?.roles?.code || "viewer";

          const actionMeta = ACTION_MODULE_MAP[log.action] || {
            module: "system",
            moduleLabel: "Sistem",
            actionLabel: log.action,
          };

          return {
            id: log.id,
            actorUserId: log.actor_user_id,
            actorName,
            actorEmail: `${roleCode}@salut-pangkalpinang.ac.id`,
            actorRole: roleCode,
            actorRoleName: ROLE_LABELS[roleCode] || "Pengguna",
            action: log.action,
            actionLabel: actionMeta.actionLabel,
            module: actionMeta.module,
            moduleLabel: actionMeta.moduleLabel,
            entityType: log.entity_type,
            entityId: log.entity_id,
            summary: maskNikInText(log.reason || `Aksi ${actionMeta.actionLabel} pada ${log.entity_type}`),
            oldData: sanitizeAuditPayload(log.old_data as Record<string, unknown>),
            newData: sanitizeAuditPayload(log.new_data as Record<string, unknown>),
            reason: maskNikInText(log.reason || ""),
            metadata: sanitizeAuditPayload(log.metadata as Record<string, unknown>),
            createdAt: log.created_at,
            createdAtWib: formatWibTimestamp(log.created_at),
          };
        });
      }
    } catch {
      // Supabase fallback
    }
  }

  if (items.length === 0) {
    // Sanitize mock store items
    items = MOCK_AUDIT_STORE.map((item) => ({
      ...item,
      summary: maskNikInText(item.summary),
      oldData: sanitizeAuditPayload(item.oldData),
      newData: sanitizeAuditPayload(item.newData),
      reason: item.reason ? maskNikInText(item.reason) : null,
      metadata: sanitizeAuditPayload(item.metadata),
    }));
  }

  // Filter application
  let filtered = [...items];

  if (filter) {
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.actorName.toLowerCase().includes(q) ||
          i.actorEmail.toLowerCase().includes(q) ||
          (i.entityId && i.entityId.toLowerCase().includes(q)) ||
          i.summary.toLowerCase().includes(q) ||
          i.actionLabel.toLowerCase().includes(q)
      );
    }

    if (filter.module && filter.module !== "ALL") {
      filtered = filtered.filter((i) => i.module === filter.module);
    }

    if (filter.action && filter.action !== "ALL") {
      filtered = filtered.filter((i) => i.action === filter.action);
    }

    if (filter.role && filter.role !== "ALL") {
      filtered = filtered.filter((i) => i.actorRole === filter.role);
    }

    if (filter.startDate) {
      const startMs = new Date(filter.startDate).getTime();
      filtered = filtered.filter((i) => new Date(i.createdAt).getTime() >= startMs);
    }

    if (filter.endDate) {
      const endMs = new Date(filter.endDate).getTime() + 86400000; // Include full end day
      filtered = filtered.filter((i) => new Date(i.createdAt).getTime() <= endMs);
    }
  }

  // Database-side / Server-side pagination
  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 15;
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const startIndex = (page - 1) * pageSize;
  const paginatedData = filtered.slice(startIndex, startIndex + pageSize);

  return {
    data: paginatedData,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export async function getAuditLogsSummary(): Promise<AuditSummary> {
  const result = await getAuditLogsList({ pageSize: 1000 });
  const all = result.data;

  const nowMs = Date.now();
  const startOfDayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const sevenDaysAgoMs = nowMs - 7 * 86400000;

  const todayCount = all.filter((i) => new Date(i.createdAt).getTime() >= startOfDayMs).length;
  const last7DaysCount = all.filter((i) => new Date(i.createdAt).getTime() >= sevenDaysAgoMs).length;

  const userChangesCount = all.filter((i) => i.module === "user_management").length;
  const financialActivitiesCount = all.filter((i) =>
    ["payments", "ut_remittances", "operational", "lip_invoice"].includes(i.module)
  ).length;

  return {
    todayCount,
    last7DaysCount,
    userChangesCount,
    financialActivitiesCount,
  };
}

export function getMockAuditStore(): AuditLogItem[] {
  return MOCK_AUDIT_STORE;
}
