import type {
  SessionExercise,
  SessionSnapshot,
  SetKind,
  SetValues,
} from "./types";
import { positionKey, type DoneMap, type Position } from "./workout";

// Bewerkingen op de momentopname van een lopende training. Puur: geven een
// nieuwe snapshot terug. Voltooide sets worden nooit weggegooid; ze staan
// los opgeslagen en blijven altijd bij hun oefening en positie horen.

const doneCount = (e: SessionExercise, kind: SetKind, done: DoneMap) =>
  e[kind].filter((_, index) =>
    done.has(positionKey({ slot: e.slot, kind, index })),
  ).length;

const lastDoneIndex = (e: SessionExercise, kind: SetKind, done: DoneMap) => {
  let last = -1;
  e[kind].forEach((_, index) => {
    if (done.has(positionKey({ slot: e.slot, kind, index }))) last = index;
  });
  return last;
};

export function setValuesAt(
  snapshot: SessionSnapshot,
  p: Position,
  values: SetValues,
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) =>
      e.slot !== p.slot
        ? e
        : {
            ...e,
            [p.kind]: e[p.kind].map((v, i) => (i === p.index ? values : v)),
          },
    ),
  };
}

// Waarden van een set doorzetten naar de volgende, nog niet gedane sets
// (zelfde soort, alleen als die nog gelijk waren aan de oude waarde): wie
// set 1 zwaarder maakt, hoeft dat niet bij elke set opnieuw te doen.
export function setValuesForward(
  snapshot: SessionSnapshot,
  p: Position,
  values: SetValues,
  done: DoneMap,
  field: keyof SetValues,
): SessionSnapshot {
  const exercise = snapshot.exercises.find((e) => e.slot === p.slot);
  if (!exercise) return snapshot;
  const before = exercise[p.kind][p.index]?.[field];
  const list = exercise[p.kind].map((v, i) => {
    if (i === p.index) return values;
    if (
      i > p.index &&
      !done.has(positionKey({ slot: p.slot, kind: p.kind, index: i })) &&
      v[field] === before
    ) {
      return { ...v, [field]: values[field] };
    }
    return v;
  });
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) =>
      e.slot === p.slot ? { ...e, [p.kind]: list } : e,
    ),
  };
}

export function addSet(
  snapshot: SessionSnapshot,
  slot: number,
  kind: SetKind = "work",
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) => {
      if (e.slot !== slot) return e;
      const last = e[kind][e[kind].length - 1] ??
        e.work[0] ?? {
          weightKg: null,
          reps: e.repMin,
          durationSec: e.durationSec,
          jumps: null,
        };
      return { ...e, [kind]: [...e[kind], { ...last }] };
    }),
  };
}

// Haalt de laatste set weg als die nog niet gedaan is.
export function removeSet(
  snapshot: SessionSnapshot,
  slot: number,
  kind: SetKind,
  done: DoneMap,
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) => {
      if (e.slot !== slot) return e;
      const list = e[kind];
      const minimum = kind === "work" ? 1 : 0;
      if (
        list.length <= minimum ||
        lastDoneIndex(e, kind, done) >= list.length - 1
      )
        return e;
      return { ...e, [kind]: list.slice(0, -1) };
    }),
  };
}

const nextSlot = (snapshot: SessionSnapshot) =>
  Math.max(-1, ...snapshot.exercises.map((e) => e.slot)) + 1;

// Oefening vervangen. Nog niets gedaan: op dezelfde plek. Al sets gedaan:
// de oude houdt alleen die sets, de nieuwe komt er direct achter.
export function replaceExercise(
  snapshot: SessionSnapshot,
  slot: number,
  make: (slot: number) => SessionExercise,
  done: DoneMap,
): SessionSnapshot {
  const index = snapshot.exercises.findIndex((e) => e.slot === slot);
  if (index < 0) return snapshot;
  const old = snapshot.exercises[index];
  const exercises = [...snapshot.exercises];
  if (doneCount(old, "work", done) + doneCount(old, "warmup", done) === 0) {
    exercises[index] = { ...make(slot), replacedFrom: old.exerciseId };
  } else {
    exercises[index] = truncateToDone(old, done);
    exercises.splice(index + 1, 0, {
      ...make(nextSlot(snapshot)),
      replacedFrom: old.exerciseId,
    });
  }
  return { ...snapshot, exercises };
}

function truncateToDone(e: SessionExercise, done: DoneMap): SessionExercise {
  return {
    ...e,
    warmup: e.warmup.slice(0, lastDoneIndex(e, "warmup", done) + 1),
    work: e.work.slice(0, Math.max(1, lastDoneIndex(e, "work", done) + 1)),
  };
}

export function addExercise(
  snapshot: SessionSnapshot,
  make: (slot: number) => SessionExercise,
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: [...snapshot.exercises, make(nextSlot(snapshot))],
  };
}

// Oefening overslaan: zonder gedane sets verdwijnt hij uit de training,
// anders blijven alleen de gedane sets staan.
export function removeExercise(
  snapshot: SessionSnapshot,
  slot: number,
  done: DoneMap,
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) => {
      if (e.slot !== slot) return e;
      const any = doneCount(e, "work", done) + doneCount(e, "warmup", done) > 0;
      return any ? truncateToDone(e, done) : { ...e, removed: true };
    }),
  };
}

export function moveExercise(
  snapshot: SessionSnapshot,
  slot: number,
  delta: -1 | 1,
): SessionSnapshot {
  const list = [...snapshot.exercises];
  const from = list.findIndex((e) => e.slot === slot);
  let to = from + delta;
  while (to >= 0 && to < list.length && list[to].removed) to += delta;
  if (from < 0 || to < 0 || to >= list.length) return snapshot;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return { ...snapshot, exercises: list };
}

export function patchExercise(
  snapshot: SessionSnapshot,
  slot: number,
  change: Partial<SessionExercise>,
): SessionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((e) =>
      e.slot === slot ? { ...e, ...change } : e,
    ),
  };
}
