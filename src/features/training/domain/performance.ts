import type {
  PrescriptionSource,
  SetValues,
  Tracking,
  TrainingSession,
  TrainingSet,
} from "./types";

// ── Vorige prestatie wordt de nieuwe opdracht ─────────────────────────
//
// Regels (zie ook docs/training.md):
//   1. Alleen voltooide, niet-verwijderde sessies tellen. Actieve,
//      onderbroken, geannuleerde en overgeslagen sessies overschrijven de
//      vorige prestatie nooit.
//   2. Per oefening-id; een andere variant is een ander id, dus historie
//      wordt nooit tussen varianten samengevoegd.
//   3. De meest recente uitvoering wint (of: alleen binnen dit schema).
//   4. Aantal sets = het aantal dat je de vorige keer had staan (ook als je
//      er zelf sets bij deed of af haalde). Is het schema sindsdien
//      aangepast, dan volgt het aantal het schema.
//   5. Per set: de waarden die je toen echt deed. Een set die je toen niet
//      afrondde, houdt het doel van toen (wordt niet "verlaagd").
//   6. Nooit automatisch zwaarder of meer herhalingen: dat beslis jij.

export type Performance = {
  sessionId: string;
  date: string; // localDate
  at: string; // tijdstip van afronden (sorteren)
  programId: string | null;
  programName: string | null;
  dayName: string | null;
  plannedSets: number | null; // schema-aantal op dat moment
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null;
  targets: SetValues[]; // werksets zoals ze bij afronden klaarstonden
  work: (SetValues & { setIndex: number })[]; // echt voltooide werksets
  warmupTargets: SetValues[];
  warmup: (SetValues & { setIndex: number })[];
};

// Per oefening-id alle uitvoeringen, nieuwste eerst.
export type HistoryIndex = Map<string, Performance[]>;

const values = (s: SetValues): SetValues => ({
  weightKg: s.weightKg,
  reps: s.reps,
  durationSec: s.durationSec,
  jumps: s.jumps,
});

export const sessionTime = (s: TrainingSession) => s.endedAt ?? s.startedAt;

export function buildHistoryIndex(
  sessions: TrainingSession[],
  sets: TrainingSet[],
): HistoryIndex {
  const completed = sessions.filter(
    (s) => s.status === "completed" && !s.deletedAt,
  );
  const ids = new Set(completed.map((s) => s.id));
  const bySession = new Map<string, TrainingSet[]>();
  for (const set of sets) {
    if (set.deletedAt || !ids.has(set.sessionId)) continue;
    const list = bySession.get(set.sessionId) ?? [];
    list.push(set);
    bySession.set(set.sessionId, list);
  }

  const index: HistoryIndex = new Map();
  for (const session of completed) {
    const sessionSets = bySession.get(session.id) ?? [];
    const byExercise = new Map<string, TrainingSet[]>();
    for (const set of sessionSets) {
      const list = byExercise.get(set.exerciseId) ?? [];
      list.push(set);
      byExercise.set(set.exerciseId, list);
    }
    for (const [exerciseId, list] of byExercise) {
      // Komt een oefening twee keer voor in één sessie, dan telt het eerste
      // slot (de "hoofd"-uitvoering).
      const slot = Math.min(...list.map((s) => s.slot));
      const slotSets = list
        .filter((s) => s.slot === slot)
        .sort((a, b) => a.setIndex - b.setIndex);
      const work = slotSets.filter((s) => s.kind === "work");
      if (work.length === 0) continue;
      const warmup = slotSets.filter((s) => s.kind === "warmup");
      const planned = session.snapshot?.exercises?.find(
        (e) => e.slot === slot && e.exerciseId === exerciseId,
      );
      const performance: Performance = {
        sessionId: session.id,
        date: session.localDate,
        at: sessionTime(session),
        programId: session.programId,
        programName: session.snapshot?.programName ?? null,
        dayName: session.snapshot?.dayName ?? session.name,
        plannedSets: planned?.plannedSets ?? null,
        repMin: planned?.repMin ?? null,
        repMax: planned?.repMax ?? null,
        durationSec: planned?.durationSec ?? null,
        targets: (planned?.work ?? []).map(values),
        work: work.map((s) => ({ ...values(s), setIndex: s.setIndex })),
        warmupTargets: (planned?.warmup ?? []).map(values),
        warmup: warmup.map((s) => ({ ...values(s), setIndex: s.setIndex })),
      };
      const listForExercise = index.get(exerciseId) ?? [];
      listForExercise.push(performance);
      index.set(exerciseId, listForExercise);
    }
  }
  for (const list of index.values()) {
    list.sort((a, b) =>
      a.at === b.at ? b.sessionId.localeCompare(a.sessionId) : b.at.localeCompare(a.at),
    );
  }
  return index;
}

export type HistoryScope = { scope: "any" | "program"; programId?: string | null; excludeSessionId?: string };

export function performances(index: HistoryIndex, exerciseId: string, opts: HistoryScope): Performance[] {
  return (index.get(exerciseId) ?? []).filter(
    (p) =>
      p.sessionId !== opts.excludeSessionId &&
      (opts.scope === "any" || p.programId === (opts.programId ?? null)),
  );
}

