import { addDays, differenceInCalendarDays, format } from "date-fns";
import type {
  CompetitionEntry,
  CompetitionPeriod,
  CompetitionRuleType,
  CompetitionRules,
  ShootingSession,
} from "@/features/schietsport/domain/model";
import type { SessionType } from "@/features/schietsport/domain/rules";
import { sortChronological } from "@/features/schietsport/domain/stats";

// Competitieregels zoals de vereniging ze hanteert.
//
//   periods (puntenbord): het jaar is verdeeld in periodes. Een schietbeurt
//     telt voor de periode waarin de datum valt; de hoogste score per periode
//     telt. Is een periode voorbij, dan ligt die vast: later ingevoerde of
//     bewerkte beurten veranderen die score niet meer (rules.frozen).
//   best_of (bv. klapschijf): de eerste N scores vullen de N plekken; daarna
//     vervangt een nieuwe score de laagste, maar alleen als die hoger is.
//   manual: wedstrijden handmatig koppelen (de oude werking).
//
// Hoe de vereniging de periodes tot één eindstand combineert is niet
// opgegeven; de app toont per periode de score plus som en gemiddelde.

export const DEFAULT_PERIOD_COUNT = 5;
export const DEFAULT_BEST_COUNT = 5;

export const RULE_TYPE_LABELS: Record<CompetitionRuleType, string> = {
  periods: "Puntenbord (periodes)",
  best_of: "Beste scores",
  manual: "Handmatig koppelen",
};

export function ruleTypeOf(c: CompetitionPeriod): CompetitionRuleType {
  return c.ruleType ?? "manual";
}

export function sessionTypeOf(c: CompetitionPeriod): SessionType {
  return c.rules?.sessionType ?? "match";
}

export function bestCountOf(c: CompetitionPeriod): number {
  return c.rules?.bestCount ?? DEFAULT_BEST_COUNT;
}

const ymd = (date: Date) => format(date, "yyyy-MM-dd");

// Het jaar in `count` aaneengesloten periodes van (bijna) gelijke lengte.
export function evenPeriods(
  year: number,
  count = DEFAULT_PERIOD_COUNT,
): { start: string; end: string }[] {
  const first = new Date(year, 0, 1);
  const days = differenceInCalendarDays(new Date(year + 1, 0, 1), first);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(first, Math.round((days * i) / count));
    const end = addDays(first, Math.round((days * (i + 1)) / count) - 1);
    return { start: ymd(start), end: ymd(end) };
  });
}

export function validatePeriods(
  periods: { start: string; end: string }[],
  range: { start: string; end: string },
): string | null {
  if (periods.length === 0) return "Voeg minstens één periode toe.";
  for (const [i, p] of periods.entries()) {
    if (!p.start || !p.end)
      return `Periode ${i + 1}: vul begin- en einddatum in.`;
    if (p.end < p.start)
      return `Periode ${i + 1}: de einddatum ligt vóór de begindatum.`;
    if (p.start < range.start || p.end > range.end) {
      return `Periode ${i + 1} valt buiten het jaar.`;
    }
    if (i > 0 && p.start <= periods[i - 1].end) {
      return `Periode ${i + 1} overlapt met periode ${i} of staat niet op volgorde.`;
    }
  }
  return null;
}

// Schietbeurten die volgens de instellingen meetellen (type, datum binnen
// de competitie, discipline, afstand). Bij "manual": de gekoppelde.
export function eligibleSessions<T extends ShootingSession>(
  c: CompetitionPeriod,
  sessions: readonly T[],
  entries: readonly CompetitionEntry[] = [],
): T[] {
  if (ruleTypeOf(c) === "manual") {
    const linked = new Set(
      entries
        .filter((e) => e.deletedAt === null && e.competitionId === c.id)
        .map((e) => e.sessionId),
    );
    return sortChronological(
      sessions.filter((s) => s.deletedAt === null && linked.has(s.id)),
    );
  }
  const type = sessionTypeOf(c);
  const distance = c.rules?.distance ?? null;
  return sortChronological(
    sessions.filter(
      (s) =>
        s.deletedAt === null &&
        s.type === type &&
        s.sessionDate >= c.startDate &&
        s.sessionDate <= c.endDate &&
        (!c.disciplineId || s.disciplineId === c.disciplineId) &&
        (distance === null || s.distance === distance),
    ),
  );
}

// ── Puntenbord ─────────────────────────────────────────────────────────

export type PeriodStatus = "upcoming" | "open" | "closed";

export type PeriodStanding = {
  index: number;
  start: string;
  end: string;
  status: PeriodStatus;
  best: { sessionId: string | null; score: number } | null;
  sessionCount: number;
  frozen: boolean;
  // Was al voorbij toen de competitie werd aangemaakt: oude uitslagen mogen
  // worden aangevuld en de periode wordt niet vastgezet.
  historic: boolean;
};

const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).getTime();

function bestOf(sessions: readonly ShootingSession[]) {
  let best: ShootingSession | null = null;
  for (const s of sessions)
    if (!best || s.totalScore > best.totalScore) best = s;
  return best;
}

