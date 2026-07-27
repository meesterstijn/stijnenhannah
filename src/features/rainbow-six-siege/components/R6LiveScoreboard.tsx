import type { R6ScoreboardEntry } from "@/features/rainbow-six-siege/types";

const RANK_MEDALS = ["🏆", "🥈", "🥉"];

// Compacte, realtime gesorteerde ranglijst voor bovenaan het live dashboard
// — geen stat-uitsplitsing hier (dat leidt af tijdens het spelen), alleen
// naam + positie + huidig totaal. De volledige uitsplitsing blijft
// beschikbaar via R6Scoreboard in het After Action Report.
export function R6LiveScoreboard({ entries }: { entries: R6ScoreboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">Nog geen spelers gekoppeld aan deze LAN.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry, index) => (
        <div
          key={entry.player.id}
          className="flex min-w-[8rem] flex-1 items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
        >
          <span className="truncate font-serif text-base font-semibold text-zinc-100">
            {RANK_MEDALS[index] ?? `#${index + 1}`} {entry.player.name}
          </span>
          <span className="shrink-0 font-serif text-2xl font-bold text-amber-400">{entry.totalPoints}</span>
        </div>
      ))}
    </div>
  );
}
