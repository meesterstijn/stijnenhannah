import { useMemo } from "react";
import { Link } from "react-router-dom";
import { History, LayoutGrid, Trophy, Users } from "lucide-react";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { buildHomepageChampion } from "@/features/game-night/lib/gameNightTitles";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";

// Game Night V2.7C (sectie 2) — de normale landing van /game-night zolang
// er geen actieve Game Night bestaat. Vervangt de oude houten "START GAME
// NIGHT"-homepage (ActionPlaque/ChampionPlaque/kaarsen/pokertafel) als de
// DEFAULT idle-state — die oude boom blijft uitsluitend nog bereikbaar via
// een genuine legacy-sessie (zie GameNightHome.tsx). Zelfde GNV2-wereld als
// Lobby/Game Select/Arena (GnV2Scene, geen eigen achtergrondtruc).
//
// Compacte context (kampioen/avonden/laatste spel) komt uitsluitend uit de
// al-bestaande, al-gecachete useGameNightAnalytics() — geen nieuwe zware
// query alleen voor dit scherm (sectie 2 expliciet).
export function GameNightV2Start({
  onStart,
  startPending,
}: {
  onStart: () => void;
  startPending: boolean;
}) {
  const { data: analyticsData } = useGameNightAnalytics();

  const champion = analyticsData ? buildHomepageChampion(analyticsData) : null;

  const completedNights = analyticsData
    ? analyticsData.sessions.filter((s) => s.status === "completed").length
    : 0;

  const lastGameName = useMemo(() => {
    if (!analyticsData) return null;
    const completed = [...analyticsData.gameSessions]
      .filter((gs) => gs.status === "completed")
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );
    const latest = completed[0];
    if (!latest) return null;
    return analyticsData.index.gamesById.get(latest.game_id)?.name ?? null;
  }, [analyticsData]);

  const hasContext = !!champion || completedNights > 0 || !!lastGameName;

  return (
    <GnV2Scene className="gnv2-start-scene">
      <header className="gnv2-topbar">
        <div className="gnv2-identity">
          <p className="gnv2-identity-eyebrow">Ons Huisje</p>
          <p className="gnv2-identity-date">Game Night</p>
        </div>
        <nav className="gnv2-nav" aria-label="Game Night navigatie">
          <Link
            to="/game-night/spelers"
            className="gnv2-nav-btn"
            aria-label="Spelers"
            title="Spelers"
          >
            <Users className="h-[18px] w-[18px]" />
          </Link>
          <Link
            to="/game-night/hall-of-fame"
            className="gnv2-nav-btn"
            aria-label="Hall of Fame"
            title="Hall of Fame"
          >
            <Trophy className="h-[18px] w-[18px]" />
          </Link>
          <Link
            to="/game-night/geschiedenis"
            className="gnv2-nav-btn"
            aria-label="Geschiedenis"
            title="Geschiedenis"
          >
            <History className="h-[18px] w-[18px]" />
          </Link>
          <Link
            to="/game-night/spellen"
            className="gnv2-nav-btn"
            aria-label="Spellenkast"
            title="Spellenkast"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </Link>
        </nav>
      </header>

      <main className="gnv2-start-main">
        <p className="gnv2-start-eyebrow">Game Night</p>
        <h1 className="gnv2-start-headline">Wie is er vanavond klaar voor?</h1>
        <p className="gnv2-start-tagline">
          Nieuwe avond. Nieuwe rivaliteit. Zelfde slechte verliezers.
        </p>

        <button
          type="button"
          onClick={onStart}
          disabled={startPending}
          className="gnv2-btn gnv2-btn-primary gnv2-start-cta"
        >
          {startPending ? "Bezig..." : "Start Game Night"}
        </button>

        {hasContext && (
          <div className="gnv2-start-context">
            {champion && (
              <p>
                {getPlayerDisplayName(champion.player)} · {champion.titleLabel}
              </p>
            )}
            {completedNights > 0 && (
              <p>
                {completedNights} {completedNights === 1 ? "avond" : "avonden"}{" "}
                gespeeld
              </p>
            )}
            {lastGameName && <p>Laatst gespeeld: {lastGameName}</p>}
          </div>
        )}
      </main>
    </GnV2Scene>
  );
}
