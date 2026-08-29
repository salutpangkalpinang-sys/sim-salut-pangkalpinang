"use client";

import { useState, useTransition } from "react";
import { UserItem, UserSummary, UserFilter } from "@/types/user";
import { fetchUsersListAction, fetchUsersSummaryAction } from "@/features/users/actions";
import { UserSummaryCards } from "./user-summary-cards";
import { UserFilterBar } from "./user-filter";
import { UserTable } from "./user-table";
import { UserFormModal } from "./user-form-modal";
import { ChangeRoleDialog } from "./change-role-dialog";
import { ToggleStatusDialog } from "./toggle-status-dialog";
import { UserPlus, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";

interface UserListContainerProps {
  initialUsers: UserItem[];
  initialSummary: UserSummary;
  currentUserId: string;
}

export function UserListContainer({
  initialUsers,
  initialSummary,
  currentUserId,
}: UserListContainerProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [summary, setSummary] = useState<UserSummary>(initialSummary);
  const [filter, setFilter] = useState<UserFilter>({ search: "", role: "ALL", status: "ALL" });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserItem | null>(null);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<UserItem | null>(null);
  const [statusTargetActive, setStatusTargetActive] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = async (newFilter?: UserFilter) => {
    const activeFilter = newFilter !== undefined ? newFilter : filter;
    setIsLoading(true);
    try {
      const [updatedUsers, updatedSummary] = await Promise.all([
        fetchUsersListAction(activeFilter),
        fetchUsersSummaryAction(),
      ]);
      setUsers(updatedUsers);
      setSummary(updatedSummary);
    } catch (err) {
      console.warn("Failed to refresh user data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilter: UserFilter) => {
    setFilter(newFilter);
    refreshData(newFilter);
  };

  const handleActionSuccess = (message: string) => {
    setToastMessage(message);
    refreshData();
  };

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setToastMessage(null);
            }}
            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 text-xs font-bold px-2 py-1 rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0 font-bold">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pengguna & Hak Akses (User Management)
            </h1>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Pengelolaan akun pengguna internal pengelola SALUT Pangkalpinang, penugasan peran (*role*), serta kontrol aktivasi hak akses berbasis server-side security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refreshData()}
            disabled={isLoading}
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition disabled:opacity-50"
            title="Refresh Data Pengguna"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <UserSummaryCards summary={summary} />

      {/* Search & Filter Bar */}
      <UserFilterBar filter={filter} onFilterChange={handleFilterChange} />

      {/* User Table */}
      <UserTable
        users={users}
        currentUserId={currentUserId}
        onEditRole={(user) => setSelectedUserForRole(user)}
        onToggleStatus={(user, targetActive) => {
          setSelectedUserForStatus(user);
          setStatusTargetActive(targetActive);
        }}
      />

      {/* Modals & Dialogs */}
      <UserFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleActionSuccess}
      />

      <ChangeRoleDialog
        user={selectedUserForRole}
        isOpen={Boolean(selectedUserForRole)}
        onClose={() => setSelectedUserForRole(null)}
        onSuccess={handleActionSuccess}
      />

      <ToggleStatusDialog
        user={selectedUserForStatus}
        targetIsActive={statusTargetActive}
        isOpen={Boolean(selectedUserForStatus)}
        onClose={() => setSelectedUserForStatus(null)}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
