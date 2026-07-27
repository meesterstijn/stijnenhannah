import type { R6ScoreboardEntry, R6ScoreRule } from "@/features/rainbow-six-siege/types";

function Stat({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/50 px-2 py-0.5 text-xs text-zinc-300">
      {value} {label}
    </span>
  );
}

const BONUS_CODES: { key: keyof R6ScoreboardEntry["bonuses"]; code: string; label: string }[] = [
  { key: "mostKills", code: "most_kills", label: "Meeste kills" },
  { key: "mostHeadshots", code: "most_headshots", label: "Meeste headshots" },
  { key: "mostAssists", code: "most_assists", label: "Meeste assists" },
  { key: "mostRevives", code: "most_revives", label: "Meeste revives" },
];

function rulePoints(rules: R6ScoreRule[], code: string): number {
  return rules.find((r) => r.code === code)?.points ?? 0;
}

export function R6PlayerStats({ entry, scoreRules }: { entry: R6ScoreboardEntry; scoreRules: R6ScoreRule[] }) {
  const { totals } = entry;
  const activeBonuses = BONUS_CODES.filter((b) => entry.bonuses[b.key]);

  return (
    <div className="space-y-2">
      {activeBonuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeBonuses.map((b) => (
            <span
              key={b.key}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400"
            >
              +{rulePoints(scoreRules, b.code)} {b.label}
            </span>
          ))}
        </div>
      )}
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
