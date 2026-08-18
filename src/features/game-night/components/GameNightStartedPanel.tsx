import { useState } from "react";
import type {
  GameNightGame,
  GameNightPlayer,
  GameNightSession,
} from "@/lib/supabase";
import { GameChooserPanel } from "@/features/game-night/components/GameChooserPanel";
import { KiesVoorOnsPanel } from "@/features/game-night/components/KiesVoorOnsPanel";
import { GameRoulettePanel } from "@/features/game-night/components/GameRoulettePanel";

type View = "chooser" | "kies-voor-ons" | "roulette";

// Status na het starten/hervatten van een Game Night, zolang er nog geen
// spelsessie loopt (sectie 21-23) — toont "HOE ZULLEN WE KIEZEN?" met de
// drie spelkeuzemodi uit Game Night V4. "Zelf kiezen" blijft de bestaande
// Spellenkast; "Kies voor ons"/"Game Roulette" zijn nieuwe views binnen
// datzelfde bordvlak, geen aparte pagina/route, zodat het fysieke bord
// niet wisselt van wereld.
export function GameNightStartedPanel({
  session,
  players,
  games,
  gameNightSessionId,
}: {
  session: GameNightSession;
  players: GameNightPlayer[];
  games: GameNightGame[];
  gameNightSessionId: string;
}) {
  const [view, setView] = useState<View>("chooser");

  if (view === "kies-voor-ons") {
    return (
      <KiesVoorOnsPanel
        games={games}
        attendees={players}
        gameNightSessionId={gameNightSessionId}
        onBack={() => setView("chooser")}
      />
    );
  }

  if (view === "roulette") {
    return (
      <GameRoulettePanel
        games={games}
        attendees={players}
        gameNightSessionId={gameNightSessionId}
        onBack={() => setView("chooser")}
      />
    );
  }

  return (
    <GameChooserPanel
      sessionName={session.name}
      attendees={players}
      onKiesVoorOns={() => setView("kies-voor-ons")}
      onRoulette={() => setView("roulette")}
    />
  );
}
