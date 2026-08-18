"use client";

import { useState, useActionState, useEffect } from "react";
import { SalutSettings } from "@/types/settings";
import { updateSettingsAction } from "@/features/settings/actions";
import { SettingsHeaderBanner } from "./settings-header-banner";
import { SalutIdentityCard } from "./salut-identity-card";
import { ReceiptInfoCard } from "./receipt-info-card";
import { DefaultFeeCard } from "./default-fee-card";
import { TimezoneCard } from "./timezone-card";
import { Save, CheckCircle2, ShieldAlert, AlertTriangle, X } from "lucide-react";

interface SettingsFormContainerProps {
  initialSettings: SalutSettings;
  isOwner: boolean;
  roleName: string;
}

export function SettingsFormContainer({
  initialSettings,
  isOwner,
  roleName,
}: SettingsFormContainerProps) {
  const [settings, setSettings] = useState<SalutSettings>(initialSettings);
  const [originalSettings, setOriginalSettings] = useState<SalutSettings>(initialSettings);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(updateSettingsAction, null);

  useEffect(() => {
    if (state?.success && state.message) {
      setToastMessage(state.message);
      setIsConfirmModalOpen(false);
      setOriginalSettings(settings);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    }
  }, [state, settings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const isDefaultFeeChanged =
    settings.default_salut_fee !== originalSettings.default_salut_fee;

  const handleSubmitAttempt = (e: React.FormEvent<HTMLFormElement>) => {
    if (isDefaultFeeChanged && !isConfirmModalOpen) {
      e.preventDefault();
      setIsConfirmModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold px-2 py-0.5"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Error Alert */}
      {state?.error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 shadow-sm">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Header Banner */}
      <SettingsHeaderBanner isOwner={isOwner} roleName={roleName} />

      {/* Settings Form */}
      <form action={formAction} onSubmit={handleSubmitAttempt} className="space-y-6">
        {/* Card 1: Identitas SALUT */}
        <SalutIdentityCard
          settings={settings}
          disabled={!isOwner || isPending}
          onChange={handleChange}
        />

        {/* Card 2: Dokumen & Kuitansi */}
        <ReceiptInfoCard
          settings={settings}
          disabled={!isOwner || isPending}
          onChange={handleChange}
        />

        {/* Card 3: Default Biaya Layanan */}
        <DefaultFeeCard
          settings={settings}
          disabled={!isOwner || isPending}
          onChange={handleChange}
        />

        {/* Card 4: Timezone */}
        <TimezoneCard />

        {/* Bottom Save Action Bar */}
        {isOwner ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 sticky bottom-4 z-20">
            <div className="text-slate-500 text-[11px]">
              {settings.updatedAt && (
                <span>
                  Terakhir diperbarui:{" "}
                  <strong className="text-slate-700">
                    {new Date(settings.updatedAt).toLocaleString("id-ID")}
                  </strong>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Pengaturan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-center font-medium">
            Anda login sebagai <strong>{roleName}</strong> (Mode Lihat Saja). Hanya role <strong>Owner / Pimpinan</strong> yang memiliki izin mengubah pengaturan sistem.
          </div>
        )}

        {/* Default Fee Change Confirmation Dialog */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Konfirmasi Perubahan Default Fee</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs text-slate-700">
                <p className="leading-relaxed">
                  Anda mengubah default biaya layanan SALUT dari{" "}
                  <strong className="font-mono">
                    Rp {originalSettings.default_salut_fee.toLocaleString("id-ID")}
                  </strong>{" "}
                  menjadi{" "}
                  <strong className="font-mono text-emerald-700">
                    Rp {settings.default_salut_fee.toLocaleString("id-ID")}
                  </strong>.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] leading-relaxed">
                  Perubahan nilai default HANYA akan berlaku pada pembuatan registrasi baru di masa mendatang. Histori registrasi dan invoice lama TIDAK akan berubah.
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const formElement = (e.target as HTMLElement).closest("form");
                    if (formElement) {
                      formElement.requestSubmit();
                    }
                  }}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 font-semibold rounded-lg shadow-sm transition"
                >
                  Ya, Lanjutkan Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
