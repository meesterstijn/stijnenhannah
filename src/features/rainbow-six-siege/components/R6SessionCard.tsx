import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import type { R6SessionSummary } from "@/features/rainbow-six-siege/hooks/useR6History";

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export function R6SessionCard({ summary }: { summary: R6SessionSummary }) {
  const { session, matchCount, scoreboard } = summary;
  const winner = scoreboard[0];
  const runnerUp = scoreboard[1];

  return (
    <Link
      to={`/rainbow-six-siege/lan/${session.id}`}
      className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-serif text-lg font-semibold text-zinc-100">{session.name}</p>
        <p className="text-sm text-zinc-400">
          {formatSessionDate(session.started_at)} · {matchCount} {matchCount === 1 ? "match" : "matches"}
        </p>
      </div>
      {winner && (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-amber-400" strokeWidth={1.75} />
          <span className="text-zinc-100">{winner.player.name}</span>
          <span className="text-zinc-500">
            {winner.totalPoints}
            {runnerUp ? ` - ${runnerUp.totalPoints}` : ""}
          </span>
        </div>
      )}
    </Link>
  );
}
