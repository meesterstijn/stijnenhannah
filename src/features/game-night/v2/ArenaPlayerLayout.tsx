import type { ReactNode } from "react";
import type { GameNightPlayer } from "@/lib/supabase";
import { splitArenaSeatGroups } from "@/features/game-night/lib/arenaSeatLayout";

// Game Night V2.10.8 (Arena Fase 1.1) — "spel centraal, spelers eromheen"
// via twee gewone, wrappende flex-rijen (boven/onder het spelvlak) i.p.v.
// de vorige ring van absoluut gepositioneerde zetels (V2.8). Die ring was
// getuned voor de oude, kleine avatar-maat en clipte zichtbaar zodra
// characters groter werden — een rij-gebaseerde compositie schaalt vanzelf
// mee met de werkelijke charactermaat (zie .gnv2-arena-table in styles.css)
// zonder aparte percentage-tuning per aantal. Nog altijd de ORDINALE
// positie van de meegegeven deelnemerslijst (bestaande seat_order-volgorde),
// geen nieuwe database-coördinaten.
export function ArenaPlayerLayout({
  participants,
  center,
  renderPlayer,
}: {
  participants: GameNightPlayer[];
  center: ReactNode;
  renderPlayer: (player: GameNightPlayer, index: number) => ReactNode;
}) {
  const { top, bottom } = splitArenaSeatGroups(participants);
  const indexById = new Map(participants.map((p, i) => [p.id, i]));

  return (
    <div
      className="gnv2-arena-table"
      data-count={participants.length > 8 ? "9-plus" : participants.length}
    >
      <div className="gnv2-arena-row gnv2-arena-row-top">
        {top.map((p) => (
          <div key={p.id} className="gnv2-arena-seat">
            {renderPlayer(p, indexById.get(p.id) ?? 0)}
          </div>
        ))}
      </div>

      <div className="gnv2-arena-board-zone">
        <div className="gnv2-arena-board">{center}</div>
      </div>

      <div className="gnv2-arena-row gnv2-arena-row-bottom">
        {bottom.map((p) => (
          <div key={p.id} className="gnv2-arena-seat">
            {renderPlayer(p, indexById.get(p.id) ?? 0)}
          </div>
        ))}
      </div>
    </div>
  );
}
