import type {
  Program,
  ProgramDay,
  SessionExercise,
  SetValues,
  TrainingSession,
  TrainingSet,
} from "./types";

// Kleine bouwstenen voor tests.

export const USER = "u-1";
let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

const meta = (at = "2026-10-01T10:00:00.000Z") => ({
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
  version: 1,
});

export const sv = (weightKg: number | null, reps: number | null): SetValues => ({
  weightKg,
  reps,
  durationSec: null,
  jumps: null,
});

export function snapshotExercise(
  slot: number,
  exerciseId: string,
  work: SetValues[],
  extra: Partial<SessionExercise> = {},
): SessionExercise {
  return {
    slot,
    plannedId: null,
    exerciseId,
    name: exerciseId,
    tracking: "weight_reps",
    loadMode: "barbell",
    restSec: 120,
    repMin: 8,
    repMax: 10,
    durationSec: null,
    plannedSets: work.length,
    warmup: [],
    work,
    source: { kind: "plan" },
    ...extra,
  };
}

export function session(
  localDate: string,
  exercises: SessionExercise[],
  extra: Partial<TrainingSession> = {},
): TrainingSession {
  return {
    ...meta(),
    id: extra.id ?? nextId("s"),
    userId: USER,
    programId: "p-1",
    programRevision: 1,
    dayId: "a",
    name: "Full Body A",
    status: "completed",
    startedAt: `${localDate}T09:00:00.000Z`,
    endedAt: `${localDate}T10:00:00.000Z`,
    localDate,
    timeZone: "Europe/Amsterdam",
    notes: null,
    snapshot: { programName: "Full Body — 3 dagen", dayName: "Full Body A", exercises },
    ...extra,
  };
}

export function doneSet(
  s: TrainingSession,
  slot: number,
  exerciseId: string,
  setIndex: number,
  values: SetValues,
  extra: Partial<TrainingSet> = {},
): TrainingSet {
  return {
    ...meta(),
    ...values,
    id: nextId("set"),
    userId: USER,
    sessionId: s.id,
    exerciseId,
    slot,
    kind: "work",
    setIndex,
    rpe: null,
    rir: null,
    notes: null,
    completedAt: s.endedAt ?? s.startedAt,
    ...extra,
  };
}

// Voltooide sessie met voor één oefening de gegeven sets.
export function completedWith(
  localDate: string,
  exerciseId: string,
  values: SetValues[],
  extra: Partial<TrainingSession> = {},
) {
  const s = session(localDate, [snapshotExercise(0, exerciseId, values)], extra);
  return { session: s, sets: values.map((v, i) => doneSet(s, 0, exerciseId, i, v)) };
}

export function program(days: ProgramDay[], extra: Partial<Program> = {}): Program {
  return {
    ...meta(),
    id: "p-1",
    userId: USER,
    name: "Testschema",
    content: { scheduleMode: "weekly", days },
    revision: 1,
    source: null,
    archivedAt: null,
    ...extra,
  };
}

export const day = (id: string, weekdays: number[], name = id): ProgramDay => ({
  id,
  name,
  weekdays,
  exercises: [],
});
