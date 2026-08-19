import type { ReactNode } from "react";
import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";
import type { ResolvedCharacter } from "@/features/game-night/lib/gameNightCharacter";

// Game Night V2.8 (sectie 9) — semantische, langer-levende spelerstaat.
// "celebrating" is de ~1s transient WIN-reactie (met celebrationStyle); de
// overige staten hebben in V2.8 nog GEEN caller (geen turnsysteem/bekende
// matchwinnaar, sectie 9: "niet simuleren als de backend het niet weet"),
// maar zijn al volledig doorverbonden zodat een latere fase ze zonder
// component-herstructurering kan aanzetten.
export type ArenaPlayerState =
  | "normal"
  | "highlighted"
  | "winner"
  | "celebrating"
  | "dimmed";

// Game Night V2.7B/V2.8 (sectie 5/6/37) — de basis Game Arena-character.
// V2.8 voegt een characterId toe (sectie 4/6): als er een geldige preset is
// gekozen, vervangt het bijbehorende tijdelijke icoon (characterPresets.ts)
// de initiaal — GEEN cosmetics-systeem, maar wél al de DOM/laagstructuur
// die een latere fase nodig heeft. Elke toekomstige laag (outfit/headwear/
// accessory/effect/badge) is een NAMED, typed extension point — vandaag
// altijd `undefined` en render dan simpelweg niets (geen dode/halfafgemaakte
// UI, sectie 17), maar een latere fase hoeft deze component niet te
// herstructureren om er echte content in te hangen.
export function GameNightCharacter({
  player,
  colorHex,
  characterId = null,
  resolvedCharacter,
  title,
  size = "md",
  state = "normal",
  celebrationStyle = null,
  eager = false,
  outfitSlot,
  headwearSlot,
  accessorySlot,
  effectSlot,
  badgeSlot,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  characterId?: string | null;
  // V2.9B (sectie 9/10): optionele hogere-orde prop — geeft een caller die
  // al resolvePlayerCharacter() heeft aangeroepen (modulaire equipment of
  // legacy character_id) door, zonder dat DIE caller zelf `mode` hoeft te
  // controleren. Wint van `characterId` als beide gegeven zijn. Vandaag
  // geeft nog geen enkele caller dit door (Arena/selector blijven
  // `characterId` gebruiken) — puur voorbereid voor V2.9C.
  resolvedCharacter?: ResolvedCharacter;
  title?: string | null;
  size?: "sm" | "md" | "lg";
  state?: ArenaPlayerState;
  celebrationStyle?: GameNightCelebrationStyle | null;
  // Sectie 16 (V2.9): de Arena toont maar 1-6 characters tegelijk, altijd
  // zichtbaar — die mogen direct laden i.p.v. lazy (bv. een selector-grid
  // met 12 tegels, die WEL lazy blijft, zie CharacterVisual's default).
  eager?: boolean;
  outfitSlot?: ReactNode;
  headwearSlot?: ReactNode;
  accessorySlot?: ReactNode;
  effectSlot?: ReactNode;
  badgeSlot?: ReactNode;
}) {
  const ring = colorHex ?? "var(--gnv2-border-strong)";
  const celebrating = state === "celebrating";

  const layers =
    resolvedCharacter?.mode === "modular"
      ? resolvedCharacter.layers
      : undefined;
  const effectiveCharacterId =
    resolvedCharacter?.mode === "legacy"
      ? resolvedCharacter.characterId
      : characterId;

  return (
    <div
      className={`gnv2-character gnv2-character-${size} gnv2-character-${state} ${
        celebrating ? `gnv2-celebrate-${celebrationStyle ?? "default"}` : ""
      }`}
      style={{ ["--gnv2-ring" as string]: ring }}
    >
      {effectSlot}
      {/* "base"-laag (sectie 5): eenvoudig lichaam/silhouet onder het
          hoofd — puur CSS, geen SVG-asset nodig. */}
      <div className="gnv2-character-body" aria-hidden />
      <div className="gnv2-character-head">
        {headwearSlot}
        {/* Sectie 9/10 (V2.9/V2.9B): CharacterVisual is uitsluitend de
            "base art"-laag (modulaire lagen -> echte portrait -> silhouet
            -> initiaal); deze div blijft de vaste bounds waar een
            toekomstige creator-UI overheen kan stapelen. */}
        <CharacterVisual
          player={player}
          characterId={effectiveCharacterId}
          layers={layers}
          loading={eager ? "eager" : "lazy"}
        />
        {outfitSlot}
        {accessorySlot}
      </div>
      {badgeSlot}
      <p className="gnv2-character-name">{getPlayerDisplayName(player)}</p>
      {title && <p className="gnv2-character-title">{title}</p>}
    </div>
  );
}
