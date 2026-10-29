import { describe, expect, it } from "vitest";
import {
  groupRows,
  headline,
  monthlyConsistency,
  trendSeries,
} from "@/features/schietsport/domain/insights";
import { makeSession } from "@/features/schietsport/domain/test-fixtures";

const sessions = [
  makeSession({ type: "match", totalScore: 280, sessionDate: "2026-09-01" }),
  makeSession({ type: "match", totalScore: 290, sessionDate: "2026-10-01" }),
  makeSession({
    type: "practice_match",
    totalScore: 295,
    sessionDate: "2026-10-05",
  }),
  makeSession({ type: "free_card", totalScore: 48, sessionDate: "2026-10-10" }),
];

describe("dashboard-kerncijfers", () => {
  it("gemiddelde en record zijn van officiële wedstrijden; schalen niet gemengd", () => {
    const result = headline(sessions);
    expect(result.focus).toMatchObject({
      label: "Wedstrijd",
      scale: 300,
    });
    expect(result.focus.summary?.mean).toBe(285);
    expect(result.focus.best?.totalScore).toBe(290);
    expect(result.latest?.type).toBe("free_card");
    expect(result.counts).toEqual({
      match: 2,
      practice_match: 1,
      free_card: 1,
    });
    expect(result.totalShots).toBe(30 + 30 + 30 + 5);
    expect(result.records.practice_match?.totalScore).toBe(295);
    expect(result.records.free_card?.totalScore).toBe(48);
  });

  it("met alleen vrije kaarten geselecteerd: schaal 50", () => {
    const result = headline(
      sessions.filter((s) => s.type === "free_card"),
      ["free_card"],
    );
    expect(result.focus).toMatchObject({ label: "Vrije kaart", scale: 50 });
    expect(result.focus.summary?.mean).toBe(48);
  });

  it("zonder gegevens", () => {
    const result = headline([]);
    expect(result.latest).toBeNull();
    expect(result.focus.summary).toBeNull();
    expect(result.totalShots).toBe(0);
  });
});

describe("grafiekdata", () => {
  it("scoreverloop met voortschrijdend gemiddelde van 5", () => {
    const series = trendSeries(
      [270, 280, 290, 300, 280, 290].map((totalScore, i) =>
        makeSession({ totalScore, sessionDate: `2026-01-0${i + 1}` }),
      ),
    );
    expect(series.map((p) => p.ma5)).toEqual([
      null,
      null,
      null,
      null,
      284,
      288,
    ]);
    expect(series.every((p) => p.ma10 === null)).toBe(true);
    expect(series.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("groepen op gemiddelde, hoogste eerst", () => {
    const rows = groupRows(
      [
        makeSession({ distance: 10, totalScore: 290 }),
        makeSession({ distance: 25, totalScore: 270 }),
        makeSession({ distance: 25, totalScore: 280 }),
      ],
      (s) => String(s.distance),
      (key) => `${key} m`,
    );
    expect(rows.map((r) => [r.label, r.summary.mean, r.summary.count])).toEqual(
      [
        ["10 m", 290, 1],
        ["25 m", 275, 2],
      ],
    );
  });

  it("spreiding per maand", () => {
    expect(
      monthlyConsistency([
        makeSession({ totalScore: 280, sessionDate: "2026-02-01" }),
        makeSession({ totalScore: 290, sessionDate: "2026-02-15" }),
      ]),
    ).toEqual([{ month: "2026-02", mean: 285, stdDev: 5, count: 2 }]);
  });
});
