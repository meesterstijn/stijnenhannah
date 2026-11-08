import type { PlannedExercise, PlannedSetTarget, Tracking } from "./types";

// Doelen per werkset in het schema (bijv. een piramide: 10 × 20, 10 × 25,
// 8 × 30). Optioneel: zonder setTargets geldt één voorschrift voor alle sets.

export const MAX_SETS = 20;

export const isTimed = (tracking: Tracking) =>
  tracking === "duration" || tracking === "jump_rope";

/** Aanzetten: begin met het huidige voorschrift voor elke set. */
export function initialTargets(
  pe: Pick<
    PlannedExercise,
    "sets" | "repMin" | "repMax" | "durationSec" | "startWeightKg"
  >,
  tracking: Tracking,
): PlannedSetTarget[] {
  const timed = isTimed(tracking);
  return Array.from({ length: Math.max(1, pe.sets) }, () => ({
    weightKg: timed ? null : pe.startWeightKg,
    reps: timed ? null : (pe.repMin ?? pe.repMax ?? null),
    durationSec: timed ? (pe.durationSec ?? null) : null,
  }));
}

/** Meer of minder sets: nieuwe sets nemen de laatste over. */
export function resizeTargets(
  list: PlannedSetTarget[],
  count: number,
): PlannedSetTarget[] {
  const n = Math.max(1, Math.min(MAX_SETS, count));
  const result = list.slice(0, n).map((t) => ({ ...t }));
  const last = result[result.length - 1] ?? {
    weightKg: null,
    reps: null,
    durationSec: null,
  };
  while (result.length < n) result.push({ ...last });
  return result;
}

const same = (a: PlannedSetTarget, b: PlannedSetTarget) =>
  (a.weightKg ?? null) === (b.weightKg ?? null) &&
  (a.reps ?? null) === (b.reps ?? null) &&
  (a.durationSec ?? null) === (b.durationSec ?? null);

export function sameTargets(
  a: PlannedSetTarget[] | null | undefined,
  b: PlannedSetTarget[] | null | undefined,
): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((t, i) => same(t, y[i]));
}

/** Schema-oefening met setTargets: aantal sets volgt de lijst. */
export function withTargets(
  pe: PlannedExercise,
  targets: PlannedSetTarget[] | null,
): PlannedExercise {
  if (!targets || targets.length === 0) {
    const { setTargets: _drop, ...rest } = pe;
    return rest;
  }
  return { ...pe, setTargets: targets, sets: targets.length };
}
