import { describe, expect, it } from "vitest";
import {
  addSet,
  removeExercise,
  removeSet,
  replaceExercise,
  setValuesForward,
} from "./session-edit";
import { doneSet, session, snapshotExercise, sv } from "./test-fixtures";
import { doneMap } from "./workout";

const base = () => {
  const s = session("2026-10-29", [
    snapshotExercise(0, "bench-press", [sv(40, 10), sv(40, 10), sv(40, 8)]),
    snapshotExercise(1, "db-curl", [sv(12, 10), sv(12, 10)]),
  ]);
  return s;
};

describe("lopende training bewerken", () => {
  it("gewicht verhogen zet door naar volgende sets met dezelfde waarde", () => {
    const s = base();
    const next = setValuesForward(
      s.snapshot,
      { slot: 0, kind: "work", index: 0 },
      sv(42, 10),
      doneMap([], s.id),
      "weightKg",
    );
    expect(next.exercises[0].work.map((v) => v.weightKg)).toEqual([42, 42, 42]);
  });

  it("verandert al gedane sets niet", () => {
    const s = base();
    const done = doneMap([doneSet(s, 0, "bench-press", 1, sv(40, 10))], s.id);
    const next = setValuesForward(
      s.snapshot,
      { slot: 0, kind: "work", index: 0 },
      sv(42, 10),
      done,
      "weightKg",
    );
    expect(next.exercises[0].work.map((v) => v.weightKg)).toEqual([42, 40, 42]);
  });

  it("set toevoegen en verwijderen (gedane sets blijven)", () => {
    const s = base();
    const added = addSet(s.snapshot, 1);
    expect(added.exercises[1].work).toHaveLength(3);
    const done = doneMap([doneSet(s, 1, "db-curl", 2, sv(12, 10))], s.id);
    expect(removeSet(added, 1, "work", done).exercises[1].work).toHaveLength(3);
    expect(
      removeSet(added, 1, "work", doneMap([], s.id)).exercises[1].work,
    ).toHaveLength(2);
  });

  it("vervangen zonder gedane sets gebeurt op dezelfde plek", () => {
    const s = base();
    const next = replaceExercise(
      s.snapshot,
      1,
      (slot) => snapshotExercise(slot, "hammer-curl", [sv(12, 10)]),
      doneMap([], s.id),
    );
    expect(next.exercises.map((e) => [e.slot, e.exerciseId])).toEqual([
      [0, "bench-press"],
      [1, "hammer-curl"],
    ]);
    expect(next.exercises[1].replacedFrom).toBe("db-curl");
  });

  it("vervangen na gedane sets bewaart die en voegt de nieuwe erachter toe", () => {
    const s = base();
    const done = doneMap([doneSet(s, 0, "bench-press", 0, sv(40, 10))], s.id);
    const next = replaceExercise(
      s.snapshot,
      0,
      (slot) => snapshotExercise(slot, "db-bench-press", [sv(16, 10)]),
      done,
    );
    expect(
      next.exercises.map((e) => [e.slot, e.exerciseId, e.work.length]),
    ).toEqual([
      [0, "bench-press", 1],
      [2, "db-bench-press", 1],
      [1, "db-curl", 2],
    ]);
  });

  it("oefening overslaan", () => {
    const s = base();
    expect(
      removeExercise(s.snapshot, 1, doneMap([], s.id)).exercises[1].removed,
    ).toBe(true);
  });
});
