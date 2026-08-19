import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { QrCode } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import type { PartySeat } from "@/features/game-night/hooks/useGameNightParty";
import { PartyPlayerCard } from "@/features/game-night/v2/PartyPlayerCard";

export const PARTY_ZONE_ID = "gnv2-party-zone";

// Game Night V2.5 (sectie 4/6/15) — DE centrale scene: geen getekende
// tafel, geen twee gelijkwaardige panelen. Lege staat nodigt uit i.p.v. een
// kaal "0 spelers"-kader (sectie 15).
export function PartyStage({
  seats,
  colorHex,
  lifetimeWins,
  onRemove,
  onOpenQr,
}: {
  seats: PartySeat[];
  colorHex: (player: GameNightPlayer) => string | null;
  lifetimeWins: (playerId: string) => number | null;
  onRemove: (playerId: string) => void;
  onOpenQr: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PARTY_ZONE_ID });

  return (
    <div
      ref={setNodeRef}
      className={`gnv2-stage ${isOver ? "gnv2-stage-over" : ""}`}
    >
      <SortableContext
        items={seats.map((s) => s.player_id)}
        strategy={rectSortingStrategy}
      >
        {seats.length === 0 ? (
          <div className="gnv2-stage-empty">
            <p className="gnv2-stage-empty-title">Wie speelt er vanavond?</p>
            <p className="gnv2-stage-empty-hint">
              Sleep spelers naar boven, tik erop, of laat ze aanschuiven via QR.
            </p>
            <button
              type="button"
              onClick={onOpenQr}
              className="gnv2-btn gnv2-btn-ghost"
            >
              <QrCode className="h-4 w-4" />
              Join met telefoon
            </button>
          </div>
        ) : (
          <div className="gnv2-stage-grid">
            {seats.map((seat) => (
              <PartyPlayerCard
                key={seat.player_id}
                player={seat.player}
                colorHex={colorHex(seat.player)}
                lifetimeWins={lifetimeWins(seat.player_id)}
                onRemove={() => onRemove(seat.player_id)}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
