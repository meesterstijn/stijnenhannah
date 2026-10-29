import { describe, expect, it } from "vitest";
import type { CompetitionEntry } from "@/features/schietsport/domain/model";
import {
  EMPTY_FILTER,
  cardPositionAverages,
  filterSessions,
  median,
  monthlyAverages,
  movingAverage,
  personalBest,
  resolvePeriod,
  splitByScale,
  summarize,
  totalShots,
} from "@/features/schietsport/domain/stats";
import { makeSession } from "@/features/schietsport/domain/test-fixtures";

const cards = (scores: number[], shotCount = 5) =>
  scores.map((score, i) => ({
    id: `c${i}`,
    cardNumber: i + 1,
    shotCount,
    score,
    shots: null,
  }));

describe("filters", () => {
  const a = makeSession({
    weaponId: "A",
    distance: 12,
    disciplineId: "precisie",
    sessionDate: "2026-05-01",
  });
  const b = makeSession({
    weaponId: "B",
    distance: 12,
    disciplineId: "precisie",
    sessionDate: "2026-05-02",
  });
  const c = makeSession({
    weaponId: "A",
    distance: 25,
    disciplineId: "precisie",
    sessionDate: "2026-05-03",
  });
  const d = makeSession({
    weaponId: "A",
    distance: 12,
    disciplineId: "snelvuur",
    sessionDate: "2026-05-04",
  });
  const e = makeSession({
    weaponId: "A",
    distance: 12,
    disciplineId: "precisie",
    type: "practice_match",
    sessionDate: "2026-05-05",
  });
  const f = makeSession({
    weaponId: "A",
    distance: 12,
    disciplineId: "precisie",
    sessionDate: "2025-01-01",
  });
  const g = makeSession({
    weaponId: null,
    distance: 12,
    sessionDate: "2026-05-06",
  });
  const deleted = makeSession({
    weaponId: "A",
    distance: 12,
    disciplineId: "precisie",
    deletedAt: "2026-05-07T00:00:00Z",
  });
  const all = [a, b, c, d, e, f, g, deleted];

  it("combineert alle filters tegelijk", () => {
    const result = filterSessions(all, {
      ...EMPTY_FILTER,
      weaponIds: ["A"],
      distances: [12],
      disciplineIds: ["precisie"],
      types: ["match"],
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(result.map((s) => s.id)).toEqual([a.id]);
  });

  it("leeg filter = alles behalve verwijderde beurten", () => {
    expect(filterSessions(all, EMPTY_FILTER)).toHaveLength(7);
  });

  it("onbekend wapen is apart te filteren", () => {
    expect(
      filterSessions(all, { ...EMPTY_FILTER, weaponIds: [null] }).map(
        (s) => s.id,
      ),
    ).toEqual([g.id]);
  });

  it("meerdere wapens of typen tegelijk", () => {
    expect(
      filterSessions(all, {
        ...EMPTY_FILTER,
        weaponIds: ["A", "B"],
        distances: [12],
        disciplineIds: ["precisie"],
        types: ["match", "practice_match"],
        from: "2026-01-01",
      }).map((s) => s.id),
    ).toEqual([a.id, b.id, e.id]);
  });

  it("competitie: alleen gekoppelde, niet-verwijderde koppelingen", () => {
    const entry = (
      sessionId: string,
      deletedAt: string | null = null,
    ): CompetitionEntry => ({
      id: `e-${sessionId}`,
      userId: "u1",
      createdAt: "",
      updatedAt: "",
      deletedAt,
      version: 0,
      competitionId: "comp1",
      sessionId,
    });
    const result = filterSessions(
      all,
      { ...EMPTY_FILTER, competitionId: "comp1" },
      [entry(a.id), entry(b.id, "2026-06-01T00:00:00Z")],
    );
    expect(result.map((s) => s.id)).toEqual([a.id]);
  });
});

describe("perioden", () => {
  const today = new Date(2026, 9, 29);
  it("rekent presets uit vanaf vandaag", () => {
    expect(resolvePeriod("30d", today)).toEqual({
      from: "2026-09-30",
      to: "2026-10-29",
    });
    expect(resolvePeriod("3m", today)).toEqual({
      from: "2026-07-29",
      to: "2026-10-29",
    });
    expect(resolvePeriod("6m", today)).toEqual({
      from: "2026-04-29",
      to: "2026-10-29",
    });
    expect(resolvePeriod("year", today)).toEqual({
      from: "2026-01-01",
      to: "2026-10-29",
    });
    expect(resolvePeriod("all", today)).toEqual({ from: null, to: null });
  });
});

describe("samenvatting", () => {
  it("berekent gemiddelde, mediaan, min, max, spreiding en % van maximum", () => {
    const summary = summarize(
      [280, 290, 270, 300].map((totalScore) => makeSession({ totalScore })),
    );
    expect(summary).toMatchObject({
      scale: 300,
      count: 4,
      totalShots: 120,
      mean: 285,
      median: 285,
      min: 270,
      max: 300,
      range: 30,
      percentOfMax: 95,
    });
    expect(summary!.stdDev).toBeCloseTo(11.18, 2);
  });

  it("mediaan bij oneven en lege reeks", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });

  it("50- en 300-scores worden nooit samen gemiddeld", () => {
    const mixed = [
      makeSession({ type: "match", totalScore: 280 }),
      makeSession({ type: "free_card", totalScore: 45 }),
    ];
    expect(() => summarize(mixed)).toThrow();
    const { 300: big, 50: small } = splitByScale(mixed);
    expect(summarize(big)!.mean).toBe(280);
    expect(summarize(small)!.mean).toBe(45);
  });

  it("wedstrijd en oefenwedstrijd zijn samen te vergelijken op schaal 300", () => {
    const summary = summarize([
      makeSession({ type: "match", totalScore: 280 }),
      makeSession({ type: "practice_match", totalScore: 290 }),
    ]);
    expect(summary!.mean).toBe(285);
  });

  it("schoten tellen ook mee als alleen het totaal bekend is", () => {
    expect(
      totalShots([
        makeSession({ type: "match" }),
        makeSession({ type: "free_card", totalScore: 40 }),
        makeSession({ type: "practice_match" }),
      ]),
    ).toBe(65);
  });

  it("lege reeks geeft geen samenvatting", () => {
    expect(summarize([])).toBeNull();
  });
});

describe("persoonlijk record", () => {
  it("hoogste score; bij gelijkspel telt de eerste keer", () => {
    const first = makeSession({ totalScore: 295, sessionDate: "2026-02-01" });
    const later = makeSession({ totalScore: 295, sessionDate: "2026-04-01" });
    const lower = makeSession({ totalScore: 280, sessionDate: "2026-05-01" });
    expect(personalBest([later, lower, first])?.id).toBe(first.id);
    expect(personalBest([])).toBeNull();
  });
});

describe("trends", () => {
  it("voortschrijdend gemiddelde over de laatste N beurten", () => {
    const sessions = [270, 280, 290, 300].map((totalScore, i) =>
      makeSession({ totalScore, sessionDate: `2026-01-0${i + 1}` }),
    );
    expect(movingAverage(sessions, 3).map((p) => p.average)).toEqual([
      null,
      null,
      280,
      290,
    ]);
  });

  it("gemiddelde per maand", () => {
    expect(
      monthlyAverages([
        makeSession({ totalScore: 280, sessionDate: "2026-02-10" }),
        makeSession({ totalScore: 290, sessionDate: "2026-01-10" }),
        makeSession({ totalScore: 270, sessionDate: "2026-02-20" }),
      ]),
    ).toEqual([
      { month: "2026-01", mean: 290, count: 1 },
      { month: "2026-02", mean: 275, count: 2 },
    ]);
  });
});

describe("kaartanalyse", () => {
  it("gemiddelde per kaart, alleen binnen dezelfde indeling", () => {
    const result = cardPositionAverages([
      makeSession({
        type: "practice_match",
        cards: cards([46, 48, 50, 44, 47, 49]),
      }),
      makeSession({
        type: "practice_match",
        cards: cards([48, 48, 46, 46, 49, 47]),
      }),
      makeSession({ type: "match", cards: cards([95, 97, 92], 10) }),
      makeSession({ type: "match", cards: [] }),
    ]);
    expect(result).toHaveLength(2);
    const sixByFive = result.find((r) => r.layoutKey === "6x5")!;
    expect(sixByFive.sessionCount).toBe(2);
    expect(sixByFive.cards.map((c) => c.mean)).toEqual([
      47, 48, 48, 45, 48, 48,
    ]);
    const threeByTen = result.find((r) => r.layoutKey === "3x10")!;
    expect(threeByTen.cards.map((c) => c.mean)).toEqual([95, 97, 92]);
  });

  it("een oefenwedstrijd telt als één schietbeurt, niet als zes", () => {
    const practice = makeSession({
      type: "practice_match",
      totalScore: 289,
      cards: cards([47, 49, 48, 50, 46, 49]),
    });
    const filtered = filterSessions([practice], EMPTY_FILTER);
    expect(filtered).toHaveLength(1);
    expect(summarize(filtered)).toMatchObject({
      count: 1,
      mean: 289,
      totalShots: 30,
    });
    // Zes kaarten van max 50 komen nooit in de 50-schaal terecht.
    expect(splitByScale(filtered)[50]).toHaveLength(0);
  });
});
