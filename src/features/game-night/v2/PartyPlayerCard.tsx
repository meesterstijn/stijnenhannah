import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  getPlayerDisplayName,
  getPlayerInitial,
} from "@/features/game-night/lib/playerIdentity";

// Game Night V2.5 (sectie 6/7/8/9/10) — de nieuwe speler-identiteit voor
// "aan tafel": nickname voorop, echte naam subtiel eronder, eigen kleur als
// gloeiende ring i.p.v. een volledig gekleurde kaart (sectie 8: "niet de
// hele kaart knalrood/blauw/geel"). Extensible basis voor V2.6+ (avatar/
// cosmetics) — vandaag alleen een gekleurde initiaal-placeholder, bewust
// geen verzonnen cosmetics-data.
export function PartyPlayerCard({
  player,
  colorHex,
  lifetimeWins,
  onRemove,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  lifetimeWins: number | null;
  onRemove: () => void;
}) {
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
        transform: `${CSS.Transform.toString(transform) ?? ""} scale(${isDragging ? 1.05 : 1})`,
        transition,
        // Sectie 10: los-optillen + gloed in speleraccent tijdens het slepen.
        boxShadow: isDragging
          ? `0 22px 40px -14px oklch(0 0 0 / 0.55), 0 0 0 3px ${colorHex ?? "var(--gnv2-accent-warm)"}66`
          : undefined,
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
        className="flex touch-none select-none flex-col items-center gap-1.5"
      >
        <span
          className="gnv2-avatar"
          style={{ ["--gnv2-ring" as string]: ringColor }}
        >
          {getPlayerInitial(player)}
        </span>
        <span className="gnv2-party-card-name">{displayName}</span>
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
