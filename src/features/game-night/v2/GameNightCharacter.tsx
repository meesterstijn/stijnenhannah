import type { ReactNode } from "react";
import type {
  GameNightCelebrationStyle,
  GameNightPlayer,
} from "@/lib/supabase";
import {
  getPlayerDisplayName,
  getPlayerInitial,
} from "@/features/game-night/lib/playerIdentity";

// Game Night V2.7B (sectie 5/6/37) — de basis Game Arena-character: geen
// cosmetics-systeem (dat is V2.8+), maar wél al de DOM/laagstructuur die
// V2.8 straks nodig heeft. Elke toekomstige laag (outfit/headwear/
// accessory/effect/badge) is een NAMED, typed extension point — vandaag
// altijd `undefined` en render dan simpelweg niets (geen dode/halfafgemaakte
// UI, sectie 17), maar V2.8 hoeft deze component niet te herstructureren
// om er echte content in te hangen.
export function GameNightCharacter({
  player,
  colorHex,
  title,
  size = "md",
  celebrating = false,
  celebrationStyle = null,
  outfitSlot,
  headwearSlot,
  accessorySlot,
  effectSlot,
  badgeSlot,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  title?: string | null;
  size?: "sm" | "md" | "lg";
  celebrating?: boolean;
  celebrationStyle?: GameNightCelebrationStyle | null;
  outfitSlot?: ReactNode;
  headwearSlot?: ReactNode;
  accessorySlot?: ReactNode;
  effectSlot?: ReactNode;
  badgeSlot?: ReactNode;
}) {
  const ring = colorHex ?? "var(--gnv2-border-strong)";

  return (
    <div
      className={`gnv2-character gnv2-character-${size} ${
        celebrating
          ? `gnv2-character-celebrate gnv2-celebrate-${celebrationStyle ?? "default"}`
          : ""
      }`}
      style={{ ["--gnv2-ring" as string]: ring }}
    >
      {effectSlot}
      {/* "base"-laag (sectie 5): eenvoudig lichaam/silhouet onder het
          hoofd — puur CSS, geen SVG-asset nodig. */}
      <div className="gnv2-character-body" aria-hidden />
      <div className="gnv2-character-head">
        {headwearSlot}
        <span className="gnv2-character-initial">
          {getPlayerInitial(player)}
        </span>
        {outfitSlot}
        {accessorySlot}
      </div>
      {badgeSlot}
      <p className="gnv2-character-name">{getPlayerDisplayName(player)}</p>
      {title && <p className="gnv2-character-title">{title}</p>}
    </div>
  );
}
