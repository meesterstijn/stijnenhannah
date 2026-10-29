import { format, subDays, subMonths } from "date-fns";
import type {
  CompetitionEntry,
  ShootingSession,
} from "@/features/schietsport/domain/model";
import {
  layoutKey,
  layoutLabel,
  scaleFor,
  shotCountFor,
  type Distance,
  type ScoreScale,
  type SessionType,
} from "@/features/schietsport/domain/rules";

// Statistieken (§6, §11). Alles werkt op voltooide, niet-verwijderde
// schietbeurten — concepten staan in een aparte lokale store en komen hier
// nooit binnen. Een oefenwedstrijd is één schietbeurt; de kaarten erin
// tellen nooit als losse resultaten.

// ── Filters ────────────────────────────────────────────────────────────

export type SessionFilter = {
  weaponIds: (string | null)[]; // leeg = alle; null = onbekend wapen
  distances: Distance[]; // leeg = alle
  disciplineIds: string[]; // leeg = alle
  types: SessionType[]; // leeg = alle
  from: string | null; // YYYY-MM-DD, inclusief
  to: string | null; // YYYY-MM-DD, inclusief
  competitionId: string | null;
};

export const EMPTY_FILTER: SessionFilter = {
  weaponIds: [],
  distances: [],
  disciplineIds: [],
  types: [],
  from: null,
  to: null,
  competitionId: null,
};

export const PERIOD_PRESETS = ["30d", "3m", "6m", "year", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  "30d": "Laatste 30 dagen",
  "3m": "Laatste 3 maanden",
  "6m": "Laatste 6 maanden",
  year: "Dit jaar",
  all: "Alle tijd",
};

const ymd = (date: Date) => format(date, "yyyy-MM-dd");

export function resolvePeriod(
  preset: PeriodPreset,
  today: Date,
): { from: string | null; to: string | null } {
  switch (preset) {
    case "30d":
      return { from: ymd(subDays(today, 29)), to: ymd(today) };
    case "3m":
      return { from: ymd(subMonths(today, 3)), to: ymd(today) };
    case "6m":
      return { from: ymd(subMonths(today, 6)), to: ymd(today) };
    case "year":
      return { from: `${today.getFullYear()}-01-01`, to: ymd(today) };
    case "all":
      return { from: null, to: null };
  }
}

export function filterSessions<T extends ShootingSession>(
  sessions: readonly T[],
  filter: SessionFilter,
  competitionEntries: readonly CompetitionEntry[] = [],
): T[] {
  const inCompetition = filter.competitionId
    ? new Set(
        competitionEntries
          .filter(
            (entry) =>
              entry.deletedAt === null &&
              entry.competitionId === filter.competitionId,
          )
          .map((entry) => entry.sessionId),
      )
    : null;

  return sessions.filter(
    (session) =>
      session.deletedAt === null &&
      (filter.weaponIds.length === 0 ||
        filter.weaponIds.includes(session.weaponId)) &&
      (filter.distances.length === 0 ||
        filter.distances.includes(session.distance)) &&
      (filter.disciplineIds.length === 0 ||
        filter.disciplineIds.includes(session.disciplineId)) &&
      (filter.types.length === 0 || filter.types.includes(session.type)) &&
      (filter.from === null || session.sessionDate >= filter.from) &&
      (filter.to === null || session.sessionDate <= filter.to) &&
      (inCompetition === null || inCompetition.has(session.id)),
  );
}

// ── Basis ──────────────────────────────────────────────────────────────

