import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import {
  getPlayerDisplayName,
  getPlayerInitial,
} from "@/features/game-night/lib/playerIdentity";

export const AVAILABLE_ZONE_ID = "gnv2-available-zone";

function AvailablePlayerChip({
  player,
  colorHex,
  onAdd,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  onAdd: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onAdd}
      {...attributes}
      {...listeners}
      style={{
        transform: `${CSS.Transform.toString(transform) ?? ""} scale(${isDragging ? 1.05 : 1})`,
        transition,
      }}
      aria-label={`${getPlayerDisplayName(player)} aan tafel halen`}
      title={`${getPlayerDisplayName(player)} aan tafel halen`}
      className={`gnv2-tray-chip touch-none select-none ${isDragging ? "gnv2-tray-chip-dragging" : ""}`}
    >
      <span
        className="gnv2-avatar gnv2-avatar-sm"
        style={{
          ["--gnv2-ring" as string]: colorHex ?? "var(--gnv2-border-strong)",
        }}
      >
        {getPlayerInitial(player)}
      </span>
      <span className="gnv2-tray-chip-name">
        {getPlayerDisplayName(player)}
      </span>
      <Plus className="gnv2-tray-chip-plus h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

// Game Night V2.5 (sectie 14) — bewust een compacte, ondergeschikte strip:
// de party domineert het scherm, dit is een smalle horizontaal-scrollbare
// rail eronder. Zelfde SortableContext-mechaniek als de partyzone (sectie 9:
// hetzelfde @dnd-kit-fundament), maar hier is tikken de eerste-klas actie —
// draggability is een bonus, geen vereiste.
export function AvailablePlayerTray({
  players,
  colorHex,
  onAdd,
}: {
  players: GameNightPlayer[];
  colorHex: (player: GameNightPlayer) => string | null;
  onAdd: (playerId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: AVAILABLE_ZONE_ID });

  return (
    <div className="gnv2-tray">
      <p className="gnv2-tray-label">Beschikbaar · {players.length}</p>
      <div
        ref={setNodeRef}
        className={`gnv2-tray-strip ${isOver ? "gnv2-tray-strip-over" : ""}`}
      >
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          {players.length === 0 ? (
            <p className="gnv2-tray-empty">Iedereen zit al aan tafel.</p>
          ) : (
            players.map((player) => (
              <AvailablePlayerChip
                key={player.id}
                player={player}
                colorHex={colorHex(player)}
                onAdd={() => onAdd(player.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
