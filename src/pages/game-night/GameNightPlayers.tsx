import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { buildPlayerStats } from "@/features/game-night/lib/gameNightStats";
import { titlesForPlayer } from "@/features/game-night/lib/gameNightTitles";

// Compacte spelerslijst (Game Night V5, sectie 48) — geen beheerfunctie
// hier (spelers toevoegen/archiveren blijft bij "Wie schuiven er aan?",
// sectie 48 expliciet). Gearchiveerde spelers blijven zichtbaar/bereikbaar
// (sectie 33), maar duidelijk apart gelabeld onderaan de lijst.
export default function GameNightPlayers() {
  const { data, isLoading } = useGameNightAnalytics();

  const active = data?.players.filter((p) => !p.archived_at) ?? [];
  const archived = data?.players.filter((p) => p.archived_at) ?? [];

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
          Spelers
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-14">
          <Loader2 className="gn-faint h-5 w-5 animate-spin" />
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <p className="gn-faint text-sm">Nog geen spelers.</p>
      ) : (
        <div className="space-y-2.5">
          {[...active, ...archived].map((player) => {
            const stats = buildPlayerStats(data, player.id)!;
            const titles = titlesForPlayer(data, player.id);
            return (
              <Link
                key={player.id}
                to={`/game-night/spelers/${player.id}`}
                className="gn-panel-elevated flex items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--gn-brass)]"
              >
                <span
                  className="gn-player-avatar shrink-0"
                  style={
                    player.color ? { background: player.color } : undefined
                  }
                >
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {player.name}
                    {player.archived_at && (
                      <span className="gn-faint ml-2 text-xs font-normal">
                        Niet meer actief
                      </span>
                    )}
                  </p>
                  <p className="gn-muted truncate text-xs">
                    {titles[0]?.title && `${titles[0].title} · `}
                    {stats.gameNightsAttended} Game Nights ·{" "}
                    {stats.gameSessionsPlayed} spellen · {stats.sessionWins}{" "}
                    session wins
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