export function sortChronological<T extends ShootingSession>(
  sessions: readonly T[],
): T[] {
  return [...sessions].sort(
    (a, b) =>
      a.sessionDate.localeCompare(b.sessionDate) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function splitByScale(sessions: readonly ShootingSession[]) {
  const byScale: Record<ScoreScale, ShootingSession[]> = { 300: [], 50: [] };
  for (const session of sessions) byScale[scaleFor(session.type)].push(session);
  return byScale;
}

function assertSingleScale(sessions: readonly ShootingSession[]): ScoreScale {
  const scales = new Set(sessions.map((session) => scaleFor(session.type)));
  if (scales.size > 1) {
    // Programmeerfout: 50- en 300-scores mogen nooit samen gemiddeld worden.
    throw new Error("Scores van verschillende schalen (50/300) gemengd.");
  }
  return sessions.length > 0 ? scaleFor(sessions[0].type) : 300;
}

// Werkelijk afgevuurde schoten, ook als alleen het totaal is ingevoerd.
export function totalShots(sessions: readonly ShootingSession[]): number {
  return sessions.reduce((sum, session) => sum + shotCountFor(session.type), 0);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type ScoreSummary = {
  scale: ScoreScale;
  count: number;
  totalShots: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number; // spreiding: hoogste − laagste
  stdDev: number; // consistentie: standaardafwijking (populatie)
  percentOfMax: number; // gemiddelde als % van de schaal
};

// Samenvatting binnen één schaal. Mengen van schalen is een fout: splits
// eerst met splitByScale.
export function summarize(
  sessions: readonly ShootingSession[],
): ScoreSummary | null {
  if (sessions.length === 0) return null;
  const scale = assertSingleScale(sessions);
  const scores = sessions.map((session) => session.totalScore);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return {
    scale,
    count: scores.length,
    totalShots: totalShots(sessions),
    mean,
    median: median(scores)!,
    min,
    max,
    range: max - min,
    stdDev: Math.sqrt(variance),
    percentOfMax: (mean / scale) * 100,
  };
}

// Persoonlijk record binnen één schaal; bij gelijke score telt de eerste
// keer dat het gehaald werd.
export function personalBest(
  sessions: readonly ShootingSession[],
): ShootingSession | null {
  assertSingleScale(sessions);
  let best: ShootingSession | null = null;
  for (const session of sortChronological(sessions)) {
    if (!best || session.totalScore > best.totalScore) best = session;
  }
  return best;
}

export function latestSession(
  sessions: readonly ShootingSession[],
): ShootingSession | null {
  const sorted = sortChronological(sessions);
  return sorted[sorted.length - 1] ?? null;
}

// ── Groeperingen ───────────────────────────────────────────────────────

export function summarizeBy<K>(
  sessions: readonly ShootingSession[],
  keyOf: (session: ShootingSession) => K,
): { key: K; summary: ScoreSummary }[] {
  const groups = new Map<K, ShootingSession[]>();
  for (const session of sessions) {
    const key = keyOf(session);
    const group = groups.get(key);
    if (group) group.push(session);
    else groups.set(key, [session]);
  }
  return [...groups].map(([key, group]) => ({
    key,
    summary: summarize(group)!,
  }));
}

export function monthlyAverages(sessions: readonly ShootingSession[]) {
  return summarizeBy(sessions, (session) => session.sessionDate.slice(0, 7))
    .map(({ key, summary }) => ({
      month: key,
      mean: summary.mean,
      count: summary.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Voortschrijdend gemiddelde over de laatste `window` schietbeurten
// (chronologisch). `average` is null zolang er nog geen `window` beurten zijn.
export function movingAverage(
  sessions: readonly ShootingSession[],
  window: number,
) {
  const sorted = sortChronological(sessions);
  return sorted.map((session, index) => {
    const slice = sorted.slice(Math.max(0, index - window + 1), index + 1);
    return {
      sessionId: session.id,
      sessionDate: session.sessionDate,
      score: session.totalScore,
      average:
        slice.length < window
          ? null
          : slice.reduce((sum, s) => sum + s.totalScore, 0) / window,
    };
  });
}

// Gemiddelde per kaartpositie, alleen vergeleken binnen dezelfde indeling
// (6 × 5 en 3 × 10 zijn niet vergelijkbaar). Sessies zonder kaarten
// (alleen totaal) tellen niet mee.
export function cardPositionAverages(sessions: readonly ShootingSession[]) {
  const groups = new Map<string, ShootingSession[]>();
  for (const session of sessions) {
    if (session.cards.length === 0) continue;
    const key = layoutKey(session.cards.map((card) => card.shotCount));
    const group = groups.get(key);
    if (group) group.push(session);
    else groups.set(key, [session]);
  }
  return [...groups].map(([key, group]) => {
    const layout = group[0].cards.map((card) => card.shotCount);
    return {
      layoutKey: key,
      layoutLabel: layoutLabel(layout),
      sessionCount: group.length,
      cards: layout.map((shotCount, index) => ({
        cardNumber: index + 1,
        shotCount,
        mean:
          group.reduce((sum, session) => sum + session.cards[index].score, 0) /
          group.length,
      })),
    };
  });
}