export function periodStandings(
  c: CompetitionPeriod,
  sessions: readonly ShootingSession[],
  today: string,
): PeriodStanding[] {
  const eligible = eligibleSessions(c, sessions);
  const frozen = new Map((c.rules?.frozen ?? []).map((f) => [f.period, f]));
  return (c.rules?.periods ?? []).map((period, index) => {
    const status: PeriodStatus =
      today < period.start
        ? "upcoming"
        : today > period.end
          ? "closed"
          : "open";
    const historic =
      status === "closed" && endOfDay(period.end) < Date.parse(c.createdAt);
    const inPeriod = eligible.filter(
      (s) =>
        s.sessionDate >= period.start &&
        s.sessionDate <= period.end &&
        // Na afloop telt alleen wat vóór het einde van de periode was
        // ingevoerd: achteraf invoeren verbetert een oude periode niet.
        // Uitzondering: periodes die al voorbij waren bij het aanmaken.
        (status !== "closed" ||
          historic ||
          Date.parse(s.createdAt) <= endOfDay(period.end)),
    );
    const snapshot = frozen.get(index);
    if (status === "closed" && !historic && snapshot) {
      return {
        index,
        ...period,
        status,
        best:
          snapshot.score === null
            ? null
            : { sessionId: snapshot.sessionId, score: snapshot.score },
        sessionCount: inPeriod.length,
        frozen: true,
        historic,
      };
    }
    const best = bestOf(inPeriod);
    return {
      index,
      ...period,
      status,
      best: best ? { sessionId: best.id, score: best.totalScore } : null,
      sessionCount: inPeriod.length,
      frozen: false,
      historic,
    };
  });
}

// Afgelopen periodes die nog vastgezet moeten worden.
export function periodsToFreeze(
  c: CompetitionPeriod,
  standings: PeriodStanding[],
): NonNullable<CompetitionRules["frozen"]> {
  return standings
    .filter((p) => p.status === "closed" && !p.frozen && !p.historic)
    .map((p) => ({
      period: p.index,
      sessionId: p.best?.sessionId ?? null,
      score: p.best?.score ?? null,
    }));
}

export function periodTotals(standings: PeriodStanding[]) {
  const scores = standings.flatMap((p) => (p.best ? [p.best.score] : []));
  return {
    total: scores.reduce((sum, s) => sum + s, 0),
    counted: scores.length,
    average:
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null,
    current: standings.find((p) => p.status === "open") ?? null,
  };
}

// ── Beste N ────────────────────────────────────────────────────────────

export type BestOfSlot = {
  sessionId: string;
  score: number;
  sessionDate: string;
};

export function bestOfStandings(
  c: CompetitionPeriod,
  sessions: readonly ShootingSession[],
) {
  const n = bestCountOf(c);
  const slots: BestOfSlot[] = [];
  const counted = new Set<string>();
  for (const s of eligibleSessions(c, sessions)) {
    const slot = {
      sessionId: s.id,
      score: s.totalScore,
      sessionDate: s.sessionDate,
    };
    if (slots.length < n) {
      slots.push(slot);
      continue;
    }
    // Laagste plek (bij gelijke laagste: de oudste) wordt alleen vervangen
    // door een hogere score.
    let lowest = 0;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].score < slots[lowest].score) lowest = i;
    }
    if (s.totalScore > slots[lowest].score) slots[lowest] = slot;
  }
  for (const slot of slots) counted.add(slot.sessionId);
  const total = slots.reduce((sum, s) => sum + s.score, 0);
  const full = slots.length >= n;
  return {
    size: n,
    slots: [...slots].sort(
      (a, b) => b.score - a.score || a.sessionDate.localeCompare(b.sessionDate),
    ),
    total,
    average: slots.length > 0 ? total / slots.length : null,
    // Bij een volle lijst moet een nieuwe score hier boven uitkomen.
    threshold: full ? Math.min(...slots.map((s) => s.score)) : null,
    counted,
  };
}

// ── Lidmaatschap (voor filters) ────────────────────────────────────────

// Koppelingen zoals filterSessions die verwacht: echte (handmatig) plus
// afgeleide voor competities met regels.
export function membershipEntries(
  competitions: readonly CompetitionPeriod[],
  sessions: readonly ShootingSession[],
  entries: readonly CompetitionEntry[],
): CompetitionEntry[] {
  const derived: CompetitionEntry[] = [];
  for (const c of competitions) {
    if (ruleTypeOf(c) === "manual") continue;
    for (const s of eligibleSessions(c, sessions)) {
      derived.push({
        id: `${c.id}:${s.id}`,
        userId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deletedAt: null,
        version: 0,
        competitionId: c.id,
        sessionId: s.id,
      });
    }
  }
  const manualIds = new Set(
    competitions.filter((c) => ruleTypeOf(c) === "manual").map((c) => c.id),
  );
  return [...entries.filter((e) => manualIds.has(e.competitionId)), ...derived];
}
