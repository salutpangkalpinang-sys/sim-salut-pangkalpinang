"use client";

import { useState, useTransition } from "react";
import {
  MasterAcademicPeriod,
  MasterFaculty,
  MasterStudyProgram,
  MasterServiceScheme,
  MasterStudentStatus,
  MasterFeeRate,
  MasterCashAccount,
} from "@/features/master-data/queries";
import {
  toggleAcademicPeriodActiveAction,
  createAcademicPeriodAction,
  createCashAccountAction,
  updateCashAccountAction,
  toggleCashAccountActiveAction,
} from "@/features/master-data/actions";

import { RoleCode, hasPermission } from "@/lib/auth/types";
import {
  Calendar,
  GraduationCap,
  Layers,
  CheckCircle2,
  Plus,
  DollarSign,
  UserCheck,
  Wallet,
  Edit2,
  X,
} from "lucide-react";

interface MasterDataContainerProps {
  data: {
    academicPeriods: MasterAcademicPeriod[];
    faculties: MasterFaculty[];
    studyPrograms: MasterStudyProgram[];
    serviceSchemes: MasterServiceScheme[];
    studentStatuses: MasterStudentStatus[];
    feeRates: MasterFeeRate[];
    cashAccounts?: MasterCashAccount[];
  };
  userRole: RoleCode;
}

