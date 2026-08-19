import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import { GameNightCharacter } from "@/features/game-night/v2/GameNightCharacter";

// Game Night V2.7B (sectie 6/7/8/42) — de VOLLEDIGE spelerzone is de
// WIN-knop (geen los, klein knopje binnenin): één tik = één WIN. Groot
// touch-target (>=110px, sectie 7), duidelijke pressed-state via
// .gnv2-player-zone:active, en tijdens een celebratie krijgt de hele zone
// (niet alleen het character) de accentgloed/pulse.
export function ArenaPlayerZone({
  player,
  colorHex,
  wins,
  title,
  celebrating,
  celebrationStyle,
  disabled,
  onTap,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  wins: number;
  title?: string | null;
  celebrating: boolean;
  celebrationStyle: GameNightCelebrationStyle | null;
  disabled: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={`Registreer WIN voor ${getPlayerDisplayName(player)}`}
      className={`gnv2-player-zone ${celebrating ? "gnv2-player-zone-celebrate" : ""}`}
      style={{
        ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
      }}
    >
      <GameNightCharacter
        player={player}
        colorHex={colorHex}
        title={title}
        celebrating={celebrating}
        celebrationStyle={celebrationStyle}
      />
      <span className="gnv2-player-zone-wins" aria-hidden>
        {wins} {wins === 1 ? "WIN" : "WINS"}
      </span>
    </button>
  );
}
