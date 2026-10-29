import { addDays, weekStart } from "./schedule";
import type { HistoryIndex, Performance } from "./performance";
import { fromGrams, toGrams } from "./units";
import type {
  Exercise,
  MuscleGroup,
  SetValues,
  Tracking,
  TrainingSession,
  TrainingSet,
} from "./types";

// Statistiek en persoonlijke records. Alles wordt afgeleid uit de opgeslagen
// sets, dus een correctie achteraf werkt overal vanzelf door.

// Geschatte 1RM volgens Epley: gewicht × (1 + herhalingen / 30). Alleen een
// indicatie, en alleen bij 1–12 herhalingen (daarboven is de schatting te
// onbetrouwbaar).
export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null,
): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// Volume van een set = ingevoerd gewicht × herhalingen. Bij dumbbells is
// dat het gewicht per dumbbell zoals ingevoerd (niet × 2); bij
// lichaamsgewicht alleen het extra gewicht.
export function setVolumeGrams(s: SetValues): number {
  return toGrams(s.weightKg ?? 0) * (s.reps ?? 0);
}

export const volumeKg = (list: SetValues[]) =>
  fromGrams(list.reduce((sum, s) => sum + setVolumeGrams(s), 0));

export type SessionSummary = {
  workSets: number;
  warmupSets: number;
  volumeKg: number;
  totalReps: number;
  durationMin: number | null;
  exerciseCount: number;
};

