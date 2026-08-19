import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import type { ResolvedCharacter } from "@/features/game-night/lib/gameNightCharacter";
import {
  GameNightCharacter,
  type ArenaPlayerState,
} from "@/features/game-night/v2/GameNightCharacter";

// Game Night V2.7B/V2.8 (sectie 6/7/8/9/42) — de VOLLEDIGE spelerzone is de
// WIN-knop (geen los, klein knopje binnenin): één tik = één WIN. Groot
// touch-target (>=44px, sectie 24), duidelijke pressed-state via
// .gnv2-player-zone:active. `state` (V2.8 sectie 9) vervangt de oude
// losse `celebrating`-boolean: tijdens "celebrating" krijgt de hele zone
// (niet alleen het character) de accentgloed/pulse, net als voorheen — de
// overige staten (highlighted/winner/dimmed) hebben nog geen caller in de
// Arena maar zijn al volledig doorverbonden.
export function ArenaPlayerZone({
  player,
  colorHex,
  characterId,
  resolvedCharacter,
  wins,
  title,
  state = "normal",
  celebrationStyle,
  disabled,
  onTap,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  characterId?: string | null;
  // V2.9C (sectie 19): de echte modulaire/legacy equipment van deze
  // participant, al batch-geladen door GameNightV2Arena — wint van
  // `characterId` (zie GameNightCharacter.tsx).
  resolvedCharacter?: ResolvedCharacter;
  wins: number;
  title?: string | null;
  state?: ArenaPlayerState;
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
      className={`gnv2-player-zone gnv2-player-zone-${state}`}
      style={{
        ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
      }}
    >
      <GameNightCharacter
        player={player}
        colorHex={colorHex}
        characterId={characterId}
        resolvedCharacter={resolvedCharacter}
        title={title}
        size="sm"
        state={state}
        celebrationStyle={celebrationStyle}
        eager
      />
      <span className="gnv2-player-zone-wins" aria-hidden>
        {wins} {wins === 1 ? "WIN" : "WINS"}
      </span>
    </button>
  );
}
