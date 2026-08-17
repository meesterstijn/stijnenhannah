import { Link } from "react-router-dom";
import { Shuffle } from "lucide-react";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";

// Placeholder-status na het starten/hervatten van een Game Night (sectie
// 21) — de echte spelkeuze-interface volgt in een aparte opdracht, "Kies
// een spel" leidt voorlopig naar de bestaande Spellenkast.
export function GameNightStartedPanel({
  session,
  players,
}: {
  session: GameNightSession;
  players: GameNightPlayer[];
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="gn-eyebrow">Game Night gestart</p>
        <p className="gn-display mt-1 text-xl font-semibold tracking-wide sm:text-2xl">
          {session.name}
        </p>
      </div>

      {players.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {players.map((player) => (
            <span key={player.id} className="gn-chip gn-chip-felt">
              {player.name}
            </span>
          ))}
        </div>
      )}

      <Link
        to="/game-night/spellen"
        className="gn-plaque-action gn-plaque-action-primary w-full max-w-xs px-6 py-3.5"
      >
        <Shuffle
          className="mb-1.5 h-5 w-5"
          style={{ color: "var(--gn-brass)" }}
          strokeWidth={1.7}
        />
        <span className="gn-display text-lg font-semibold tracking-wide">
          Kies een spel
        </span>
        <span className="gn-muted mt-1 text-xs">Naar de spellenkast</span>
      </Link>
    </div>
  );
}
