import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import {
  buildGameNightSummaries,
  type GameNightSummary,
} from "@/features/game-night/lib/gameNightStats";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { getGameCoverUrl } from "@/features/game-night/lib/gameCoverStorage";
import { placeholderCoverGradient } from "@/features/game-night/lib/gameCoverPlaceholder";

function GameNightCard({ summary }: { summary: GameNightSummary }) {
  const date = new Date(summary.session.started_at).toLocaleDateString(
    "nl-NL",
    { day: "numeric", month: "long", year: "numeric" },
  );

  return (
    <Link
      to={`/game-night/geschiedenis/${summary.session.id}`}
      className="gn-panel-elevated block px-5 py-4 transition-colors hover:border-[var(--gn-brass)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="gn-eyebrow">{date.toUpperCase()}</p>
          <p className="mt-1 truncate text-sm font-medium">
            {summary.attendees.map((p) => p.name).join(" · ") || "Geen spelers"}
          </p>
        </div>
        {summary.isActive && (
          <span className="gn-chip gn-chip-felt shrink-0">BEZIG</span>
        )}
      </div>

      <p className="gn-muted mt-2.5 text-xs">
        {summary.gameSessionCount}{" "}
        {summary.gameSessionCount === 1 ? "spel" : "spellen"}
        {summary.roundCount > 0 && ` · ${summary.roundCount} rondes`}
        {` · ${summary.attendees.length} ${summary.attendees.length === 1 ? "speler" : "spelers"}`}
        {summary.totalActiveSeconds > 0 &&
          ` · ${formatDuration(summary.totalActiveSeconds)}`}
      </p>

      {summary.gamesPlayed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.gamesPlayed.map((game) => {
            const coverUrl = game.cover_storage_path
              ? getGameCoverUrl(game.cover_storage_path)
              : null;
            return (
              <span
                key={game.id}
                className="gn-chip inline-flex items-center gap-1.5"
              >
                <span
                  className="h-4 w-4 shrink-0 overflow-hidden rounded-full"
                  style={{
                    background: coverUrl
                      ? undefined
                      : placeholderCoverGradient(game.id),
                  }}
                >
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                {game.name}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}

// "Geschiedenis" (Game Night V5, sectie 4-5): een echte chronologische
// lijst uit game_night_sessions, nieuwste eerst. Actieve/gepauzeerde
// avonden krijgen een "BEZIG"-label en worden niet als afgeronde
// eindstatistiek gepresenteerd (sectie 5) — de cijfers die wél getoond
// worden zijn puur wat er tot nu toe echt is opgeslagen.
export default function GameNightHistory() {
  const { data, isLoading } = useGameNightAnalytics();
  const summaries = data ? buildGameNightSummaries(data) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/game-night"
        className="gn-muted inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--gn-brass)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar Game Night
      </Link>

      <div>
        <p className="gn-eyebrow mb-1.5">Game Night</p>
        <h1 className="gn-display text-2xl font-semibold sm:text-3xl">
          Geschiedenis
        </h1>
        <p className="gn-muted mt-1.5 text-sm">
          {isLoading
            ? "Wordt geladen…"
            : `${summaries.length} ${summaries.length === 1 ? "avond" : "avonden"}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="gn-faint h-5 w-5 animate-spin" />
        </div>
      ) : summaries.length === 0 ? (
        <p className="gn-faint text-sm">Nog geen Game Nights gespeeld.</p>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <GameNightCard key={summary.session.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}
