// Definitieve schietsportregels (projectopdracht §4). Puur TypeScript, geen
// React/IndexedDB/Supabase, zodat dezelfde regels overal gelden en los te
// testen zijn. De database dwingt dezelfde regels nog eens af (CHECKs).

export const DISTANCES = [10, 12, 25] as const;
export type Distance = (typeof DISTANCES)[number];

export const SESSION_TYPES = ["match", "free_card", "practice_match"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SHOT_MIN = 0;
export const SHOT_MAX = 10;

// Elke wedstrijd (officieel of oefen) is 30 schoten / 300 punten.
export const MATCH_SHOTS = 30;
export const FREE_CARD_SHOTS = 5;
export const PRACTICE_CARDS = 6;

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  match: "Officiële wedstrijd",
  free_card: "Vrije kaart",
  practice_match: "Oefenwedstrijd",
};

export const SESSION_TYPE_SHORT_LABELS: Record<SessionType, string> = {
  match: "Wedstrijd",
  free_card: "Vrije kaart",
  practice_match: "Oefenwedstrijd",
};

export function isDistance(value: unknown): value is Distance {
  return DISTANCES.includes(value as Distance);
}

export function isSessionType(value: unknown): value is SessionType {
  return SESSION_TYPES.includes(value as SessionType);
}

export function shotCountFor(type: SessionType): number {
  return type === "free_card" ? FREE_CARD_SHOTS : MATCH_SHOTS;
}

export function maxScoreFor(type: SessionType): number {
  return shotCountFor(type) * SHOT_MAX;
}

// Schaal waarop een type vergeleken wordt: 300 (wedstrijd + oefenwedstrijd)
// of 50 (vrije kaart). Scores van verschillende schalen worden nooit
// rechtstreeks samen gemiddeld.
export type ScoreScale = 300 | 50;

export function scaleFor(type: SessionType): ScoreScale {
  return type === "free_card" ? 50 : 300;
}

export function isValidShot(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SHOT_MIN &&
    value <= SHOT_MAX
  );
}

// ── Kaartindelingen voor een officiële wedstrijd ─────────────────────
// Een wedstrijd is altijd één serie van 30 schoten; hoe die over kaarten
// verdeeld is verschilt per discipline (bv. 25 m karabijn staand: 3 × 10).
// De gebruiker kiest zelf; dit zijn alleen snelkeuzes.

export type MatchLayout = number[]; // aantal schoten per kaart, som = 30

export const MATCH_LAYOUT_PRESETS: { label: string; layout: MatchLayout }[] = [
  { label: "1 × 30", layout: [30] },
  { label: "3 × 10", layout: [10, 10, 10] },
  { label: "6 × 5", layout: [5, 5, 5, 5, 5, 5] },
];

export const PRACTICE_LAYOUT: MatchLayout =
  Array(PRACTICE_CARDS).fill(FREE_CARD_SHOTS);
export const FREE_CARD_LAYOUT: MatchLayout = [FREE_CARD_SHOTS];

export function isValidMatchLayout(layout: unknown): layout is MatchLayout {
  return (
    Array.isArray(layout) &&
    layout.length >= 1 &&
    layout.every((n) => Number.isInteger(n) && n >= 1) &&
    layout.reduce((sum: number, n: number) => sum + n, 0) === MATCH_SHOTS
  );
}

// Compacte sleutel voor een indeling, bv. "6x5" of "10+10+10" → "3x10".
// Gebruikt om kaartanalyses alleen binnen dezelfde indeling te vergelijken.
export function layoutKey(layout: MatchLayout): string {
  if (layout.length > 0 && layout.every((n) => n === layout[0])) {
    return `${layout.length}x${layout[0]}`;
  }
  return layout.join("+");
}

export function layoutLabel(layout: MatchLayout): string {
  if (layout.length > 0 && layout.every((n) => n === layout[0])) {
    return `${layout.length} × ${layout[0]}`;
  }
  return layout.join(" + ");
}
