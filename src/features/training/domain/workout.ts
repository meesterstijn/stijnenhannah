import {
  buildPrescription,
  previousPerformance,
  type HistoryIndex,
  type HistoryScope,
} from "./performance";
import type {
  Exercise,
  ExercisePref,
  PlannedExercise,
  Program,
  ProgramDay,
  SessionExercise,
  SessionSnapshot,
  SetKind,
  SetValues,
  Tracking,
  TrainingSet,
} from "./types";

// Opbouw en voortgang van een training. Bij het starten wordt een
// momentopname gemaakt: oefeningen, rusttijden en de opdracht per set
// (vorige prestatie of beginwaarde). Die momentopname is wat de training
// toont en wat later in de historie staat, los van latere schemawijzigingen.

export type WorkoutContext = {
  lookup: (id: string) => Exercise | undefined;
  index: HistoryIndex;
  scope: HistoryScope["scope"];
  prefs: Record<string, ExercisePref>;
};

export function sessionExercise(
  slot: number,
  exercise: Exercise,
  planned: Omit<PlannedExercise, "id" | "exerciseId"> & { id?: string | null },
  ctx: WorkoutContext,
  programId: string | null,
): SessionExercise {
  const pref = ctx.prefs[exercise.id] ?? {};
  const previous = previousPerformance(ctx.index, exercise.id, {
    scope: ctx.scope,
    programId,
  });
  const prescription = buildPrescription(
    {
      sets: planned.sets,
      warmupSets: planned.warmupSets,
      repMin: planned.repMin,
      repMax: planned.repMax,
      durationSec: planned.durationSec,
      startWeightKg: planned.startWeightKg ?? pref.startWeightKg ?? null,
      tracking: exercise.tracking,
    },
    previous,
  );
  return {
    slot,
    plannedId: planned.id ?? null,
    exerciseId: exercise.id,
    name: exercise.name,
    tracking: exercise.tracking,
    loadMode: exercise.loadMode,
    perSide: exercise.perSide,
    restSec: pref.restSec ?? planned.restSec,
    repMin: planned.repMin,
    repMax: planned.repMax,
    durationSec: planned.durationSec,
    plannedSets: planned.sets,
    warmup: prescription.warmup,
    work: prescription.work,
    source: prescription.source,
    notes: planned.notes,
  };
}

export function buildSnapshot(
  program: Program | null,
  day: ProgramDay,
  ctx: WorkoutContext,
): SessionSnapshot {
  const exercises: SessionExercise[] = [];
  for (const planned of day.exercises) {
    const exercise = ctx.lookup(planned.exerciseId);
    if (!exercise) continue;
    exercises.push(
      sessionExercise(
        exercises.length,
        exercise,
        planned,
        ctx,
        program?.id ?? null,
      ),
    );
  }
  return {
    programName: program?.name ?? null,
    dayName: day.name,
    exercises,
    cursor: null,
  };
}

// Standaardplanning voor een oefening die je los toevoegt.
export function adHocPlan(
  exercise: Exercise,
  sets = 3,
): Omit<PlannedExercise, "id" | "exerciseId"> {
  const timed =
    exercise.tracking === "duration" || exercise.tracking === "jump_rope";
  return {
    sets,
    warmupSets: 0,
    repMin: timed ? null : exercise.type === "core" ? 12 : 8,
    repMax: timed ? null : exercise.type === "core" ? 20 : 12,
    durationSec: timed ? (exercise.tracking === "jump_rope" ? 60 : 30) : null,
    restSec: exercise.defaultRestSec,
    startWeightKg: null,
  };
}

// ── Voortgang ─────────────────────────────────────────────────────────

export type Position = { slot: number; kind: SetKind; index: number };

export type DoneMap = Map<string, TrainingSet>;

export const positionKey = (p: Position) => `${p.slot}:${p.kind}:${p.index}`;

export function doneMap(sets: TrainingSet[], sessionId: string): DoneMap {
  const map: DoneMap = new Map();
  for (const s of sets) {
    if (s.sessionId !== sessionId || s.deletedAt) continue;
    map.set(positionKey({ slot: s.slot, kind: s.kind, index: s.setIndex }), s);
  }
  return map;
}

export const activeExercises = (snapshot: SessionSnapshot) =>
  snapshot.exercises.filter((e) => !e.removed);

