import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

// Game Night V2.8 (sectie 9) — semantische, langer-levende spelerstaat.
// "celebrating" is de ~1s transient WIN-reactie (met celebrationStyle); de
// overige staten hebben nog GEEN caller (geen turnsysteem/bekende
// matchwinnaar), maar zijn al volledig doorverbonden zodat een latere fase
// ze zonder component-herstructurering kan aanzetten. Verhuisd vanuit het
// vroegere GameNightCharacter.tsx (V2.10.8: dat component is retired, zie
// hieronder) — dit is nu de enige plek die deze staat gebruikt.
export type ArenaPlayerState =
  | "normal"
  | "highlighted"
  | "winner"
  | "celebrating"
  | "dimmed";

// Game Night V2.7B/V2.8/V2.10.5/V2.10.8 (sectie 6/7/8/9/42, Arena Fase 1.1
// "STOP MET LOSSE HUD-CARDS") — de spelerzone. Rendeerde tot en met V2.10.5
// nog het oude GameNightCharacter (`.gnv2-character-head`, 40-88px, in een
// eigen `.gnv2-player-zone`-kaart met achtergrond/rand) — een apart, kleiner
// visueel format dan de grote, kaderloze `.gnv2-party-character`-weergave
// die de Lobby/scènerotatie/Win-picker/Winner Spotlight allemaal al
// gebruiken. V2.10.8 hergebruikt nu DIEZELFDE weergave hier: één
// character-renderer voor de hele Arena, geen kaart eromheen. Tot en met
// V2.10.5 was de VOLLEDIGE zone altijd de WIN-knop (tik-op-character =
// WIN). Sinds V2.10.5 ("Arena moet vooral bekeken worden, geen
// per-ongeluk-tik-risico") is dat niet langer de standaard: de passieve
// tafelscène geeft GEEN `onTap` mee en toont dan een niet-interactieve
// `<div>` (geen knop-semantiek/geen aria-label dat "Registreer WIN"
// belooft — dat zou misleidend zijn).
export function ArenaPlayerZone({
  player,
  colorHex,
  resolvedCharacter,
  wins,
  state = "normal",
  celebrationStyle,
  disabled,
  onTap,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  resolvedCharacter?: ResolvedCharacter;
  wins: number;
  state?: ArenaPlayerState;
  celebrationStyle: GameNightCelebrationStyle | null;
  disabled?: boolean;
  // V2.10.5: optioneel — zonder `onTap` rendert dit component puur
  // passief (zie bestandscommentaar hierboven).
  onTap?: () => void;
}) {
  const celebrating = state === "celebrating";
  const stateClass = state !== "normal" ? ` gnv2-arena-character-${state}` : "";
  const celebrateClass = celebrating
    ? ` gnv2-celebrate-${celebrationStyle ?? "default"}`
    : "";
  const className = `gnv2-party-character gnv2-arena-character${stateClass}${celebrateClass}`;
  const style = {
    ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
  };
  const visualProps = characterVisualPropsFor(resolvedCharacter);
  const content = (
    <>
      <span className="gnv2-party-character-art">
        <CharacterVisual
          player={player}
          characterId={visualProps.characterId}
          layers={visualProps.layers}
          loading="eager"
        />
      </span>
      <span className="gnv2-party-character-name">
        {getPlayerDisplayName(player)}
      </span>
      <span className="gnv2-win-badge">
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
