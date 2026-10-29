import { describe, expect, it } from "vitest";
import {
  buildHistoryIndex,
  buildPrescription,
  previousPerformance,
  progressionHint,
  performances,
  type PrescriptionInput,
} from "./performance";
import {
  completedWith,
  doneSet,
  session,
  snapshotExercise,
  sv,
} from "./test-fixtures";

const bench: PrescriptionInput = {
  sets: 3,
  warmupSets: 0,
  repMin: 8,
  repMax: 10,
  durationSec: null,
  startWeightKg: null,
  tracking: "weight_reps",
};

describe("vorige prestatie wordt de nieuwe opdracht", () => {
  it("neemt per set exact gewicht en herhalingen van de vorige keer over", () => {
    const a = completedWith("2026-10-05", "bench-press", [
      sv(40, 10),
      sv(40, 10),
      sv(40, 8),
    ]);
    const index = buildHistoryIndex([a.session], a.sets);
    const previous = previousPerformance(index, "bench-press", {
      scope: "any",
    });
    const today = buildPrescription(bench, previous);
    expect(today.work).toEqual([sv(40, 10), sv(40, 10), sv(40, 8)]);
    expect(today.source).toMatchObject({
      kind: "previous",
      sessionId: a.session.id,
      date: "2026-10-05",
    });
  });

  it("verhoogt nooit automatisch gewicht of herhalingen", () => {
    const runs = ["2026-10-01", "2026-10-03", "2026-10-05"].map((d) =>
      completedWith(d, "bench-press", [sv(40, 10), sv(40, 10), sv(40, 10)]),
    );
    const index = buildHistoryIndex(
      runs.map((r) => r.session),
      runs.flatMap((r) => r.sets),
    );
    const today = buildPrescription(
      bench,
      previousPerformance(index, "bench-press", { scope: "any" }),
    );
    expect(today.work.every((s) => s.weightKg === 40 && s.reps === 10)).toBe(
      true,
    );
  });

  it("gebruikt de meest recente voltooide sessie", () => {
    const old = completedWith("2026-10-01", "bench-press", [sv(35, 10)]);
    const recent = completedWith("2026-10-08", "bench-press", [sv(42, 6)]);
    const index = buildHistoryIndex(
      [recent.session, old.session],
      [...old.sets, ...recent.sets],
    );
    expect(
      previousPerformance(index, "bench-press", { scope: "any" })?.sessionId,
    ).toBe(recent.session.id);
  });

  it("negeert geannuleerde, actieve, onderbroken en verwijderde sessies", () => {
    const good = completedWith("2026-10-01", "bench-press", [sv(40, 10)]);
    const cancelled = completedWith("2026-10-02", "bench-press", [sv(60, 1)], {
      status: "cancelled",
    });
    const active = completedWith("2026-10-03", "bench-press", [sv(61, 1)], {
      status: "active",
      endedAt: null,
    });
    const paused = completedWith("2026-10-04", "bench-press", [sv(62, 1)], {
      status: "paused",
    });
    const deleted = completedWith("2026-10-05", "bench-press", [sv(63, 1)], {
      deletedAt: "2026-10-06T00:00:00Z",
    });
    const all = [good, cancelled, active, paused, deleted];
    const index = buildHistoryIndex(
      all.map((r) => r.session),
      all.flatMap((r) => r.sets),
    );
    expect(
      previousPerformance(index, "bench-press", { scope: "any" })?.sessionId,
    ).toBe(good.session.id);
  });

  it("negeert verwijderde (ongedaan gemaakte) sets", () => {
    const run = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
    ]);
    run.sets[1].deletedAt = "2026-10-01T10:05:00Z";
    const index = buildHistoryIndex([run.session], run.sets);
    const today = buildPrescription(
      { ...bench, sets: 2 },
      previousPerformance(index, "bench-press", { scope: "any" }),
    );
    // Set 2 niet gedaan: het doel van toen blijft staan.
    expect(today.work).toEqual([sv(40, 10), sv(40, 10)]);
  });

  it("houdt varianten gescheiden", () => {
    const db = completedWith("2026-10-01", "db-bench-press", [sv(16, 12)]);
    const index = buildHistoryIndex([db.session], db.sets);
    expect(
      previousPerformance(index, "bench-press", { scope: "any" }),
    ).toBeNull();
  });

  it("kan beperken tot hetzelfde schema", () => {
    const other = completedWith("2026-10-08", "bench-press", [sv(50, 5)], {
      programId: "p-2",
    });
    const own = completedWith("2026-10-01", "bench-press", [sv(40, 10)], {
      programId: "p-1",
    });
    const index = buildHistoryIndex(
      [other.session, own.session],
      [...other.sets, ...own.sets],
    );
    expect(
      previousPerformance(index, "bench-press", { scope: "any" })?.programId,
    ).toBe("p-2");
    expect(
      previousPerformance(index, "bench-press", {
        scope: "program",
        programId: "p-1",
      })?.sessionId,
    ).toBe(own.session.id);
  });

  it("begint zonder historie met de doelen uit het schema, zonder verzonnen gewicht", () => {
    const today = buildPrescription(bench, null);
    expect(today.work).toEqual([sv(null, 8), sv(null, 8), sv(null, 8)]);
    expect(today.source).toEqual({ kind: "plan" });
    const withStart = buildPrescription({ ...bench, startWeightKg: 30 }, null);
    expect(withStart.work[0]).toEqual(sv(30, 8));
  });

  it("onthoudt zelf toegevoegde of verwijderde sets", () => {
    const s = session("2026-10-01", [
      snapshotExercise(
        0,
        "bench-press",
        [sv(40, 10), sv(40, 10), sv(40, 10), sv(40, 10)],
        { plannedSets: 3 },
      ),
    ]);
    const sets = [0, 1, 2, 3].map((i) =>
      doneSet(s, 0, "bench-press", i, sv(40, 10)),
    );
    const index = buildHistoryIndex([s], sets);
    expect(
      buildPrescription(
        bench,
        previousPerformance(index, "bench-press", { scope: "any" }),
      ).work,
    ).toHaveLength(4);
  });

  it("volgt het schema als het aantal sets daar sindsdien is aangepast", () => {
    const run = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
      sv(40, 8),
    ]);
    const index = buildHistoryIndex([run.session], run.sets);
    const previous = previousPerformance(index, "bench-press", {
      scope: "any",
    });
    expect(buildPrescription({ ...bench, sets: 4 }, previous).work).toEqual([
      sv(40, 10),
      sv(40, 10),
      sv(40, 8),
      sv(40, 8),
    ]);
    expect(buildPrescription({ ...bench, sets: 2 }, previous).work).toEqual([
      sv(40, 10),
      sv(40, 10),
    ]);
  });

  it("neemt bij een voortijdig beëindigde training het oude doel over voor niet gedane sets", () => {
    const s = session("2026-10-01", [
      snapshotExercise(0, "bench-press", [sv(40, 10), sv(40, 10), sv(40, 10)]),
    ]);
    const sets = [doneSet(s, 0, "bench-press", 0, sv(40, 9))];
    const index = buildHistoryIndex([s], sets);
    expect(
      buildPrescription(
        bench,
        previousPerformance(index, "bench-press", { scope: "any" }),
      ).work,
    ).toEqual([sv(40, 9), sv(40, 10), sv(40, 10)]);
  });

  it("verwerkt een correctie achteraf in de volgende opdracht", () => {
    const run = completedWith("2026-10-01", "bench-press", [sv(40, 10)]);
    run.sets[0] = { ...run.sets[0], weightKg: 42.5, reps: 7 };
    const index = buildHistoryIndex([run.session], run.sets);
    expect(
      buildPrescription(
        { ...bench, sets: 1 },
        previousPerformance(index, "bench-press", { scope: "any" }),
      ).work,
    ).toEqual([sv(42.5, 7)]);
  });

  it("slaat de eigen sessie over bij hervatten", () => {
    const run = completedWith("2026-10-01", "bench-press", [sv(40, 10)]);
    const index = buildHistoryIndex([run.session], run.sets);
    expect(
      previousPerformance(index, "bench-press", {
        scope: "any",
        excludeSessionId: run.session.id,
      }),
    ).toBeNull();
  });
});

