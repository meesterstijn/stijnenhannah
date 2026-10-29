import { describe, expect, it } from "vitest";
import { systemExercise } from "./exercises";
import { buildHistoryIndex } from "./performance";
import { completedWith, doneSet, program, sv } from "./test-fixtures";
import {
  buildSnapshot,
  cleanValues,
  doneMap,
  nextOpenPosition,
  validateSetValues,
  workProgress,
  type WorkoutContext,
} from "./workout";
import type { ProgramDay } from "./types";

const dayA: ProgramDay = {
  id: "a",
  name: "Full Body A",
  weekdays: [0],
  exercises: [
    {
      id: "a-1",
      exerciseId: "bench-press",
      sets: 3,
      warmupSets: 1,
      repMin: 8,
      repMax: 10,
      durationSec: null,
      restSec: 180,
      startWeightKg: null,
    },
    {
      id: "a-2",
      exerciseId: "plank",
      sets: 2,
      warmupSets: 0,
      repMin: null,
      repMax: null,
      durationSec: 40,
      restSec: 45,
      startWeightKg: null,
    },
  ],
};

const ctx = (index = buildHistoryIndex([], [])): WorkoutContext => ({
  lookup: systemExercise,
  index,
  scope: "any",
  prefs: {},
});

describe("training starten", () => {
  it("maakt een momentopname met vorige prestaties als opdracht", () => {
    const prev = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
      sv(40, 8),
    ]);
    const snap = buildSnapshot(
      program([dayA]),
      dayA,
      ctx(buildHistoryIndex([prev.session], prev.sets)),
    );
    expect(snap.exercises.map((e) => e.exerciseId)).toEqual([
      "bench-press",
      "plank",
    ]);
    expect(snap.exercises[0].work).toEqual([sv(40, 10), sv(40, 10), sv(40, 8)]);
    expect(snap.exercises[0].source.kind).toBe("previous");
    expect(snap.exercises[0].restSec).toBe(180);
    expect(snap.exercises[1].work[0].durationSec).toBe(40);
    expect(snap.programName).toBe("Testschema");
  });

  it("rusttijd per oefening uit de eigen instelling", () => {
    const snap = buildSnapshot(null, dayA, {
      ...ctx(),
      prefs: { "bench-press": { restSec: 150 } },
    });
    expect(snap.exercises[0].restSec).toBe(150);
  });
});

describe("voortgang in de training", () => {
  it("volgorde: opwarmsets, dan werksets, dan de volgende oefening", () => {
    const snap = buildSnapshot(null, dayA, ctx());
    const s = completedWith("2026-10-29", "x", []).session;
    let done = doneMap([], s.id);
    expect(nextOpenPosition(snap, done)).toEqual({
      slot: 0,
      kind: "warmup",
      index: 0,
    });
    const sets = [
      doneSet(s, 0, "bench-press", 0, sv(20, 8), { kind: "warmup" }),
      doneSet(s, 0, "bench-press", 0, sv(40, 10)),
    ];
    done = doneMap(sets, s.id);
    expect(
      nextOpenPosition(snap, done, { slot: 0, kind: "work", index: 0 }),
    ).toEqual({ slot: 0, kind: "work", index: 1 });
    expect(workProgress(snap, done)).toEqual({ total: 5, completed: 1 });
  });

  it("komt terug bij overgeslagen sets", () => {
    const snap = buildSnapshot(null, dayA, ctx());
    const s = completedWith("2026-10-29", "x", []).session;
    const sets = [
      doneSet(s, 1, "plank", 0, sv(null, null)),
      doneSet(s, 1, "plank", 1, sv(null, null)),
    ];
    expect(
      nextOpenPosition(snap, doneMap(sets, s.id), {
        slot: 1,
        kind: "work",
        index: 1,
      }),
    ).toEqual({ slot: 0, kind: "warmup", index: 0 });
  });
});

describe("validatie", () => {
  it("weigert onmogelijke waarden", () => {
    expect(validateSetValues("weight_reps", sv(40, 10))).toBeNull();
    expect(validateSetValues("weight_reps", sv(-1, 10))).toMatch(/gewicht/i);
    expect(validateSetValues("weight_reps", sv(40, 2.5))).toMatch(/heel getal/);
    expect(validateSetValues("weight_reps", sv(40.123, 5))).toMatch(
      /decimalen/,
    );
    expect(validateSetValues("weight_reps", sv(null, 5))).toMatch(/gewicht/);
    expect(validateSetValues("weight_reps", sv(1000, 5))).toMatch(/gewicht/i);
    expect(
      validateSetValues("duration", {
        weightKg: null,
        reps: null,
        durationSec: 45,
        jumps: null,
      }),
    ).toBeNull();
    expect(validateSetValues("bodyweight_reps", sv(null, 20))).toBeNull();
  });

  it("bewaart alleen velden van de registratiesoort", () => {
    expect(
      cleanValues("duration", {
        weightKg: 5,
        reps: 3,
        durationSec: 30,
        jumps: 9,
      }),
    ).toEqual({ weightKg: null, reps: null, durationSec: 30, jumps: null });
    expect(cleanValues("bodyweight_reps", sv(0, 15))).toEqual(sv(null, 15));
  });
});
