import { describe, expect, it } from "vitest";
import type { CompetitionPeriod } from "@/features/schietsport/domain/model";
import {
  bestOfStandings,
  eligibleSessions,
  evenPeriods,
  membershipEntries,
  periodStandings,
  periodTotals,
  periodsToFreeze,
  validatePeriods,
} from "@/features/schietsport/domain/competition";
import { makeSession } from "@/features/schietsport/domain/test-fixtures";

const base = (patch: Partial<CompetitionPeriod>): CompetitionPeriod => ({
  id: "c1",
  userId: "u1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  version: 1,
  name: "Test",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  disciplineId: null,
  notes: null,
  archivedAt: null,
  ...patch,
});

const at = (
  sessionDate: string,
  totalScore: number,
  createdAt = `${sessionDate}T20:00:00`,
) =>
  makeSession({
    sessionDate,
    totalScore,
    createdAt: new Date(createdAt).toISOString(),
  });

describe("periodes instellen", () => {
  it("verdeelt het jaar in 5 aaneengesloten periodes", () => {
    const periods = evenPeriods(2026);
    expect(periods).toHaveLength(5);
    expect(periods[0].start).toBe("2026-01-01");
    expect(periods[4].end).toBe("2026-12-31");
    expect(
      validatePeriods(periods, { start: "2026-01-01", end: "2026-12-31" }),
    ).toBeNull();
  });

  it("weigert overlap, verkeerde volgorde en datums buiten het jaar", () => {
    const range = { start: "2026-01-01", end: "2026-12-31" };
    expect(
      validatePeriods(
        [
          { start: "2026-01-01", end: "2026-03-01" },
          { start: "2026-03-01", end: "2026-05-01" },
        ],
        range,
      ),
    ).toMatch(/overlapt/);
    expect(
      validatePeriods([{ start: "2026-03-01", end: "2026-02-01" }], range),
    ).toMatch(/vóór/);
    expect(
      validatePeriods([{ start: "2025-12-01", end: "2026-02-01" }], range),
    ).toMatch(/buiten/);
    expect(validatePeriods([], range)).toMatch(/minstens/);
  });
});

describe("puntenbord", () => {
  const competition = base({
    ruleType: "periods",
    rules: {
      sessionType: "match",
      periods: [
        { start: "2026-01-01", end: "2026-03-31" },
        { start: "2026-04-01", end: "2026-06-30" },
        { start: "2026-07-01", end: "2026-09-30" },
      ],
    },
  });

  it("hoogste score per periode telt; status volgt de datum", () => {
    const sessions = [
      at("2026-02-01", 280),
      at("2026-03-15", 287),
      at("2026-04-10", 279),
    ];
    const standings = periodStandings(competition, sessions, "2026-05-01");
    expect(
      standings.map((p) => [p.status, p.best?.score ?? null, p.sessionCount]),
    ).toEqual([
      ["closed", 287, 2],
      ["open", 279, 1],
      ["upcoming", null, 0],
    ]);
    expect(periodTotals(standings)).toMatchObject({
      total: 566,
      counted: 2,
      average: 283,
    });
  });

  it("een hogere score in de lopende periode verbetert die periode", () => {
    const sessions = [at("2026-04-10", 279), at("2026-05-20", 290)];
    expect(
      periodStandings(competition, sessions, "2026-05-21")[1].best?.score,
    ).toBe(290);
  });

  it("achteraf invoeren verbetert een afgelopen periode niet", () => {
    const late = at("2026-03-20", 299, "2026-04-05T10:00:00");
    const sessions = [at("2026-02-01", 280), late];
    expect(
      periodStandings(competition, sessions, "2026-04-06")[0].best?.score,
    ).toBe(280);
  });

  it("een vastgezette periode verandert niet meer, ook niet door bewerken", () => {
    const sessions = [at("2026-02-01", 280)];
    const standings = periodStandings(competition, sessions, "2026-04-02");
    const frozen = periodsToFreeze(competition, standings);
    expect(frozen).toEqual([
      { period: 0, sessionId: sessions[0].id, score: 280 },
    ]);
    const locked = { ...competition, rules: { ...competition.rules, frozen } };
    const edited = [{ ...sessions[0], totalScore: 295 }];
    expect(periodStandings(locked, edited, "2026-04-02")[0]).toMatchObject({
      frozen: true,
      best: { score: 280 },
    });
    expect(
      periodsToFreeze(locked, periodStandings(locked, edited, "2026-04-02")),
    ).toEqual([]);
  });

  it("alleen het ingestelde type, de discipline en de afstand tellen", () => {
    const c = {
      ...competition,
      disciplineId: "d1",
      rules: { ...competition.rules, distance: 25 as const },
    };
    const sessions = [
      at("2026-02-01", 280),
      makeSession({
        sessionDate: "2026-02-02",
        type: "free_card",
        totalScore: 48,
      }),
      makeSession({
        sessionDate: "2026-02-03",
        disciplineId: "anders",
        totalScore: 299,
      }),
      makeSession({ sessionDate: "2026-02-04", distance: 12, totalScore: 298 }),
    ];
    expect(eligibleSessions(c, sessions).map((s) => s.totalScore)).toEqual([
      280,
    ]);
  });
});

