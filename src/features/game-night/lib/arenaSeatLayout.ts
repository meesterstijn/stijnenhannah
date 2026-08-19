// Game Night V2.8 (sectie 7/25/28-A) — pure, testbare positioneringslogica
// voor de Arena: "spel centraal, spelers eromheen" i.p.v. een generieke
// CSS-grid die toevallig ongeveer klopt. Elke waarde is een percentage
// t.o.v. de vierkante/4:3 .gnv2-arena-ring-container (0-100), bedoeld om
// via `top`/`left` + `translate(-50%, -50%)` een speler-zetel te
// positioneren. Puur data in, data uit — geen JSX, geen DOM, geen state.
//
// Gebruikt de ORDINALE positie van de meegegeven deelnemerslijst (zelfde
// bestaande seat_order-volgorde als de vorige top/bottom-layout in
// ArenaPlayerLayout.tsx) — geen nieuwe database-coördinaten.

export type ArenaSeatPosition = {
  /** Percentage vanaf de bovenkant van de ring (0-100). */
  top: number;
  /** Percentage vanaf de linkerkant van de ring (0-100). */
  left: number;
};

// Expliciete presets voor 1 t/m 6 spelers (sectie 7: "niet simpelweg één
// CSS-grid"). Bij 3 spelers een driehoek (1 boven, 2 onder); bij 4 spelers
// een ruit (boven/links/rechts/onder) rond het bord; bij 5/6 spelers meer
// verdeeld over de buitenrand, met een kleinere top-rij zodat er nooit meer
// dan 2 zetels in de smalle bovenstrook hoeven te passen op 1280×800.
const SEAT_LAYOUTS: Record<number, readonly ArenaSeatPosition[]> = {
  1: [{ top: 6, left: 50 }],
  2: [
    { top: 6, left: 50 },
    { top: 94, left: 50 },
  ],
  3: [
    { top: 6, left: 50 },
    { top: 90, left: 20 },
    { top: 90, left: 80 },
  ],
  4: [
    { top: 4, left: 50 },
    { top: 50, left: 6 },
    { top: 50, left: 94 },
    { top: 96, left: 50 },
  ],
  5: [
    { top: 4, left: 50 },
    { top: 36, left: 4 },
    { top: 36, left: 96 },
    { top: 92, left: 24 },
    { top: 92, left: 76 },
  ],
  6: [
    { top: 4, left: 26 },
    { top: 4, left: 74 },
    { top: 50, left: 2 },
    { top: 50, left: 98 },
    { top: 96, left: 26 },
    { top: 96, left: 74 },
  ],
};

// Fallback voor >6 spelers (geen harde limiet elders in de codebase, dus
// deze functie mag nooit crashen of undefined teruggeven, sectie 28-F):
// gelijk verdeeld over een volledige ellips rond het middelpunt.
function ellipseFallback(count: number): ArenaSeatPosition[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return {
      top: Math.round((50 + 46 * Math.sin(angle)) * 100) / 100,
      left: Math.round((50 + 46 * Math.cos(angle)) * 100) / 100,
    };
  });
}

export function resolveArenaSeatPositions(count: number): ArenaSeatPosition[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const preset = SEAT_LAYOUTS[count];
  if (preset) return [...preset];
  return ellipseFallback(count);
}
