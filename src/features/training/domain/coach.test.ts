import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPMENT } from "./defaults";
import { systemExercise } from "./exercises";
import { estimateMinutes, generateProgram } from "./generator";
import { buildHistoryIndex, performances } from "./performance";
import { loadableWeight, maxPlateLoadKg } from "./plates";
import { applyCoachChange, revertCoachChange } from "./session-edit";
import { trainerStartWeight } from "./start-weights";
import { programTemplate } from "./templates";
import { completedWith, doneSet, program, session, sv } from "./test-fixtures";
import type { EquipmentConfig, ProgramDay } from "./types";
import {
  buildSnapshot,
  coachFor,
  doneMap,
  type WorkoutContext,
} from "./workout";

const bench = systemExercise("bench-press")!;
const lateral = systemExercise("db-lateral-raise")!;
const rdl = systemExercise("barbell-rdl")!;

const known: EquipmentConfig = {
  ...DEFAULT_EQUIPMENT,
  barbell: { owned: true, weightKg: 20, maxLoadKg: null },
  dumbbells: { count: 2, handleWeightKg: 2, maxLoadKg: null },
};

const history = (exerciseId: string, runs: [number, number][][]) => {
  // runs: oudste eerst; elke run = sets als [kg, herhalingen]
  const made = runs.map((sets, i) =>
    completedWith(
      `2026-10-0${i + 1}`,
      exerciseId,
      sets.map(([kg, reps]) => sv(kg, reps)),
    ),
  );
  const index = buildHistoryIndex(
    made.map((m) => m.session),
    made.flatMap((m) => m.sets),
  );
  return performances(index, exerciseId, { scope: "any" });
};

const plan = { repMin: 8, repMax: 10 };

describe("startgewichten van de trainer", () => {
  it("verschilt per niveau en loopt op van beginner naar expert", () => {
    const b = trainerStartWeight(bench, "beginner")!;
    const g = trainerStartWeight(bench, "intermediate")!;
    const e = trainerStartWeight(bench, "advanced")!;
    expect(b).toBeLessThan(g);
    expect(g).toBeLessThan(e);
  });

  it("nooit zwaarder dan je schijven kunnen laden", () => {
    // 3 × 10 kg: op een stang maar één per kant → 70 kg aan schijven.
    expect(maxPlateLoadKg(DEFAULT_EQUIPMENT.plates, "barbell")).toBe(70);
    // Twee dumbbells tegelijk: 20 kg aan schijven per dumbbell.
    expect(maxPlateLoadKg(DEFAULT_EQUIPMENT.plates, "dumbbell_pair")).toBe(20);
    expect(trainerStartWeight(rdl, "advanced", known)).toBe(90);
    expect(
      trainerStartWeight(rdl, "advanced", {
        ...known,
        barbell: { ...known.barbell, weightKg: 10 },
      }),
    ).toBe(80);
    expect(
      trainerStartWeight(systemExercise("db-bench-press")!, "advanced", known),
    ).toBe(22);
  });

  it("afgerond op wat exact te laden is", () => {
    // Stang 15 kg: elk totaal is oneven, dus 50 kg wordt 49 kg.
    const odd = { ...known, barbell: { ...known.barbell, weightKg: 15 } };
    expect(loadableWeight("barbell", 50, odd, "below")).toBe(49);
    expect(trainerStartWeight(bench, "intermediate", odd)).toBe(49);
    expect(trainerStartWeight(bench, "intermediate", known)).toBe(50);
  });

  it("geen voorstel voor lichaamsgewicht of tijd", () => {
    expect(trainerStartWeight(systemExercise("push-up")!, "beginner")).toBe(
      null,
    );
    expect(trainerStartWeight(systemExercise("plank")!, "beginner")).toBe(null);
  });

  it("staat klaar bij een nieuwe oefening; eigen startgewicht gaat voor", () => {
    const day: ProgramDay = {
      id: "a",
      name: "A",
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
          restSec: 120,
          startWeightKg: null,
        },
      ],
    };
    const ctx: WorkoutContext = {
      lookup: systemExercise,
      index: buildHistoryIndex([], []),
      scope: "any",
      prefs: {},
      level: "beginner",
    };
    const snap = buildSnapshot(null, day, ctx);
    expect(snap.exercises[0].work.map((s) => s.weightKg)).toEqual([30, 30, 30]);
    expect(snap.exercises[0].source).toEqual({
      kind: "plan",
      trainerStart: "beginner",
    });
    const own = buildSnapshot(null, day, {
      ...ctx,
      prefs: { "bench-press": { startWeightKg: 25 } },
    });
    expect(own.exercises[0].work[0].weightKg).toBe(25);
    expect(own.exercises[0].source).toEqual({ kind: "plan" });
  });

  it("na een aanpassing geldt jouw gewicht, niet meer het startgewicht", () => {
    const prev = completedWith("2026-10-01", "bench-press", [
      sv(25, 8),
      sv(25, 8),
      sv(25, 8),
    ]);
    const snap = buildSnapshot(
      program([]),
      {
        id: "a",
        name: "A",
        weekdays: [0],
        exercises: [
          {
            id: "a-1",
            exerciseId: "bench-press",
            sets: 3,
            warmupSets: 0,
            repMin: 8,
            repMax: 10,
            durationSec: null,
            restSec: 120,
            startWeightKg: null,
          },
        ],
      },
      {
        lookup: systemExercise,
        index: buildHistoryIndex([prev.session], prev.sets),
        scope: "any",
        prefs: {},
        level: "advanced",
      },
    );
    expect(snap.exercises[0].work.map((s) => s.weightKg)).toEqual([25, 25, 25]);
  });
});

