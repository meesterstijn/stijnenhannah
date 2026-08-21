import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

// Game Night V2.5/V2.9C/V2.10 (sectie 6/7/8/9/10/18) — de speler-identiteit
// voor "aan tafel". V2.10 ("characters zijn de show"): geen kleine ronde
// avatar meer opgesloten in een kaart — het volledige transparante
// character zweeft los op de scene (`.gnv2-party-character`), met een
// zachte vloer-gloed in de spelerkleur i.p.v. een cirkel-ring. `.gnv2-party-
// card` blijft bestaan als de dnd-kit-transform-drager (drag-and-drop moet
// ongewijzigd werken) maar draagt zelf geen kaart-chrome (achtergrond/
// rand/blur) meer — puur een onzichtbare positioneringshost. Grootte komt
// van `--gnv2-party-char-size`, gezet door PartyStage.tsx op basis van het
// aantal spelers (sectie 3: "meer ruimte = groter character").
// `resolvedCharacter` (V2.9C) laat GameNightV2Lobby.tsx de al-batchgeladen
// modulaire/legacy character tonen via dezelfde CharacterVisual als Arena/
// Creator (sectie 18: "GEEN tweede character-preview renderer") — zonder
// character valt dit gewoon terug op de bestaande initiaal.
export function PartyPlayerCard({
  player,
  colorHex,
  lifetimeWins,
  resolvedCharacter,
  onRemove,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  lifetimeWins: number | null;
  resolvedCharacter?: ResolvedCharacter;
  onRemove: () => void;
}) {
  const visualProps = characterVisualPropsFor(resolvedCharacter);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const displayName = getPlayerDisplayName(player);
  const showRealName =
    player.nickname?.trim() && player.nickname.trim() !== player.name;
  const ringColor = colorHex ?? "var(--gnv2-border-strong)";

  return (
    <div
      ref={setNodeRef}
      style={{
        // Schaal zit HIER in dezelfde inline transform als dnd-kit's eigen
        // verplaatsings-transform (i.p.v. een losse CSS-class-transform) —
        // een los toegevoegde class-transform zou door dnd-kit's continue
        // inline updates worden overschreven en dus nooit zichtbaar zijn.
        transform: `${CSS.Transform.toString(transform) ?? ""} scale(${isDragging ? 1.06 : 1})`,
        transition,
      }}
      className={`gnv2-party-card ${isDragging ? "gnv2-party-card-dragging" : ""}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`${displayName}: vanavond niet meer meedoen`}
        title="Vanavond niet meer meedoen"
        className="gnv2-card-remove"
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>

      <div
        {...attributes}
        {...listeners}
        className={`gnv2-party-character touch-none select-none ${isDragging ? "gnv2-party-character-dragging" : ""}`}
        style={{ ["--gnv2-ring" as string]: ringColor }}
      >
        <span className="gnv2-party-character-art">
          <CharacterVisual
            player={player}
            characterId={visualProps.characterId}
            layers={visualProps.layers}
            loading="eager"
          />
        </span>
        <span className="gnv2-party-character-name">{displayName}</span>
        {showRealName && (
          <span className="gnv2-party-card-realname">{player.name}</span>
        )}
        {lifetimeWins !== null && lifetimeWins > 0 && (
          <span className="gnv2-win-badge">
            {lifetimeWins} {lifetimeWins === 1 ? "WIN" : "WINS"}
          </span>
        )}
      </div>
    </div>
  );
}