describe("beste 5 (klapschijf)", () => {
  const competition = base({
    ruleType: "best_of",
    rules: { sessionType: "match", bestCount: 5 },
  });

  it("de eerste 5 vullen de plekken; daarna vervangt een hogere score de laagste", () => {
    const scores = [270, 280, 275, 290, 260, 265, 285, 250];
    const sessions = scores.map((s, i) => at(`2026-0${(i % 9) + 1}-10`, s));
    const result = bestOfStandings(competition, sessions);
    // 265 vervangt 260; 285 vervangt 265; 250 telt niet.
    expect(result.slots.map((s) => s.score)).toEqual([290, 285, 280, 275, 270]);
    expect(result.total).toBe(1400);
    expect(result.threshold).toBe(270);
    expect(result.counted.size).toBe(5);
  });

  it("met minder dan 5 scores tellen ze allemaal en is er nog geen drempel", () => {
    const result = bestOfStandings(competition, [
      at("2026-01-10", 270),
      at("2026-02-10", 280),
    ]);
    expect(result.slots).toHaveLength(2);
    expect(result.threshold).toBeNull();
  });

  it("een gelijke score vervangt de laagste niet", () => {
    const sessions = [270, 270, 270, 270, 270, 270].map((s, i) =>
      at(`2026-0${i + 1}-10`, s),
    );
    const result = bestOfStandings(competition, sessions);
    expect(result.counted.has(sessions[5].id)).toBe(false);
  });
});

describe("lidmaatschap voor filters", () => {
  it("regelcompetities leiden hun beurten af; handmatige gebruiken koppelingen", () => {
    const rules = base({
      id: "r",
      ruleType: "best_of",
      rules: { sessionType: "match" },
    });
    const manual = base({ id: "m" });
    const s1 = at("2026-02-01", 280);
    const s2 = at("2026-03-01", 285);
    const entries = membershipEntries(
      [rules, manual],
      [s1, s2],
      [
        {
          id: "e",
          userId: "u1",
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
          version: 1,
          competitionId: "m",
          sessionId: s2.id,
        },
      ],
    );
    expect(
      entries.filter((e) => e.competitionId === "r").map((e) => e.sessionId),
    ).toEqual([s1.id, s2.id]);
    expect(
      entries.filter((e) => e.competitionId === "m").map((e) => e.sessionId),
    ).toEqual([s2.id]);
  });
});

describe("puntenbord halverwege het jaar aanmaken", () => {
  it("periodes die al voorbij waren mag je aanvullen met oude uitslagen; ze worden niet vastgezet", () => {
    const c = base({
      createdAt: new Date("2026-10-29T12:00:00").toISOString(),
      ruleType: "periods",
      rules: {
        sessionType: "match",
        periods: [
          { start: "2026-01-01", end: "2026-03-31" },
          { start: "2026-10-01", end: "2026-12-31" },
        ],
      },
    });
    const backfilled = at("2026-02-10", 284, "2026-10-29T13:00:00");
    const standings = periodStandings(c, [backfilled], "2026-10-29");
    expect(standings[0]).toMatchObject({
      historic: true,
      status: "closed",
      best: { score: 284 },
    });
    expect(periodsToFreeze(c, standings)).toEqual([]);
  });
});