describe("trainer: verhogen, vasthouden, verlagen", () => {
  it("verhoogt na één keer alle sets op de bovenkant (beginner/gevorderd)", () => {
    const list = history("bench-press", [
      [
        [40, 10],
        [40, 10],
        [40, 11],
      ],
    ]);
    const advice = coachFor(bench, list, plan, "intermediate", known);
    expect(advice).toMatchObject({ kind: "increase", fromKg: 40, toKg: 42 });
  });

  it("expert: pas na twee keer op rij", () => {
    const once = history("bench-press", [
      [
        [60, 8],
        [60, 8],
        [60, 8],
      ],
      [
        [60, 10],
        [60, 10],
        [60, 10],
      ],
    ]);
    expect(coachFor(bench, once, plan, "advanced", known)?.kind).toBe("build");
    const twice = history("bench-press", [
      [
        [60, 10],
        [60, 10],
        [60, 10],
      ],
      [
        [60, 10],
        [60, 10],
        [60, 10],
      ],
    ]);
    expect(coachFor(bench, twice, plan, "advanced", known)?.kind).toBe(
      "increase",
    );
  });

  it("beginner zet bij grote beenoefeningen met de stang een dubbele stap", () => {
    const list = history("barbell-rdl", [
      [
        [36, 10],
        [36, 10],
      ],
    ]);
    // Stap 2 kg; dubbel = 4 kg → 40 kg.
    expect(coachFor(rdl, list, plan, "beginner", known)).toMatchObject({
      kind: "increase",
      toKg: 40,
    });
  });

  it("raadt verhogen af als de ondergrens niet gehaald is", () => {
    const list = history("bench-press", [
      [
        [40, 10],
        [40, 7],
        [40, 6],
      ],
    ]);
    expect(coachFor(bench, list, plan, "beginner", known)?.kind).toBe("hold");
  });

  it("stelt lichter voor na twee keer de meeste sets gemist", () => {
    const list = history("bench-press", [
      [
        [50, 6],
        [50, 5],
        [50, 8],
      ],
      [
        [50, 7],
        [50, 6],
        [50, 5],
      ],
    ]);
    const advice = coachFor(bench, list, plan, "intermediate", known);
    expect(advice).toMatchObject({ kind: "decrease", fromKg: 50 });
    // 10% lichter = 45 kg; met stang 20 kg exact te laden is 44 kg.
    expect(advice?.kind === "decrease" && advice.toKg).toBe(44);
  });

  it("aan het maximum van de schijven: geen verhoging maar een alternatief", () => {
    const list = history("db-lateral-raise", [
      [
        [22, 15],
        [22, 15],
      ],
    ]);
    expect(
      coachFor(lateral, list, { repMin: 12, repMax: 15 }, "beginner", known)
        ?.kind,
    ).toBe("max");
  });

  it("auto-stand zet de verhoging klaar; terugdraaien herstelt de vorige sets", () => {
    const prev = completedWith("2026-10-01", "bench-press", [
      sv(40, 10),
      sv(40, 10),
      sv(40, 10),
    ]);
    const day: ProgramDay = {
      id: "a",
      name: "A",
      weekdays: [0],
      exercises: [
        {
          id: "a-1",
          exerciseId: "bench-press",
          sets: 3,
          warmupSets: 0,
          repMin: 8,
          repMax: 10,
          durationSec: null,
          restSec: 120,
          startWeightKg: null,
        },
      ],
    };
    const ctx: WorkoutContext = {
      lookup: systemExercise,
      index: buildHistoryIndex([prev.session], prev.sets),
      scope: "any",
      prefs: {},
      level: "intermediate",
      equipment: known,
    };
    const suggest = buildSnapshot(null, day, { ...ctx, coachMode: "suggest" });
    expect(suggest.exercises[0].work[0]).toEqual(sv(40, 10));
    expect(suggest.exercises[0].coach).toBeUndefined();

    const auto = buildSnapshot(null, day, { ...ctx, coachMode: "auto" });
    expect(auto.exercises[0].work).toEqual([sv(42, 8), sv(42, 8), sv(42, 8)]);
    expect(auto.exercises[0].coach).toMatchObject({
      kind: "increase",
      fromKg: 40,
      toKg: 42,
      how: "auto",
    });

    // Eerste set al gedaan op 42; terugdraaien laat die staan.
    const s = session("2026-10-03", auto.exercises, { status: "active" });
    const done = doneMap([doneSet(s, 0, "bench-press", 0, sv(42, 8))], s.id);
    const reverted = revertCoachChange(auto, 0, done);
    expect(reverted.exercises[0].work).toEqual([
      sv(42, 8),
      sv(40, 10),
      sv(40, 10),
    ]);
    expect(reverted.exercises[0].coach).toBeNull();
  });

  it("voorstel overnemen past alleen open sets op het oude gewicht aan", () => {
    const snap = buildSnapshot(
      null,
      {
        id: "a",
        name: "A",
        weekdays: [0],
        exercises: [
          {
            id: "a-1",
            exerciseId: "bench-press",
            sets: 2,
            warmupSets: 0,
            repMin: 8,
            repMax: 10,
            durationSec: null,
            restSec: 120,
            startWeightKg: 40,
          },
        ],
      },
      {
        lookup: systemExercise,
        index: buildHistoryIndex([], []),
        scope: "any",
        prefs: {},
      },
    );
    const changed = applyCoachChange(
      snap,
      0,
      { kind: "increase", fromKg: 40, toKg: 42 },
      new Map(),
    );
    expect(changed.exercises[0].work).toEqual([sv(42, 8), sv(42, 8)]);
    expect(changed.exercises[0].coach).toMatchObject({ how: "accepted" });
  });
});