export function MasterDataContainer({ data, userRole }: MasterDataContainerProps) {
  const [activeTab, setActiveTab] = useState<
    "periods" | "programs" | "schemes" | "statuses" | "rates" | "accounts"
  >("periods");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for Periode Akademik
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodCode, setNewPeriodCode] = useState("");
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newPeriodTerm, setNewPeriodTerm] = useState("Ganjil");

  // Form state for Rekening Kas & Bank
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBankName, setNewBankName] = useState("");

  const [editingAccount, setEditingAccount] = useState<MasterCashAccount | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editBankName, setEditBankName] = useState("");

  const canManageAcademic = hasPermission(userRole, ["owner", "academic_admin"]);
  const canManageCash = hasPermission(userRole, ["owner", "finance_admin", "academic_admin"]);

  const cashAccountsList = data.cashAccounts || [];

  const handleTogglePeriod = (periodId: string, currentActive: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const res = await toggleAcademicPeriodActiveAction(periodId, !currentActive);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Status periode akademik berhasil diperbarui." });
      }
    });
  };

  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createAcademicPeriodAction(newPeriodCode, newPeriodName, newPeriodTerm);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Periode akademik baru berhasil ditambahkan." });
        setShowAddPeriod(false);
        setNewPeriodCode("");
        setNewPeriodName("");
      }
    });
  };

  // Cash account handlers
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createCashAccountAction({
        code: newAccountCode,
        name: newAccountName,
        accountNumber: newAccountNumber,
        bankName: newBankName,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Rekening/Kas baru berhasil ditambahkan." });
        setShowAddAccount(false);
        setNewAccountCode("");
        setNewAccountName("");
        setNewAccountNumber("");
        setNewBankName("");
      }
    });
  };

  const handleOpenEditAccount = (acc: MasterCashAccount) => {
    setEditingAccount(acc);
    setEditAccountName(acc.name);
    setEditAccountNumber(acc.accountNumber || "");
    setEditBankName(acc.bankName || "");
  };

  const handleUpdateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateCashAccountAction({
        id: editingAccount.id,
        name: editAccountName,
        accountNumber: editAccountNumber,
        bankName: editBankName,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Data rekening berhasil diperbarui." });
        setEditingAccount(null);
      }
    });
  };

  const handleToggleAccount = (id: string, currentActive: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const res = await toggleCashAccountActiveAction(id, !currentActive);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Status keaktifan rekening berhasil diperbarui." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-900">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Master Data Akademik & Kas/Rekening
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan periode akademik, program studi, skema layanan, status mahasiswa, master tarif, dan rekening kas/bank SALUT
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="border-b border-slate-200 flex overflow-x-auto gap-2 text-xs font-medium pb-px">
        <button
          onClick={() => setActiveTab("periods")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "periods"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Periode Akademik ({data.academicPeriods.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "accounts"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-600" />
          <span>Rekening Kas & Bank ({cashAccountsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("programs")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "programs"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Program Studi ({data.studyPrograms.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("schemes")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "schemes"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Skema Layanan ({data.serviceSchemes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("statuses")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "statuses"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Status Mahasiswa ({data.studentStatuses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("rates")}
          className={`px-4 py-2.5 rounded-t-lg flex items-center gap-2 border-b-2 transition ${
            activeTab === "rates"
              ? "border-blue-600 text-blue-600 bg-blue-50 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Master Tarif ({data.feeRates.length})</span>
        </button>
      </div>

      {/* Tab 1: Periode Akademik */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Daftar Periode Akademik</h3>
            {canManageAcademic && (
              <button
                onClick={() => setShowAddPeriod(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Periode</span>
              </button>
            )}
          </div>

          {showAddPeriod && (
            <form onSubmit={handleCreatePeriod} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900">Tambah Periode Akademik Baru</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1">Kode Periode (cth: 20262)</label>
                  <input
                    type="text"
                    required
                    value={newPeriodCode}
                    onChange={(e) => setNewPeriodCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Nama Periode</label>
                  <input
                    type="text"
                    required
                    placeholder="2026/2027 Genap"
                    value={newPeriodName}
                    onChange={(e) => setNewPeriodName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Semester/Term</label>
                  <select
                    value={newPeriodTerm}
                    onChange={(e) => setNewPeriodTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                    <option value="Pendek">Pendek</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPeriod(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs"
                >
                  Simpan Periode
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Periode</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Status Aktif</th>
                  {canManageAcademic && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.academicPeriods.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.term || "-"}</td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Aktif Berjalan
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                          Tidak Aktif
                        </span>
                      )}
                    </td>
                    {canManageAcademic && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleTogglePeriod(p.id, p.isActive)}
                          disabled={isPending}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                            p.isActive
                              ? "bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                          }`}
                        >
                          {p.isActive ? "Nonaktifkan" : "Set Aktif"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Rekening Kas & Bank */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Daftar Rekening Bank & Kas SALUT</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola nomor rekening bank dan akun kas penerima/sumber dana transaksi finansial.
              </p>
            </div>
            {canManageCash && (
              <button
                onClick={() => setShowAddAccount(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Rekening / Kas</span>
              </button>
            )}
          </div>

          {/* Form Modal Tambah Rekening */}
          {showAddAccount && (
            <form onSubmit={handleCreateAccount} className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-900">Tambah Akun Kas / Rekening Baru</h4>
                <button type="button" onClick={() => setShowAddAccount(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Kode Akun (cth: BANK_MANDIRI)</label>
                  <input
                    type="text"
                    required
                    placeholder="BANK_BSI"
                    value={newAccountCode}
                    onChange={(e) => setNewAccountCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Tampilan Rekening</label>
                  <input
                    type="text"
                    required
                    placeholder="Rekening Bank BSI SALUT"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Bank (opsional)</label>
                  <input
                    type="text"
                    placeholder="Bank Syariah Indonesia"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nomor Rekening (opsional)</label>
                  <input
                    type="text"
                    placeholder="7123456789"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-xs"
                >
                  Simpan Rekening
                </button>
              </div>
            </form>
          )}

          {/* Form Modal Edit Rekening */}
          {editingAccount && (
            <form onSubmit={handleUpdateAccount} className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-900">
                  Edit Rekening: <span className="font-mono text-blue-700">{editingAccount.code}</span>
                </h4>
                <button type="button" onClick={() => setEditingAccount(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Tampilan Rekening</label>
                  <input
                    type="text"
                    required
                    value={editAccountName}
                    onChange={(e) => setEditAccountName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Bank</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bank Central Asia"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    placeholder="Nomor rekening bank"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          )}

          {/* Table Kas Accounts */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Rekening / Akun Kas</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Nomor Rekening</th>
                  <th className="px-4 py-3">Status</th>
                  {canManageCash && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashAccountsList.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{acc.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{acc.name}</td>
                    <td className="px-4 py-3 text-slate-600">{acc.bankName || "-"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {acc.accountNumber ? acc.accountNumber : <span className="text-slate-400 font-normal">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {acc.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                          Tidak Aktif
                        </span>
                      )}
                    </td>
                    {canManageCash && (
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditAccount(acc)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleToggleAccount(acc.id, acc.isActive)}
                          disabled={isPending}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                            acc.isActive
                              ? "bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-300"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          }`}
                        >
                          {acc.isActive ? "Nonaktifkan" : "Set Aktif"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Program Studi */}
      {activeTab === "programs" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Daftar Program Studi UT</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Kode Prodi</th>
                  <th className="px-4 py-3">Nama Program Studi</th>
                  <th className="px-4 py-3">Fakultas</th>
                  <th className="px-4 py-3">Jenjang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.studyPrograms.map((prog) => (
                  <tr key={prog.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{prog.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{prog.name}</td>
                    <td className="px-4 py-3 text-slate-500">{prog.facultyName || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{prog.studyLevelName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Skema Layanan */}
      {activeTab === "schemes" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Daftar Skema Layanan UT & SALUT</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.serviceSchemes.map((scheme) => (
              <div key={scheme.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {scheme.code}
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {scheme.category}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{scheme.name}</h4>
                <p className="text-xs text-slate-500">{scheme.description || "Tidak ada deskripsi"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Status Mahasiswa */}
      {activeTab === "statuses" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Daftar Status Mahasiswa</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.studentStatuses.map((st) => (
              <div key={st.id} className="bg-white border border-slate-200 rounded-xl p-3 text-center space-y-1 shadow-sm">
                <span className="font-mono text-[10px] uppercase text-slate-400 block">{st.code}</span>
                <span className="text-xs font-bold text-slate-900 block">{st.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Master Tarif */}
      {activeTab === "rates" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Daftar Master Tarif (Snapshot Estimasi & Validasi)</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Jenis Biaya</th>
                  <th className="px-4 py-3">Program Studi</th>
                  <th className="px-4 py-3">Skema Layanan</th>
                  <th className="px-4 py-3">Tipe Perhitungan</th>
                  <th className="px-4 py-3 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.feeRates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{rate.feeTypeName || "Layanan SALUT"}</td>
                    <td className="px-4 py-3 text-slate-500">{rate.studyProgramName || "Semua Prodi"}</td>
                    <td className="px-4 py-3 text-slate-500">{rate.serviceSchemeName || "Semua Skema"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{rate.calculationType}</td>
                    <td className="px-4 py-3 font-mono text-right font-bold text-emerald-600">
                      Rp {rate.amount.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
