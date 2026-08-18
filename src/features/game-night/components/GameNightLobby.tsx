import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QrCode, RefreshCw, X } from "lucide-react";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";
import { QrCodeDisplay } from "@/components/qr-code-display";
import {
  useActivePartySeats,
  useAddToParty,
  useRemoveFromParty,
  useSetPartyOrder,
  usePartyRealtimeSync,
} from "@/features/game-night/hooks/useGameNightParty";
import { usePlayers } from "@/features/game-night/hooks/usePlayers";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import {
  useActiveJoinToken,
  useGenerateJoinToken,
  useRevokeJoinToken,
} from "@/features/game-night/hooks/useGameNightJoinTokens";

const AT_TABLE_ZONE = "at-table";
const AVAILABLE_ZONE = "available";

// Game Night V2.4 — de nieuwe lobby (sectie 2/22): geen wizard, de tafel
// "leeft". Owner sleept spelers tussen twee zones (@dnd-kit/core +
// @dnd-kit/sortable, PointerSensor — al elders in dit project bewezen
// touch-vriendelijk, zie R6QuickActionSettings.tsx); QR-joins verschijnen
// realtime in dezelfde AAN TAFEL-zone. Bewust GEEN houten-tafel-metafoor of
// vaste seats-tekening — een moderne, responsieve kaartenzone (sectie 8).
function PlayerCard({
  player,
  colorHex,
  removable,
  onRemove,
}: {
  player: GameNightPlayer;
  colorHex: string | null;
  removable: boolean;
  onRemove?: () => void;
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
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      className={`gn-player-chip touch-none select-none ${isDragging ? "scale-105" : ""}`}
    >
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`${player.name} van tafel halen`}
          className="gn-player-chip-archive"
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      )}
      <span
        className="gn-player-avatar"
        style={colorHex ? { background: colorHex } : undefined}
      >
        {(player.nickname ?? player.name).charAt(0).toUpperCase()}
      </span>
      <span className="gn-player-name">{player.nickname ?? player.name}</span>
    </div>
  );
}

function DropZone({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`gn-panel-elevated min-h-[140px] rounded-xl p-3 transition-colors ${
        isOver ? "ring-2 ring-[var(--gn-brass)]" : ""
      }`}
    >
      <p className="gn-eyebrow mb-2">
        {label} · {count}
      </p>
      {children}
    </div>
  );
}

function QrPanel({
  session,
  onClose,
}: {
  session: GameNightSession;
  onClose: () => void;
}) {
  const { data: activeToken, isLoading } = useActiveJoinToken(session.id);
  const generate = useGenerateJoinToken(session.id);
  const revoke = useRevokeJoinToken(session.id);

  const token = activeToken?.token;

  // Meteen een token genereren als er nog geen geldig token bestaat — geen
  // technische UUID tonen, alleen een klare QR (sectie 20). Een mutation
  // hoort nooit tijdens render zelf te starten, alleen via een effect.
  useEffect(() => {
    if (!isLoading && !token && !generate.isPending) {
      generate.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, token, generate.isPending]);

  const joinUrl = token
    ? `${window.location.origin}/#/game-night/join/${token}`
    : null;

  return (
    <div
      className="gn-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="gn-sheet-card flex flex-col items-center gap-3 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="gn-display text-lg font-semibold tracking-wide">
          Scan om aan tafel te komen
        </p>
        <QrCodeDisplay data={joinUrl} size={220} />
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="gn-plaque-action flex min-h-[48px] items-center justify-center gap-1.5 px-4 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            QR vernieuwen
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeToken) revoke.mutate(activeToken.id);
              onClose();
            }}
            className="gn-muted min-h-[48px] px-4 text-xs underline"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameNightLobby({
  session,
  onChooseGame,
}: {
  session: GameNightSession;
  onChooseGame: () => void;
}) {
  const { data: atTable = [] } = useActivePartySeats(session.id);
  const { data: allPlayers = [] } = usePlayers();
  const { data: palette = [] } = useGameNightColorPalette();
  const addToParty = useAddToParty(session.id);
  const removeFromParty = useRemoveFromParty(session.id);
  const setPartyOrder = useSetPartyOrder(session.id);
  usePartyRealtimeSync(session.id, true);

  const [showQr, setShowQr] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const atTableIds = new Set(atTable.map((s) => s.player_id));
  const available = allPlayers.filter((p) => !atTableIds.has(p.id));
  const colorHex = (player: GameNightPlayer): string | null =>
    palette.find((c) => c.id === player.color_id)?.hex ?? player.color ?? null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const playerId = active.id as string;
    const wasAtTable = atTableIds.has(playerId);

    const overIsAtTableZone =
      over.id === AT_TABLE_ZONE || atTableIds.has(over.id as string);
    const overIsAvailableZone =
      over.id === AVAILABLE_ZONE ||
      available.some((p) => p.id === (over.id as string));

    if (!wasAtTable && overIsAtTableZone) {
      addToParty.mutate(playerId);
      return;
    }
    if (wasAtTable && overIsAvailableZone) {
      removeFromParty.mutate(playerId);
      return;
    }
    if (wasAtTable && overIsAtTableZone && over.id !== playerId) {
      // Herschikken binnen de tafel.
      const ids = atTable.map((s) => s.player_id);
      const oldIndex = ids.indexOf(playerId);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...ids];
      next.splice(oldIndex, 1);
      next.splice(newIndex, 0, playerId);
      setPartyOrder.mutate(next);
    }
  }

  const gridCols =
    atTable.length <= 2
      ? "grid-cols-2"
      : atTable.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
      <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
        {atTable.length} AAN TAFEL
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full max-w-2xl">
          <DropZone id={AT_TABLE_ZONE} label="Aan tafel" count={atTable.length}>
            <SortableContext
              items={atTable.map((s) => s.player_id)}
              strategy={rectSortingStrategy}
            >
              {atTable.length === 0 ? (
                <p className="gn-faint py-6 text-center text-xs">
                  Sleep spelers hierheen, of laat ze via QR joinen.
                </p>
              ) : (
                <div className={`grid ${gridCols} gap-2`}>
                  {atTable.map((seat) => (
                    <PlayerCard
                      key={seat.player_id}
                      player={seat.player}
                      colorHex={colorHex(seat.player)}
                      removable
                      onRemove={() => removeFromParty.mutate(seat.player_id)}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </DropZone>

          <div className="mt-3">
            <DropZone
              id={AVAILABLE_ZONE}
              label="Beschikbare spelers"
              count={available.length}
            >
              <SortableContext
                items={available.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                {available.length === 0 ? (
                  <p className="gn-faint py-3 text-center text-xs">
                    Iedereen zit al aan tafel.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {available.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        colorHex={colorHex(player)}
                        removable={false}
                      />
                    ))}
                  </div>
                )}
              </SortableContext>
            </DropZone>
          </div>
        </div>
      </DndContext>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="gn-plaque-action flex min-h-[48px] w-full items-center justify-center gap-2 px-6"
        >
          <QrCode className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          <span className="gn-display text-sm font-semibold tracking-wide">
            Join met telefoon
          </span>
        </button>
        <button
          type="button"
          disabled={atTable.length === 0}
          onClick={onChooseGame}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[56px] w-full items-center justify-center px-6 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="gn-display text-lg font-semibold tracking-wide">
            Wat spelen we?
          </span>
        </button>
      </div>

      {showQr && <QrPanel session={session} onClose={() => setShowQr(false)} />}
    </div>
  );
}
