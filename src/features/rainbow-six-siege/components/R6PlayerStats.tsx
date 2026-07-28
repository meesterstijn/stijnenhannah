import type { R6ScoreboardEntry } from "@/features/rainbow-six-siege/types";

function Stat({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/50 px-2 py-0.5 text-xs text-zinc-300">
      {value} {label}
    </span>
  );
}

export function R6PlayerStats({ entry }: { entry: R6ScoreboardEntry }) {
  const { totals } = entry;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Stat label="kills" value={totals.kills} />
        <Stat label="headshots" value={totals.headshots} />
        <Stat label="assists" value={totals.assists} />
        <Stat label="revives" value={totals.revives} />
        <Stat label="MVP's" value={totals.mvps} />
        <Stat label="clutches" value={totals.clutches} />
        <Stat label="aces" value={totals.aces} />
        <Stat label="challenges voltooid" value={totals.challengesCompleted} />
      </div>
    </div>
  );
}
