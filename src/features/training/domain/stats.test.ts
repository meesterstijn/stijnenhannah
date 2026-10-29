import { describe, expect, it } from "vitest";
import { systemExercise } from "./exercises";
import { buildHistoryIndex, performances } from "./performance";
import {
  estimateOneRepMax,
  exerciseRecords,
  exerciseSeries,
  latestRecords,
  muscleSetCounts,
  sessionSummary,
  volumeKg,
  weekStreak,
  weeklyCounts,
} from "./stats";
import { completedWith, session, sv } from "./test-fixtures";

describe("statistiek", () => {
  it("geschatte 1RM volgens Epley, alleen 1–12 herhalingen", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 10)).toBe(80);
    expect(estimateOneRepMax(60, 15)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
  });

  it("volume exact (geen afrondingsfouten)", () => {
    expect(volumeKg([sv(0.1, 3), sv(0.2, 3)])).toBe(0.9);
    expect(volumeKg([sv(42.5, 8), sv(40, 10)])).toBe(740);
  });

  it("records en reeks per oefening", () => {
    const runs = [
      completedWith("2026-10-01", "bench-press", [sv(40, 10), sv(40, 8)]),
      completedWith("2026-10-03", "bench-press", [sv(45, 5)]),
      completedWith("2026-10-05", "bench-press", [sv(40, 12)]),
    ];
    const index = buildHistoryIndex(
      runs.map((r) => r.session),
      runs.flatMap((r) => r.sets),
    );
    const list = performances(index, "bench-press", { scope: "any" });
    const records = exerciseRecords(list);
    expect(records.heaviest).toMatchObject({
      value: 45,
      reps: 5,
      date: "2026-10-03",
    });
    expect(records.bestVolume).toMatchObject({
      value: 720,
      date: "2026-10-01",
    });
    expect(records.repsByWeight).toEqual([
      { weightKg: 45, reps: 5, date: "2026-10-03" },
      { weightKg: 40, reps: 12, date: "2026-10-05" },
    ]);
    const series = exerciseSeries(list);
    expect(series.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-03",
      "2026-10-05",
    ]);
    expect(series[1].topWeightKg).toBe(45);
  });

  it("herkent een nieuw record in de laatste training", () => {
    const runs = [
      completedWith("2026-10-01", "bench-press", [sv(40, 10)]),
      completedWith("2026-10-05", "bench-press", [sv(42, 8)]),
    ];
    const index = buildHistoryIndex(
      runs.map((r) => r.session),
      runs.flatMap((r) => r.sets),
    );
    const found = latestRecords(index, () => "weight_reps");
    expect(found).toEqual([
      expect.objectContaining({
        kind: "heaviest",
        value: 42,
        date: "2026-10-05",
      }),
    ]);
  });

  it("sessiesamenvatting", () => {
    const run = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
    ]);
    const summary = sessionSummary(run.session, run.sets);
    expect(summary).toMatchObject({
      workSets: 2,
      volumeKg: 800,
      totalReps: 20,
      durationMin: 60,
    });
  });

  it("trainingen per week en reeks", () => {
    const sessions = [
      session("2026-10-26", []),
      session("2026-10-21", []),
      session("2026-10-14", []),
      session("2026-10-13", [], { status: "cancelled" }),
    ];
    const weeks = weeklyCounts(sessions, "2026-10-29", 4);
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 1, 1]);
    expect(weekStreak(sessions, "2026-10-29")).toBe(3);
  });

  it("sets per spiergroep: primair 1, secundair ½", () => {
    const run = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
    ]);
    const counts = muscleSetCounts(
      [run.session],
      run.sets,
      systemExercise,
      "2026-10-01",
      "2026-10-07",
    );
    expect(counts.chest).toBe(2);
    expect(counts.triceps).toBe(1);
  });
});