export function sessionSummary(
  session: TrainingSession,
  sets: TrainingSet[],
): SessionSummary {
  const own = sets.filter((s) => s.sessionId === session.id && !s.deletedAt);
  const work = own.filter((s) => s.kind === "work");
  const durationMin = session.endedAt
    ? Math.max(
        0,
        Math.round(
          (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000,
        ),
      )
    : null;
  return {
    workSets: work.length,
    warmupSets: own.length - work.length,
    volumeKg: volumeKg(work),
    totalReps: work.reduce((n, s) => n + (s.reps ?? 0), 0),
    durationMin,
    exerciseCount: new Set(work.map((s) => s.slot)).size,
  };
}

// ── Per oefening ──────────────────────────────────────────────────────

export type ExercisePoint = {
  date: string;
  sessionId: string;
  topWeightKg: number | null;
  repsAtTop: number | null;
  bestE1rm: number | null;
  volumeKg: number;
  totalReps: number;
  bestDurationSec: number | null;
  totalJumps: number | null;
};

export function exerciseSeries(list: Performance[]): ExercisePoint[] {
  return [...list].reverse().map((p) => {
    const top = p.work.reduce<SetValues | null>(
      (best, s) =>
        !best ||
        (s.weightKg ?? 0) > (best.weightKg ?? 0) ||
        ((s.weightKg ?? 0) === (best.weightKg ?? 0) &&
          (s.reps ?? 0) > (best.reps ?? 0))
          ? s
          : best,
      null,
    );
    const e1rms = p.work
      .map((s) => estimateOneRepMax(s.weightKg, s.reps))
      .filter((v): v is number => v !== null);
    const durations = p.work
      .map((s) => s.durationSec)
      .filter((v): v is number => v !== null);
    const jumps = p.work
      .map((s) => s.jumps)
      .filter((v): v is number => v !== null);
    return {
      date: p.date,
      sessionId: p.sessionId,
      topWeightKg: top?.weightKg ?? null,
      repsAtTop: top?.reps ?? null,
      bestE1rm: e1rms.length ? Math.max(...e1rms) : null,
      volumeKg: volumeKg(p.work),
      totalReps: p.work.reduce((n, s) => n + (s.reps ?? 0), 0),
      bestDurationSec: durations.length ? Math.max(...durations) : null,
      totalJumps: jumps.length ? jumps.reduce((a, b) => a + b, 0) : null,
    };
  });
}

export type RecordEntry = {
  value: number;
  date: string;
  sessionId: string;
  detail?: string;
};

export type ExerciseRecords = {
  heaviest: (RecordEntry & { reps: number | null }) | null;
  bestE1rm: RecordEntry | null;
  bestVolume: RecordEntry | null;
  mostReps: RecordEntry | null;
  longest: RecordEntry | null;
  mostJumps: RecordEntry | null;
  // Meeste herhalingen per gewicht, zwaarste eerst.
  repsByWeight: { weightKg: number; reps: number; date: string }[];
};

export function exerciseRecords(list: Performance[]): ExerciseRecords {
  const records: ExerciseRecords = {
    heaviest: null,
    bestE1rm: null,
    bestVolume: null,
    mostReps: null,
    longest: null,
    mostJumps: null,
    repsByWeight: [],
  };
  const byWeight = new Map<number, { reps: number; date: string }>();
  // Oud naar nieuw: bij gelijke waarde blijft het eerste moment het record.
  for (const p of [...list].reverse()) {
    const better = (current: RecordEntry | null, value: number | null) =>
      value !== null && value > 0 && (!current || value > current.value);
    for (const s of p.work) {
      if (better(records.heaviest, s.weightKg)) {
        records.heaviest = {
          value: s.weightKg!,
          reps: s.reps,
          date: p.date,
          sessionId: p.sessionId,
        };
      }
      const e1rm = estimateOneRepMax(s.weightKg, s.reps);
      if (better(records.bestE1rm, e1rm))
        records.bestE1rm = {
          value: e1rm!,
          date: p.date,
          sessionId: p.sessionId,
        };
      if (better(records.mostReps, s.reps))
        records.mostReps = {
          value: s.reps!,
          date: p.date,
          sessionId: p.sessionId,
        };
      if (better(records.longest, s.durationSec))
        records.longest = {
          value: s.durationSec!,
          date: p.date,
          sessionId: p.sessionId,
        };
      if (better(records.mostJumps, s.jumps))
        records.mostJumps = {
          value: s.jumps!,
          date: p.date,
          sessionId: p.sessionId,
        };
      if (s.weightKg && s.reps) {
        const known = byWeight.get(s.weightKg);
        if (!known || s.reps > known.reps)
          byWeight.set(s.weightKg, { reps: s.reps, date: p.date });
      }
    }
    const volume = volumeKg(p.work);
    if (better(records.bestVolume, volume))
      records.bestVolume = {
        value: volume,
        date: p.date,
        sessionId: p.sessionId,
      };
  }
  records.repsByWeight = [...byWeight.entries()]
    .map(([weightKg, v]) => ({ weightKg, ...v }))
    .sort((a, b) => b.weightKg - a.weightKg);
  return records;
}

export type NewRecord = {
  exerciseId: string;
  sessionId: string;
  date: string;
  kind: "heaviest" | "e1rm" | "volume" | "reps" | "duration";
  value: number;
};

// Records die in de meest recente uitvoering van een oefening zijn gezet
// (vergeleken met alles daarvoor). Een eerste uitvoering is geen record.
export function latestRecords(
  index: HistoryIndex,
  tracking: (id: string) => Tracking,
): NewRecord[] {
  const result: NewRecord[] = [];
  for (const [exerciseId, list] of index) {
    if (list.length < 2) continue;
    const [latest, ...earlier] = list;
    const before = exerciseRecords(earlier);
    const now = exerciseRecords([latest]);
    const push = (
      kind: NewRecord["kind"],
      value: number | undefined,
      previous: number | undefined,
    ) => {
      if (value !== undefined && previous !== undefined && value > previous) {
        result.push({
          exerciseId,
          sessionId: latest.sessionId,
          date: latest.date,
          kind,
          value,
        });
      }
    };
    const t = tracking(exerciseId);
    if (t === "weight_reps") {
      push("heaviest", now.heaviest?.value, before.heaviest?.value ?? 0);
      if (
        !(
          now.heaviest &&
          before.heaviest &&
          now.heaviest.value > before.heaviest.value
        )
      ) {
        push("e1rm", now.bestE1rm?.value, before.bestE1rm?.value ?? 0);
      }
    } else if (t === "bodyweight_reps") {
      push("reps", now.mostReps?.value, before.mostReps?.value ?? 0);
    } else {
      push("duration", now.longest?.value, before.longest?.value ?? 0);
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Algemeen ──────────────────────────────────────────────────────────

const completed = (sessions: TrainingSession[]) =>
  sessions.filter((s) => s.status === "completed" && !s.deletedAt);

export function weeklyCounts(
  sessions: TrainingSession[],
  today: string,
  weeks: number,
) {
  const start = weekStart(today);
  const list = completed(sessions);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(start, -7 * (weeks - 1 - i));
    const to = addDays(from, 6);
    return {
      weekStart: from,
      count: list.filter((s) => s.localDate >= from && s.localDate <= to)
        .length,
    };
  });
}

export function monthlyCounts(
  sessions: TrainingSession[],
  today: string,
  months: number,
) {
  const [y, m] = today.split("-").map(Number);
  const list = completed(sessions);
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const key = date.toISOString().slice(0, 7);
    return {
      month: key,
      count: list.filter((s) => s.localDate.startsWith(key)).length,
    };
  });
}

// Weken achter elkaar (tot en met deze of vorige week) met minstens één
// voltooide training.
export function weekStreak(sessions: TrainingSession[], today: string): number {
  const counts = weeklyCounts(sessions, today, 104).reverse();
  let streak = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i].count > 0) streak++;
    else if (i > 0) break; // deze week nog niets: telt niet als breuk
  }
  return streak;
}

// Werksets per spiergroep. Telregel: primaire spiergroep = 1 set,
// secundaire = ½ set. Opwarmsets tellen niet.
export function muscleSetCounts(
  sessions: TrainingSession[],
  sets: TrainingSet[],
  lookup: (id: string) => Exercise | undefined,
  from: string,
  to: string,
): Partial<Record<MuscleGroup, number>> {
  const inRange = new Set(
    completed(sessions)
      .filter((s) => s.localDate >= from && s.localDate <= to)
      .map((s) => s.id),
  );
  const result: Partial<Record<MuscleGroup, number>> = {};
  for (const set of sets) {
    if (set.deletedAt || set.kind !== "work" || !inRange.has(set.sessionId))
      continue;
    const exercise = lookup(set.exerciseId);
    if (!exercise) continue;
    for (const m of exercise.primary) result[m] = (result[m] ?? 0) + 1;
    for (const m of exercise.secondary) result[m] = (result[m] ?? 0) + 0.5;
  }
  return result;
}
