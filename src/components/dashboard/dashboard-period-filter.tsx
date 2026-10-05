"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar } from "lucide-react";

interface AcademicPeriod {
  id: string;
  name: string;
  code: string;
}

interface DashboardPeriodFilterProps {
  periods: AcademicPeriod[];
  selectedPeriodId?: string;
}

export function DashboardPeriodFilter({
  periods,
  selectedPeriodId = "",
}: DashboardPeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePeriodChange = (newPeriodId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPeriodId) {
      params.set("periodId", newPeriodId);
    } else {
      params.delete("periodId");
    }
    router.push(`/dashboard?${params.toString()}`);
  };

  const options = [
    { value: "", label: "Semua Periode Akademik" },
    ...periods.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: p.code,
    })),
  ];

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg shadow-xs min-w-[260px]">
      <Calendar className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
      <div className="flex-1">
        <SearchableSelect
          options={options}
          value={selectedPeriodId}
          onChange={handlePeriodChange}
          placeholder="Pilih Periode..."
          size="sm"
          className="w-full"
          triggerClassName="border-0 bg-transparent py-1 shadow-none focus:ring-0"
        />
      </div>
    </div>
  );
}
