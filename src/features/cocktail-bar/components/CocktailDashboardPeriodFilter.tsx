import type { DashboardPeriod } from "@/features/cocktail-bar/lib/dashboard";

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Vandaag" },
  { value: "7d", label: "7 dagen" },
  { value: "30d", label: "30 dagen" },
  { value: "all", label: "Alles" },
];

export function CocktailDashboardPeriodFilter({
  period,
  onChange,
}: {
  period: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-sm ${period === option.value ? "cb-button" : "cb-button-ghost"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