describe("progressiesuggestie", () => {
  const history = (reps: number[][], weight = 40) => {
    const runs = reps.map((r, i) =>
      completedWith(
        `2026-10-0${i + 1}`,
        "bench-press",
        r.map((n) => sv(weight, n)),
      ),
    );
    return buildHistoryIndex(
      runs.map((r) => r.session),
      runs.flatMap((r) => r.sets),
    );
  };

  it("geeft alleen een hint na drie keer alle sets op het bovenste doel", () => {
    const index = history([
      [10, 10, 10],
      [10, 10, 10],
      [10, 10, 11],
    ]);
    expect(
      progressionHint(
        performances(index, "bench-press", { scope: "any" }),
        "weight_reps",
      ),
    ).toMatch(/klaar voor een verhoging/);
  });

  it("geen hint als één set het doel niet haalde", () => {
    const index = history([
      [10, 10, 10],
      [10, 10, 9],
      [10, 10, 10],
    ]);
    expect(
      progressionHint(
        performances(index, "bench-press", { scope: "any" }),
        "weight_reps",
      ),
    ).toBeNull();
  });

  it("geen hint bij minder dan drie trainingen", () => {
    const index = history([
      [10, 10, 10],
      [10, 10, 10],
    ]);
    expect(
      progressionHint(
        performances(index, "bench-press", { scope: "any" }),
        "weight_reps",
      ),
    ).toBeNull();
  });
});