// Alle posities in volgorde: per oefening eerst de opwarmsets, dan werksets.
export function allPositions(snapshot: SessionSnapshot): Position[] {
  const result: Position[] = [];
  for (const e of activeExercises(snapshot)) {
    e.warmup.forEach((_, index) =>
      result.push({ slot: e.slot, kind: "warmup", index }),
    );
    e.work.forEach((_, index) =>
      result.push({ slot: e.slot, kind: "work", index }),
    );
  }
  return result;
}

export function nextOpenPosition(
  snapshot: SessionSnapshot,
  done: DoneMap,
  from?: Position | null,
): Position | null {
  const positions = allPositions(snapshot);
  const start = from
    ? positions.findIndex((p) => positionKey(p) === positionKey(from))
    : -1;
  // Eerst vooruit vanaf de huidige plek, daarna eventuele overgeslagen sets.
  for (let i = start + 1; i < positions.length; i++) {
    if (!done.has(positionKey(positions[i]))) return positions[i];
  }
  for (let i = 0; i <= start && i < positions.length; i++) {
    if (!done.has(positionKey(positions[i]))) return positions[i];
  }
  return null;
}

export function workProgress(snapshot: SessionSnapshot, done: DoneMap) {
  let total = 0;
  let completed = 0;
  for (const e of activeExercises(snapshot)) {
    total += e.work.length;
    e.work.forEach((_, index) => {
      if (done.has(positionKey({ slot: e.slot, kind: "work", index })))
        completed++;
    });
  }
  return { total, completed };
}

export function valuesAt(
  snapshot: SessionSnapshot,
  p: Position,
): SetValues | null {
  const exercise = snapshot.exercises.find((e) => e.slot === p.slot);
  return exercise?.[p.kind][p.index] ?? null;
}

// ── Validatie ─────────────────────────────────────────────────────────

export const LIMITS = {
  weightKg: 999.99,
  reps: 1000,
  durationSec: 86_400,
  jumps: 100_000,
};

// Geeft een melding als de waarden niet kunnen, anders null.
export function validateSetValues(
  tracking: Tracking,
  v: SetValues,
): string | null {
  const bad = (n: number | null, max: number, integer: boolean) =>
    n !== null &&
    (!Number.isFinite(n) ||
      n < 0 ||
      n > max ||
      (integer && !Number.isInteger(n)));
  if (bad(v.weightKg, LIMITS.weightKg, false)) return "Ongeldig gewicht.";
  if (
    v.weightKg !== null &&
    Math.abs(Math.round(v.weightKg * 100) - v.weightKg * 100) > 1e-6
  ) {
    return "Gewicht mag hooguit twee decimalen hebben.";
  }
  if (bad(v.reps, LIMITS.reps, true))
    return "Herhalingen moeten een heel getal van 0 of meer zijn.";
  if (bad(v.durationSec, LIMITS.durationSec, true)) return "Ongeldige duur.";
  if (bad(v.jumps, LIMITS.jumps, true)) return "Ongeldig aantal sprongen.";
  if (tracking === "weight_reps" && v.weightKg === null)
    return "Kies eerst een gewicht.";
  if (
    (tracking === "weight_reps" || tracking === "bodyweight_reps") &&
    v.reps === null
  ) {
    return "Vul het aantal herhalingen in.";
  }
  if (
    (tracking === "duration" || tracking === "jump_rope") &&
    v.durationSec === null
  ) {
    return "Vul de duur in.";
  }
  return null;
}

// Alleen de velden die bij deze registratiesoort horen (de rest leeg).
export function cleanValues(tracking: Tracking, v: SetValues): SetValues {
  switch (tracking) {
    case "weight_reps":
      return {
        weightKg: v.weightKg,
        reps: v.reps,
        durationSec: null,
        jumps: null,
      };
    case "bodyweight_reps":
      return {
        weightKg: v.weightKg || null,
        reps: v.reps,
        durationSec: null,
        jumps: null,
      };
    case "duration":
      return {
        weightKg: null,
        reps: null,
        durationSec: v.durationSec,
        jumps: null,
      };
    case "jump_rope":
      return {
        weightKg: null,
        reps: null,
        durationSec: v.durationSec,
        jumps: v.jumps,
      };
  }
}