export function previousPerformance(
  index: HistoryIndex,
  exerciseId: string,
  opts: HistoryScope,
): Performance | null {
  return performances(index, exerciseId, opts)[0] ?? null;
}

// ── Opdracht voor vandaag ─────────────────────────────────────────────

export type PrescriptionInput = {
  sets: number;
  warmupSets: number;
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null;
  startWeightKg: number | null;
  tracking: Tracking;
};

export type Prescription = {
  work: SetValues[];
  warmup: SetValues[];
  source: PrescriptionSource;
};

export function defaultSet(input: PrescriptionInput): SetValues {
  const timed = input.tracking === "duration" || input.tracking === "jump_rope";
  return {
    weightKg:
      input.tracking === "weight_reps" || input.tracking === "bodyweight_reps"
        ? input.startWeightKg
        : null,
    reps: timed ? null : (input.repMin ?? input.repMax ?? null),
    durationSec: timed ? (input.durationSec ?? 30) : null,
    jumps: null,
  };
}

function resize(list: SetValues[], count: number, filler: SetValues): SetValues[] {
  const result = list.slice(0, count).map(values);
  while (result.length < count) {
    result.push(values(result[result.length - 1] ?? filler));
  }
  return result;
}

// Wat er de vorige keer klaarstond, met de echt gedane waarden erin.
function performedList(
  targets: SetValues[],
  done: (SetValues & { setIndex: number })[],
): SetValues[] {
  const byIndex = new Map(done.map((s) => [s.setIndex, s]));
  const count = Math.max(targets.length, ...done.map((s) => s.setIndex + 1), 0);
  const result: SetValues[] = [];
  for (let i = 0; i < count; i++) {
    const actual = byIndex.get(i);
    const target = targets[i];
    if (actual) result.push(values(actual));
    else if (target) result.push(values(target));
  }
  return result;
}

// Opwarmsets zonder historie: ~50% en ~75% van de eerste werkset.
function defaultWarmups(count: number, firstWork: SetValues | undefined): SetValues[] {
  const pct = [0.5, 0.75, 0.85];
  const reps = [8, 5, 3];
  return Array.from({ length: count }, (_, i) => ({
    weightKg:
      firstWork?.weightKg != null ? Math.floor(firstWork.weightKg * pct[Math.min(i, 2)]) : null,
    reps: reps[Math.min(i, 2)],
    durationSec: null,
    jumps: null,
  }));
}

export function buildPrescription(
  input: PrescriptionInput,
  previous: Performance | null,
): Prescription {
  const filler = defaultSet(input);
  if (!previous || previous.work.length === 0) {
    const work = Array.from({ length: Math.max(1, input.sets) }, () => ({ ...filler }));
    return {
      work,
      warmup: defaultWarmups(input.warmupSets, work[0]),
      source: { kind: "plan" },
    };
  }

  let work = performedList(previous.targets, previous.work);
  if (previous.plannedSets !== null && previous.plannedSets !== input.sets) {
    // Schema aangepast sinds die training: aantal sets volgt het schema.
    work = resize(work, Math.max(1, input.sets), filler);
  }

  let warmup = performedList(previous.warmupTargets, previous.warmup);
  if (warmup.length === 0) warmup = defaultWarmups(input.warmupSets, work[0]);

  return {
    work,
    warmup,
    source: {
      kind: "previous",
      sessionId: previous.sessionId,
      date: previous.date,
      programId: previous.programId,
      programName: previous.programName,
      dayName: previous.dayName,
    },
  };
}

// ── Progressiesuggestie (alleen informatie) ───────────────────────────

const HINT_SESSIONS = 3;

function metTargets(p: Performance, tracking: Tracking): boolean {
  const target = p.targets.length || p.plannedSets || 0;
  if (target === 0 || p.work.length < target) return false;
  return p.work.every((s) => {
    if (tracking === "duration" || tracking === "jump_rope") {
      return p.durationSec === null || (s.durationSec ?? 0) >= p.durationSec;
    }
    const goal = p.repMax ?? p.repMin;
    return goal === null || (s.reps ?? 0) >= goal;
  });
}

const topWeight = (p: Performance) =>
  Math.max(...p.work.map((s) => s.weightKg ?? 0));

// Geeft een zachte hint als de laatste drie trainingen van deze oefening
// alle sets haalden (met het bovenste herhalingsdoel) op hetzelfde gewicht.
// Verandert zelf nooit iets.
export function progressionHint(
  list: Performance[],
  tracking: Tracking,
): string | null {
  if (list.length < HINT_SESSIONS) return null;
  const recent = list.slice(0, HINT_SESSIONS);
  if (!recent.every((p) => metTargets(p, tracking))) return null;
  if (tracking === "weight_reps") {
    const weight = topWeight(recent[0]);
    if (!recent.every((p) => topWeight(p) === weight)) return null;
  }
  const repGoal = recent[0].repMax ?? recent[0].repMin;
  return repGoal !== null && tracking !== "duration" && tracking !== "jump_rope"
    ? `Je hebt de laatste drie trainingen alle sets met ${repGoal} herhalingen of meer voltooid. Misschien ben je klaar voor een verhoging.`
    : "Je hebt de laatste drie trainingen alle sets voltooid. Misschien ben je klaar voor een verhoging.";
}
