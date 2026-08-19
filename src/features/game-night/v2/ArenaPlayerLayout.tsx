import type { ReactNode } from "react";
import type { GameNightPlayer } from "@/lib/supabase";
import { resolveArenaSeatPositions } from "@/features/game-night/lib/arenaSeatLayout";

// Game Night V2.8 (sectie 1/7/25/29) — "spel centraal, spelers eromheen":
// vervangt de vorige top/bottom-rijenlayout (V2.7B) door een ring van
// expliciet gepositioneerde zetels rond het bord, op basis van de pure
// resolveArenaSeatPositions()-config (1-6 spelers, testbaar los van React/
// DOM). Nog altijd de ORDINALE positie van de meegegeven deelnemerslijst
// (bestaande seat_order-volgorde uit useGameSessionParticipants) — geen
// nieuwe database-coördinaten, geen aparte layout-tabel.
export function ArenaPlayerLayout({
  participants,
  center,
  renderPlayer,
}: {
  participants: GameNightPlayer[];
  center: ReactNode;
  renderPlayer: (player: GameNightPlayer, index: number) => ReactNode;
}) {
  const positions = resolveArenaSeatPositions(participants.length);

  return (
    <div className="gnv2-arena-ring" data-count={participants.length}>
      <div className="gnv2-arena-board">{center}</div>

      {participants.map((p, i) => {
        const pos = positions[i];
        if (!pos) return null;
        return (
          <div
            key={p.id}
            className="gnv2-arena-seat"
            style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
          >
            {renderPlayer(p, i)}
          </div>
        );
      })}
    </div>
  );
}