describe("PPL per niveau en trainingsduur", () => {
  const ppl = programTemplate("ppl-6")!;
  const owned = new Set(DEFAULT_EQUIPMENT.owned);
  const weekSets = (
    level: "beginner" | "intermediate" | "advanced",
    minutes: number,
  ) =>
    generateProgram(
      ppl,
      {
        level,
        goal: "combined",
        sessionMinutes: minutes,
        owned,
        scheduleMode: "weekly",
      },
      systemExercise,
    );
  const total = (r: ReturnType<typeof weekSets>) =>
    r.content.days.reduce(
      (n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0),
      0,
    );

  it("meer tijd geeft gevorderden en experts meer volume", () => {
    expect(total(weekSets("intermediate", 60))).toBeGreaterThan(
      total(weekSets("intermediate", 45)),
    );
    expect(total(weekSets("advanced", 60))).toBeGreaterThan(
      total(weekSets("advanced", 45)),
    );
    expect(total(weekSets("advanced", 60))).toBeGreaterThan(
      total(weekSets("intermediate", 60)),
    );
  });

  it("blijft binnen de gekozen tijd", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      for (const minutes of [30, 45, 60, 75, 90]) {
        for (const d of weekSets(level, minutes).content.days) {
          expect(
            estimateMinutes(d.exercises),
            `${level} ${minutes} ${d.name}`,
          ).toBeLessThanOrEqual(minutes);
        }
      }
    }
  });

  it("beginners: geen 5–8-bereik, max 3 sets, en een waarschuwing bij 6 dagen", () => {
    const r = weekSets("beginner", 90);
    const bench = r.content.days[0].exercises[0];
    expect(bench.repMin).toBeGreaterThanOrEqual(6);
    expect(
      r.content.days.every((d) =>
        d.exercises.every(
          (e) =>
            systemExercise(e.exerciseId)!.tracking !== "weight_reps" ||
            e.sets <= 3,
        ),
      ),
    ).toBe(true);
    expect(r.notes.some((n) => n.includes("voor een beginner veel"))).toBe(
      true,
    );
  });
});
