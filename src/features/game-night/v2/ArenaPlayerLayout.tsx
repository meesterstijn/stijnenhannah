import type { ReactNode } from "react";
import type { GameNightPlayer } from "@/lib/supabase";

// Game Night V2.7B (sectie 4/35) — verdeelt de deelnemers rondom de
// centrale gamefoto op basis van hun ORDINALE positie in de meegegeven
// lijst (bestaande seat_order-volgorde uit useGameSessionParticipants,
// sectie 4: "gebruik ordinale participantpositie, niet nieuwe database-
// coördinaten") — geen aparte layout-tabel, geen x/y-opslag.
//
// 3 spelers krijgt bewust een top-count van 1 (één boven, twee onder) voor
// een "triangular balance"-gevoel (sectie 35); alle andere aantallen
// splitsen zo gelijk mogelijk, top >= bottom.
function topCountFor(total: number): number {
  if (total === 3) return 1;
  return Math.ceil(total / 2);
}

export function ArenaPlayerLayout({
  participants,
  center,
  renderPlayer,
}: {
  participants: GameNightPlayer[];
  center: ReactNode;
  renderPlayer: (player: GameNightPlayer, index: number) => ReactNode;
}) {
  const topCount = topCountFor(participants.length);
  const top = participants.slice(0, topCount);
  const bottom = participants.slice(topCount);

  return (
    <div className="gnv2-arena-layout" data-count={participants.length}>
      <div className="gnv2-arena-row gnv2-arena-row-top">
        {top.map((p, i) => (
          <div key={p.id} className="gnv2-arena-slot">
            {renderPlayer(p, i)}
          </div>
        ))}
      </div>

      <div className="gnv2-arena-center">{center}</div>

      <div className="gnv2-arena-row gnv2-arena-row-bottom">
        {bottom.map((p, i) => (
          <div key={p.id} className="gnv2-arena-slot">
            {renderPlayer(p, topCount + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
