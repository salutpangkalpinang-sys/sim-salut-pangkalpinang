import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">404</h1>
        <h2 className="text-base font-bold text-slate-800">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Halaman yang Anda cari tidak ditemukan atau telah dipindahkan. Silakan kembali ke Dashboard SIM-SALUT.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
