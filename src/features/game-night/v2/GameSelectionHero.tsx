import { Dices, Sparkles } from "lucide-react";
import type { GameNightGame } from "@/lib/supabase";
import { GameLibrary } from "@/features/game-night/v2/GameLibrary";

// Game Night V2.6 (sectie 6) — het hoofdscherm van Game Select: twee
// visueel bijzondere hero-tegels (geen dashboardknoppen) + de spellenkast
// direct eronder, al gevuld op 1280×800 zonder scrollen voor de acties.
export function GameSelectionHero({
  games,
  playerCount,
  onPickSmart,
  onPickRoulette,
  onSelectGame,
}: {
  games: GameNightGame[];
  playerCount: number;
  onPickSmart: () => void;
  onPickRoulette: () => void;
  onSelectGame: (game: GameNightGame) => void;
}) {
  return (
    <div className="gnv2-hero gnv2-view-enter">
      <p className="gnv2-select-heading">Wat gaan we spelen?</p>

      <div className="gnv2-hero-tiles">
        <button
          type="button"
          onClick={onPickSmart}
          className="gnv2-hero-tile gnv2-hero-tile-smart"
        >
          <Sparkles className="gnv2-hero-tile-icon" />
          <span className="gnv2-hero-tile-title">Kies voor ons</span>
          <span className="gnv2-hero-tile-subtitle">Slimme aanbevelingen</span>
        </button>

        <button
          type="button"
          onClick={onPickRoulette}
          className="gnv2-hero-tile gnv2-hero-tile-roulette"
        >
          <Dices className="gnv2-hero-tile-icon" />
          <span className="gnv2-hero-tile-title">Game Roulette</span>
          <span className="gnv2-hero-tile-subtitle">
            Laat het lot beslissen
          </span>
        </button>
      </div>

      <p className="gnv2-hero-divider">of zelf kiezen</p>

      <GameLibrary
        games={games}
        playerCount={playerCount}
        onSelectGame={onSelectGame}
      />
    </div>
  );
}
