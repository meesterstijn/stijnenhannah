import { describe, expect, it } from "vitest";
import {
  buildHistoryIndex,
  buildPrescription,
  coachAdvice,
  performances,
  previousPerformance,
  type PrescriptionInput,
} from "./performance";
import {
  initialTargets,
  resizeTargets,
  sameTargets,
  withTargets,
} from "./set-targets";
import { doneSet, session, snapshotExercise, sv } from "./test-fixtures";
import type { PlannedExercise, PlannedSetTarget, SetValues } from "./types";

const t = (weightKg: number | null, reps: number | null): PlannedSetTarget => ({
  weightKg,
  reps,
  durationSec: null,
});

const pyramid = [t(20, 10), t(25, 10), t(30, 8)];

const input: PrescriptionInput = {
  sets: 3,
  warmupSets: 0,
  repMin: 8,
  repMax: 10,
  durationSec: null,
  startWeightKg: 15,
  tracking: "weight_reps",
  setTargets: pyramid,
};

// Voltooide training waarbij het schema toen `plannedTargets` had.
function ranWith(done: SetValues[], plannedTargets: PlannedSetTarget[] | null) {
  const s = session("2026-11-01", [
    snapshotExercise(0, "leg-press", done, { plannedTargets }),
  ]);
  const sets = done.map((v, i) => doneSet(s, 0, "leg-press", i, v));
  return previousPerformance(buildHistoryIndex([s], sets), "leg-press", {
    scope: "any",
  });
}

describe("doelen per set in het schema", () => {
  it("zonder historie: precies de doelen per set", () => {
    expect(buildPrescription(input, null).work).toEqual([
      sv(20, 10),
      sv(25, 10),
      sv(30, 8),
    ]);
  });

  it("lege velden vallen terug op startgewicht en ondergrens", () => {
    const work = buildPrescription(
      { ...input, setTargets: [t(null, 12), t(25, null)] },
      null,
    ).work;
    expect(work).toEqual([sv(15, 12), sv(25, 8)]);
  });

  it("daarna wint de vorige prestatie per set (zelfde doelen als toen)", () => {
    const previous = ranWith([sv(20, 12), sv(25, 10), sv(30, 9)], pyramid);
    const today = buildPrescription(input, previous);
    expect(today.work).toEqual([sv(20, 12), sv(25, 10), sv(30, 9)]);
    expect(today.source.kind).toBe("previous");
  });

  it("gewijzigde doelen in het schema gaan weer voor", () => {
    const previous = ranWith([sv(20, 12), sv(25, 10), sv(30, 9)], pyramid);
    const changed = [t(22.5, 10), t(27.5, 10), t(32.5, 8), t(35, 6)];
    const today = buildPrescription(
      { ...input, sets: 4, setTargets: changed },
      previous,
    );
    expect(today.work).toEqual([
      sv(22.5, 10),
      sv(27.5, 10),
      sv(32.5, 8),
      sv(35, 6),
    ]);
    expect(today.source.kind).toBe("plan");
  });

  it("doelen net aangezet bij een oefening met historie: het schema gaat voor", () => {
    const previous = ranWith([sv(40, 10), sv(40, 10), sv(40, 10)], null);
    expect(buildPrescription(input, previous).work).toEqual([
      sv(20, 10),
      sv(25, 10),
      sv(30, 8),
    ]);
  });

  it("zonder doelen per set verandert er niets aan de oude regel", () => {
    const previous = ranWith([sv(40, 10), sv(40, 9), sv(40, 8)], null);
    expect(
      buildPrescription({ ...input, setTargets: null }, previous).work,
    ).toEqual([sv(40, 10), sv(40, 9), sv(40, 8)]);
  });
});

describe("trainer bij doelen per set", () => {
  const coach = (planned: PlannedSetTarget[] | null) => {
    const done = [sv(40, 10), sv(40, 10), sv(40, 10)];
    const s = session("2026-11-01", [
      snapshotExercise(0, "leg-press", done, { plannedTargets: planned }),
    ]);
    const sets = done.map((v, i) => doneSet(s, 0, "leg-press", i, v));
    const list = performances(buildHistoryIndex([s], sets), "leg-press", {
      scope: "any",
    });
    return coachAdvice(list, {
      tracking: "weight_reps",
      repMin: 8,
      repMax: 10,
      level: "beginner",
      stepKg: 2.5,
    });
  };

  it("geeft geen advies als het schema doelen per set had", () => {
    expect(coach([t(40, 10), t(40, 10), t(40, 10)])).toBeNull();
  });

  it("gewone sets: advies zoals altijd", () => {
    expect(coach(null)?.kind).toBe("increase");
  });
});

describe("hulpfuncties", () => {
  const pe: PlannedExercise = {
    id: "a",
    exerciseId: "leg-press",
    sets: 3,
    warmupSets: 1,
    repMin: 8,
    repMax: 12,
    durationSec: null,
    restSec: 90,
    startWeightKg: 40,
  };

  it("aanzetten begint met het huidige voorschrift per set", () => {
    expect(initialTargets(pe, "weight_reps")).toEqual([
      t(40, 8),
      t(40, 8),
      t(40, 8),
    ]);
    expect(initialTargets({ ...pe, durationSec: 45 }, "duration")).toEqual(
      Array(3).fill({ weightKg: null, reps: null, durationSec: 45 }),
    );
  });

  it("meer sets nemen de laatste over, minimaal 1", () => {
    expect(resizeTargets(pyramid, 4)).toEqual([...pyramid, t(30, 8)]);
    expect(resizeTargets(pyramid, 0)).toEqual([t(20, 10)]);
  });

  it("aantal sets volgt de lijst; uitzetten haalt de doelen weg", () => {
    const on = withTargets(pe, [t(20, 10), t(25, 8)]);
    expect(on.sets).toBe(2);
    const off = withTargets(on, null);
    expect("setTargets" in off).toBe(false);
    expect(off.sets).toBe(2);
  });

  it("vergelijkt doelen per veld", () => {
    expect(
      sameTargets(
        pyramid,
        pyramid.map((x) => ({ ...x })),
      ),
    ).toBe(true);
    expect(sameTargets(pyramid, pyramid.slice(0, 2))).toBe(false);
    expect(sameTargets(pyramid, null)).toBe(false);
    expect(sameTargets(null, undefined)).toBe(true);
  });
});
