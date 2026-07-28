import { R6PlayerStats } from "@/features/rainbow-six-siege/components/R6PlayerStats";
import type { R6ScoreboardEntry } from "@/features/rainbow-six-siege/types";

const RANK_MEDALS = ["🏆", "🥈", "🥉"];

export function R6Scoreboard({
  entries,
  isFinal,
}: {
  entries: R6ScoreboardEntry[];
  isFinal: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">Nog geen spelers gekoppeld aan deze LAN.</p>;
  }

  const totalLabel = isFinal ? "Eindtotaal" : "Voorlopig totaal";

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.player.id}
          className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-serif text-lg font-semibold text-zinc-100">
              {RANK_MEDALS[index] ?? `#${index + 1}`} {entry.player.name}
            </p>
            <R6PlayerStats entry={entry} />
          </div>
          <div className="shrink-0 space-y-0.5 text-right">
            <p className="font-serif text-2xl font-semibold text-amber-400">
              {entry.totalPoints}
              <span className="ml-1 text-sm font-normal text-zinc-500">{totalLabel.toLowerCase()}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
