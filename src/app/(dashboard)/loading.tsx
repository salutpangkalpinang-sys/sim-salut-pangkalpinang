export default function DashboardLoading() {
  return (
    <div className="space-y-6 text-xs text-slate-900 animate-in fade-in duration-150">
      {/* Top Animated Progress Line */}
      <div className="w-full bg-slate-200 h-1 overflow-hidden rounded-full relative">
        <div className="bg-blue-600 h-full w-1/3 rounded-full animate-[pulse_1s_ease-in-out_infinite] translate-x-0" />
      </div>

      {/* Header Banner Skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-md" />
          <div className="h-3 w-80 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-lg self-start md:self-auto" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-200 rounded-md" />
              <div className="w-8 h-8 rounded-lg bg-slate-100" />
            </div>
            <div className="h-7 w-32 bg-slate-300 rounded-md" />
            <div className="h-3 w-20 bg-slate-100 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content / Table Container Skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-pulse">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="h-4 w-40 bg-slate-200 rounded-md" />
          <div className="h-8 w-28 bg-slate-100 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                <div className="space-y-1 w-full">
                  <div className="h-3 w-3/4 bg-slate-200 rounded-md" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="h-3 w-20 bg-slate-100 rounded-md" />
              <div className="h-3 w-24 bg-slate-200 rounded-md" />
              <div className="h-6 w-16 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
