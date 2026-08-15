"use client";

import { AuditLogItem } from "@/types/audit";
import { History, X, Clock, User, ShieldCheck, Tag, FileText, ArrowRight } from "lucide-react";

interface AuditDetailModalProps {
  item: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailModal({ item, isOpen, onClose }: AuditDetailModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
              <History className="w-4 h-4" />
            </div>
            <span>Rincian Jejak Audit (Audit Trail Detail)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Timestamp & Module Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">Waktu Eksekusi (WIB):</span>
              </div>
              <p className="font-bold font-mono text-slate-900 text-sm pl-5">{item.createdAtWib}</p>

              <div className="flex items-center gap-1.5 text-slate-500 font-medium pt-2 border-t border-slate-200">
                <Tag className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">Modul & Jenis Aksi:</span>
              </div>
              <div className="pl-5 space-y-0.5">
                <span className="font-semibold text-purple-700 block">{item.moduleLabel}</span>
                <span className="text-slate-800 font-medium">{item.actionLabel}</span>
              </div>
            </div>

            {/* Actor Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">Pelaku Aktivitas (Actor):</span>
              </div>
              <div className="pl-5 space-y-0.5">
                <span className="font-bold text-slate-900 block">{item.actorName}</span>
                <span className="text-slate-500 font-mono text-[11px] block">{item.actorEmail}</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 font-medium pt-2 border-t border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">Peran Hak Akses (Role):</span>
              </div>
              <p className="font-semibold text-slate-800 pl-5">{item.actorRoleName}</p>
            </div>
          </div>

          {/* Entity & Summary Banner */}
          <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-purple-200/60 pb-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span className="font-bold text-purple-900">Entity: {item.entityType}</span>
              </div>
              {item.entityId && (
                <span className="px-2 py-0.5 bg-white border border-purple-300 text-purple-800 font-mono text-[11px] rounded-md font-semibold">
                  ID: {item.entityId}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-purple-700 font-mono uppercase font-bold">Ringkasan Aktivitas</span>
              <p className="text-slate-800 leading-relaxed font-medium">{item.summary}</p>
            </div>
          </div>

          {/* Before vs After JSON Comparison (If Available) */}
          {(item.oldData || item.newData) && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-xs block">
                Perubahan Data (Before vs After)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Before (Old Data) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-t-lg">
                    <span>Sebelum (Old Value)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-b-lg overflow-x-auto max-h-48 leading-relaxed">
                    {item.oldData ? JSON.stringify(item.oldData, null, 2) : "// Tidak ada data awal"}
                  </pre>
                </div>

                {/* After (New Data) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-t-lg">
                    <ArrowRight className="w-3 h-3 text-emerald-600" />
                    <span>Sesudah (New Value)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-b-lg overflow-x-auto max-h-48 leading-relaxed">
                    {item.newData ? JSON.stringify(item.newData, null, 2) : "// Tidak ada data baru"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Read-Only Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            Audit Log bersifat Read-Only & Immutability Protected
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
