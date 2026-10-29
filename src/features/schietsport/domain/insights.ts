import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  SESSION_TYPE_LABELS,
  scaleFor,
  type ScoreScale,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  latestSession,
  personalBest,
  sortChronological,
  splitByScale,
  summarize,
  summarizeBy,
  totalShots,
  type ScoreSummary,
} from "@/features/schietsport/domain/stats";

// Samengestelde inzichten voor dashboard en statistieken, bovenop de
// basisfuncties in stats.ts. Nooit 50- en 300-scores door elkaar.

export type Headline = {
  latest: ShootingSession | null;
  // Gemiddelde en record: officiële wedstrijden, tenzij de typefilter die
  // uitsluit — dan de gekozen typen op hun eigen schaal.
  focus: {
    label: string;
    scale: ScoreScale;
    summary: ScoreSummary | null;
    best: ShootingSession | null;
  };
  totalShots: number;
  counts: Record<SessionType, number>;
  records: Partial<Record<SessionType, ShootingSession>>;
};

export function headline(
  sessions: readonly ShootingSession[],
  typeFilter: readonly SessionType[] = [],
): Headline {
  const counts: Record<SessionType, number> = {
    match: 0,
    practice_match: 0,
    free_card: 0,
  };
  const byType: Record<SessionType, ShootingSession[]> = {
    match: [],
    practice_match: [],
    free_card: [],
  };
  for (const session of sessions) {
    counts[session.type]++;
    byType[session.type].push(session);
  }
  const records: Partial<Record<SessionType, ShootingSession>> = {};
  for (const type of Object.keys(byType) as SessionType[]) {
    const best = byType[type].length > 0 ? personalBest(byType[type]) : null;
    if (best) records[type] = best;
  }

  let focusTypes: SessionType[];
  if (typeFilter.length === 0 || typeFilter.includes("match")) {
    focusTypes = ["match"];
  } else if (typeFilter.includes("practice_match")) {
    focusTypes = ["practice_match"];
  } else {
    focusTypes = ["free_card"];
  }
  const focusSessions = sessions.filter((s) => focusTypes.includes(s.type));
  const scale = scaleFor(focusTypes[0]);

  return {
    latest: latestSession(sessions),
    focus: {
      label: focusTypes.map((t) => SESSION_TYPE_LABELS[t]).join(" + "),
      scale,
      summary: summarize(focusSessions),
      best: focusSessions.length > 0 ? personalBest(focusSessions) : null,
    },
    totalShots: totalShots(sessions),
    counts,
    records,
  };
}

export type TrendPoint = {
  index: number;
  id: string;
  sessionDate: string;
  type: SessionType;
  score: number;
  ma5: number | null;
  ma10: number | null;
};

// Scoreverloop op één schaal: elke schietbeurt een punt (op volgorde, dus
// meerdere beurten op één dag staan naast elkaar), met voortschrijdende
// gemiddelden over de laatste 5 en 10 beurten van de getoonde reeks.
export function trendSeries(
  sessions: readonly ShootingSession[],
): TrendPoint[] {
  const sorted = sortChronological(sessions);
  const average = (end: number, window: number) => {
    if (end + 1 < window) return null;
    let sum = 0;
    for (let i = end - window + 1; i <= end; i++) sum += sorted[i].totalScore;
    return sum / window;
  };
  return sorted.map((session, index) => ({
    index,
    id: session.id,
    sessionDate: session.sessionDate,
    type: session.type,
    score: session.totalScore,
    ma5: average(index, 5),
    ma10: average(index, 10),
  }));
}

export type GroupRow = {
  key: string;
  label: string;
  summary: ScoreSummary;
};

// Gemiddelde per groep (wapen, afstand, discipline, type) binnen één schaal,
// hoogste gemiddelde eerst.
export function groupRows(
  sessions: readonly ShootingSession[],
  keyOf: (session: ShootingSession) => string,
  labelOf: (key: string) => string,
): GroupRow[] {
  return summarizeBy(sessions, keyOf)
    .map(({ key, summary }) => ({ key, label: labelOf(key), summary }))
    .sort((a, b) => b.summary.mean - a.summary.mean);
}

// Spreiding (standaardafwijking) per maand: hoe constant waren de scores.
export function monthlyConsistency(sessions: readonly ShootingSession[]) {
  return summarizeBy(sessions, (s) => s.sessionDate.slice(0, 7))
    .map(({ key, summary }) => ({
      month: key,
      mean: summary.mean,
      stdDev: summary.stdDev,
      count: summary.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export { splitByScale };
