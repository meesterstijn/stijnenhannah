import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { GameNightGame, GameNightSession } from "@/lib/supabase";
import { useGameNightGames } from "@/features/game-night/hooks/useGameNightGames";
import { useActivePartySeats } from "@/features/game-night/hooks/useGameNightParty";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { formatEveningIdentity } from "@/features/game-night/lib/gameNightName";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { PartyContextStrip } from "@/features/game-night/v2/PartyContextStrip";
import { GameSelectionHero } from "@/features/game-night/v2/GameSelectionHero";
import { SmartGamePicker } from "@/features/game-night/v2/SmartGamePicker";
import { GameRoulette } from "@/features/game-night/v2/GameRoulette";
import { GamePreview } from "@/features/game-night/v2/GamePreview";
import { GameReveal } from "@/features/game-night/v2/GameReveal";

// Game Night V2.6 — fullscreen Game Select, het vervolg van de V2.5-lobby
// (sectie 2/21). GameNightHome.tsx rendert dit component via een vroege
// return zodra "Wat spelen we?" getikt is — géén terugval meer op de oude
// .gn-tabletop-weergave/GameNightStartedPanel voor deze stap. Lobby, Game
// Select en Game Reveal vormen zo samen één fullscreen V2-toepassing.
//
// Alles hieronder is pure lokale view-state (sectie 17/20): er wordt pas
// naar Supabase geschreven op het moment dat GameReveal's "Start spel"
// wordt aangetikt (useStartGameSession, exact dezelfde RPC/architectuur als
// de legacy Spellenkast/GameParticipantSheet — sectie 13/25). Terugnavigeren
// of verversen vóór dat moment laat dus nooit een spookresessie achter.
type SelectView =
  | { kind: "home" }
  | { kind: "kies-voor-ons" }
  | { kind: "roulette" }
  | { kind: "preview"; game: GameNightGame }
  | { kind: "reveal"; game: GameNightGame };

export function GameNightV2GameSelect({
  session,
  onBack,
}: {
  session: GameNightSession;
  onBack: () => void;
}) {
  const { data: games = [] } = useGameNightGames();
  const { data: atTable = [] } = useActivePartySeats(session.id);
  const { data: palette = [] } = useGameNightColorPalette();
  const [view, setView] = useState<SelectView>({ kind: "home" });

  const party = atTable.map((s) => s.player);
  const { weekday, date } = formatEveningIdentity(session.started_at);
  const goHome = () => setView({ kind: "home" });

  return (
    <GnV2Scene>
      <header className="gnv2-topbar gnv2-topbar-compact">
        <button
          type="button"
          onClick={view.kind === "home" ? onBack : goHome}
          className="gnv2-nav-btn"
          aria-label={view.kind === "home" ? "Terug naar lobby" : "Terug"}
          title={view.kind === "home" ? "Terug naar lobby" : "Terug"}
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">{weekday}</p>
          <p className="gnv2-identity-date">{date}</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      <PartyContextStrip players={party} palette={palette} />

      <main className="gnv2-select-main">
        {view.kind === "home" && (
          <GameSelectionHero
            games={games}
            playerCount={party.length}
            onPickSmart={() => setView({ kind: "kies-voor-ons" })}
            onPickRoulette={() => setView({ kind: "roulette" })}
            onSelectGame={(game) => setView({ kind: "preview", game })}
          />
        )}

        {view.kind === "kies-voor-ons" && (
          <SmartGamePicker
            games={games}
            playerCount={party.length}
            onBack={goHome}
            onSelectGame={(game) => setView({ kind: "reveal", game })}
          />
        )}

        {view.kind === "roulette" && (
          <GameRoulette
            games={games}
            playerCount={party.length}
            onBack={goHome}
            onSelectGame={(game) => setView({ kind: "reveal", game })}
          />
        )}

        {view.kind === "preview" && (
          <GamePreview
            game={view.game}
            playerCount={party.length}
            onBack={goHome}
            onConfirm={() => setView({ kind: "reveal", game: view.game })}
          />
        )}

        {view.kind === "reveal" && (
          <GameReveal
            game={view.game}
            session={session}
            party={party}
            palette={palette}
            onBack={goHome}
          />
        )}
      </main>
    </GnV2Scene>
  );
}
