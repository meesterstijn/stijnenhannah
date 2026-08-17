import type { GameNightSession } from "@/lib/supabase";
import { useTonightStats } from "@/features/game-night/hooks/useTonightStats";
import { formatDuration } from "@/features/game-night/lib/gameTimer";

// Sectie 28: eenvoudige afsluitstate met een ECHTE samenvatting (geen
// uitgebreide ceremonie, dat komt later) — duur, aantal spellen, aantal
// rondes en winnaars, allemaal afgeleid uit dezelfde data als het
// "Vanavond"-blok tijdens het spelen.
export function GameNightCompletedPanel({
  session,
  onBackToStart,
}: {
  session: GameNightSession;
  onBackToStart: () => void;
}) {
  const { data: stats } = useTonightStats(session.id);

  const durationSeconds = session.ended_at
    ? (new Date(session.ended_at).getTime() -
        new Date(session.started_at).getTime()) /
      1000
    : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
      <div>
        <p className="gn-eyebrow">Game Night afgerond</p>
        <p className="gn-display mt-1 text-xl font-semibold tracking-wide sm:text-2xl">
          {session.name}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {durationSeconds > 0 && (
          <p className="gn-muted text-sm">
            {formatDuration(durationSeconds)} samen
          </p>
        )}
        {stats && (
          <p className="gn-muted text-sm">
            {stats.gamesPlayed} {stats.gamesPlayed === 1 ? "spel" : "spellen"}
            {stats.totalRounds > 0 && ` · ${stats.totalRounds} rondes`}
          </p>
        )}
        {stats && stats.topWinners.length > 0 && (
          <p className="gn-muted text-sm">
            🏆{" "}
            {stats.topWinners
              .map((w) => `${w.playerName} (${w.wins})`)
              .join(" · ")}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onBackToStart}
        className="gn-muted mt-2 text-xs underline"
      >
        Terug naar start
      </button>
    </div>
  );
}
