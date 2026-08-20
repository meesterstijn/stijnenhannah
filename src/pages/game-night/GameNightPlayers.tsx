import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { buildPlayerStats } from "@/features/game-night/lib/gameNightStats";
import { titlesForPlayer } from "@/features/game-night/lib/gameNightTitles";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";

// Compacte spelerslijst (Game Night V5, sectie 48) — geen beheerfunctie
// hier (spelers toevoegen/archiveren blijft bij "Wie schuiven er aan?",
// sectie 48 expliciet). Gearchiveerde spelers blijven zichtbaar/bereikbaar
// (sectie 33), maar duidelijk apart gelabeld onderaan de lijst.
//
// Visuele consistentieronde (legacy .gn-*-migratie): zelfde GnV2Scene/
// .gnv2-content-*-opzet als Geschiedenis (V2.7D) — geen inhoudelijke/query-
// wijziging, uitsluitend de presentatielaag.
export default function GameNightPlayers() {
  const { data, isLoading } = useGameNightAnalytics();

  const active = data?.players.filter((p) => !p.archived_at) ?? [];
  const archived = data?.players.filter((p) => p.archived_at) ?? [];

  if (isLoading || !data) return <GnV2Loading />;

  return (
    <GnV2Scene className="gnv2-players-scene">
      <header className="gnv2-topbar">
        <Link
          to="/game-night"
          className="gnv2-nav-btn"
          aria-label="Terug naar Game Night"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Spelers</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <main className="gnv2-content-main">
        {active.length === 0 && archived.length === 0 ? (
          <p className="gnv2-content-empty">Nog geen spelers.</p>
        ) : (
          <div className="gnv2-content-list">
            {[...active, ...archived].map((player) => {
              const stats = buildPlayerStats(data, player.id)!;
              const titles = titlesForPlayer(data, player.id);
              return (
                <Link
                  key={player.id}
                  to={`/game-night/spelers/${player.id}`}
                  className="gnv2-list-row"
                >
                  <span
                    className="gnv2-avatar gnv2-avatar-sm shrink-0"
                    style={{
                      background: player.color ?? "var(--gnv2-bg-elevated)",
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {player.name}
                      {player.archived_at && (
                        <span className="gnv2-faint ml-2 text-xs font-normal">
                          Niet meer actief
                        </span>
                      )}
                    </p>
                    <p className="gnv2-muted truncate text-xs">
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
      </main>
    </GnV2Scene>
  );
}
