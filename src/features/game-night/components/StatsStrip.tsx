import type { LucideIcon } from "lucide-react";

export type StatItem = {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Section 23 vraagt expliciet om in de code duidelijk te maken wat mock/
   * placeholderdata is — puur informatief, geen visueel "MOCK"-label. */
  isMock: boolean;
};

// Onderpaneel "Statistieken" (section 11).
export function StatsStrip({ stats }: { stats: StatItem[] }) {
  return (
    <div className="gn-panel-info flex h-full flex-col px-4 py-3.5">
      <p className="gn-eyebrow mb-2.5">Statistieken</p>
      <div className="grid flex-1 grid-cols-4 place-items-center gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col items-center text-center"
            >
              <Icon
                className="mb-1 h-4 w-4"
                style={{ color: "var(--gn-brass)" }}
                strokeWidth={1.7}
              />
              <p className="gn-display text-xl font-semibold sm:text-2xl">
                {stat.value}
              </p>
              <p className="gn-faint text-[10px] leading-tight">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
