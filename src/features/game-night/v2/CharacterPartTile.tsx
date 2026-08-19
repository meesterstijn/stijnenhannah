import { useState } from "react";
import { ImageOff, Lock } from "lucide-react";
import type { GameNightCharacterPart } from "@/lib/supabase";
import type { CharacterPartTileStatus } from "@/features/game-night/lib/gameNightCharacter";

// Game Night V2.9C (sectie 10/11) — kleine, gerichte thumbnail voor ÉÉN
// catalogus-onderdeel in de kiezer-grid. Bewust GEEN CharacterVisual-
// hergebruik hier: CharacterVisual lost een hele SPELER-character op
// (legacy/modulair/initiaal-prioriteit), dat is een ander vraagstuk dan
// "toon dit ENE onderdeel, of een nette placeholder als de asset nog
// ontbreekt" — de daadwerkelijke gestapelde live-preview (waar sectie 18
// "geen tweede renderer" wél op slaat) blijft uitsluitend via
// CharacterVisual/GameNightCharacter lopen (zie GameNightCharacterCreator).
function PartThumbnail({ part }: { part: GameNightCharacterPart }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <ImageOff className="gnv2-part-tile-fallback-icon" aria-hidden />;
  }
  return (
    <img
      src={part.asset_path}
      alt=""
      loading="lazy"
      decoding="async"
      className="gnv2-part-tile-img"
      onError={() => setFailed(true)}
    />
  );
}

// Sectie 10: herbruikbare tegel — assetpreview/fallback, label, locked/
// equipped-status, selected state in spelerkleur, ≥64px touch target
// (styling in styles.css, .gnv2-part-tile). Echte button/radio-semantiek
// (sectie 27): locked = disabled + aria-disabled, equipped = aria-checked.
export function CharacterPartTile({
  part,
  status,
  colorHex,
  onSelect,
}: {
  part: GameNightCharacterPart;
  status: CharacterPartTileStatus;
  colorHex: string | null;
  onSelect: () => void;
}) {
  const locked = status === "locked";
  const equipped = status === "equipped";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={equipped}
      aria-disabled={locked || undefined}
      disabled={locked}
      onClick={onSelect}
      aria-label={locked ? `${part.label}, nog niet vrijgespeeld` : part.label}
      className={`gnv2-part-tile ${equipped ? "gnv2-part-tile-equipped" : ""} ${locked ? "gnv2-part-tile-locked" : ""}`}
      style={
        equipped
          ? {
              borderColor: colorHex ?? "var(--gnv2-accent-warm)",
              boxShadow: `0 0 0 2px ${colorHex ?? "var(--gnv2-accent-warm)"}`,
            }
          : undefined
      }
    >
      <span className="gnv2-part-tile-preview">
        <PartThumbnail part={part} />
        {locked && <Lock className="gnv2-part-tile-lock" aria-hidden />}
      </span>
      <span className="gnv2-part-tile-label">{part.label}</span>
    </button>
  );
}
