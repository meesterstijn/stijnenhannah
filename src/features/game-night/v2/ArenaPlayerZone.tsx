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

// Game Night V2.7B/V2.8/V2.10.5 (sectie 6/7/8/9/42) — de spelerzone.
// Tot en met V2.10 was de VOLLEDIGE zone altijd de WIN-knop (tik-op-
// character = WIN). Sinds V2.10.5 ("Arena moet vooral bekeken worden, geen
// per-ongeluk-tik-risico") is dat niet langer de standaard: de passieve
// tafelscène geeft GEEN `onTap` mee en toont dan een niet-interactieve
// `<div>` (zelfde opmaak, geen knop-semantiek/geen focus-ring/geen
// aria-label dat "Registreer WIN" belooft — dat zou misleidend zijn). Het
// expliciete "🏆 Win registreren"-overlay (ArenaWinPickerSheet) hergebruikt
// dit component WEL met `onTap` gezet, en krijgt dan gewoon weer de
// bestaande knop-variant — géén tweede character-renderer, zie
// GameNightCharacter/CharacterVisual. `state` (V2.8 sectie 9) bepaalt de
// accentgloed/pulse; de overige staten (highlighted/dimmed) hebben nog
// geen caller buiten "winner"/"celebrating" maar zijn al volledig
// doorverbonden.
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
  disabled?: boolean;
  // V2.10.5: optioneel — zonder `onTap` rendert dit component puur
  // passief (zie bestandscommentaar hierboven).
  onTap?: () => void;
}) {
  const className = `gnv2-player-zone gnv2-player-zone-${state}`;
  const style = {
    ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
  };
  const content = (
    <>
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
    </>
  );

  if (!onTap) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={`Registreer WIN voor ${getPlayerDisplayName(player)}`}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}
