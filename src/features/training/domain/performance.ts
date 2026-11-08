import { isTimed, sameTargets } from "./set-targets";
import type {
  PlannedSetTarget,
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
//   7. Doelen per set in het schema (piramide) gelden de eerste keer, en
//      opnieuw zodra ze in het schema anders zijn dan bij de vorige training.

export type Performance = {
  sessionId: string;
  date: string; // localDate
  at: string; // tijdstip van afronden (sorteren)
  programId: string | null;
  programName: string | null;
  dayName: string | null;
  plannedSets: number | null; // schema-aantal op dat moment
  plannedTargets: PlannedSetTarget[] | null; // schema-doelen per set toen
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
        plannedTargets: planned?.plannedTargets ?? null,
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
      a.at === b.at
        ? b.sessionId.localeCompare(a.sessionId)
        : b.at.localeCompare(a.at),
    );
  }
  return index;
}

export type HistoryScope = {
  scope: "any" | "program";
  programId?: string | null;
  excludeSessionId?: string;
};

export function performances(
  index: HistoryIndex,
  exerciseId: string,
  opts: HistoryScope,
): Performance[] {
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
  setTargets?: PlannedSetTarget[] | null;
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

// Doel per set uit het schema; lege velden vallen terug op het gewone
// voorschrift.
function targetValues(
  t: PlannedSetTarget,
  filler: SetValues,
  tracking: Tracking,
): SetValues {
  const timed = isTimed(tracking);
  const weighted = tracking === "weight_reps" || tracking === "bodyweight_reps";
  return {
    weightKg: weighted ? (t.weightKg ?? filler.weightKg) : null,
    reps: timed ? null : (t.reps ?? filler.reps),
    durationSec: timed ? (t.durationSec ?? filler.durationSec) : null,
    jumps: null,
  };
}

function resize(
  list: SetValues[],
  count: number,
  filler: SetValues,
): SetValues[] {
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
function defaultWarmups(
  count: number,
  firstWork: SetValues | undefined,
): SetValues[] {
  const pct = [0.5, 0.75, 0.85];
  const reps = [8, 5, 3];
  return Array.from({ length: count }, (_, i) => ({
    weightKg:
      firstWork?.weightKg != null
        ? Math.floor(firstWork.weightKg * pct[Math.min(i, 2)])
        : null,
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
  const targets = input.setTargets?.length ? input.setTargets : null;
  const planWork = () =>
    targets
      ? targets.map((t) => targetValues(t, filler, input.tracking))
      : Array.from({ length: Math.max(1, input.sets) }, () => ({
          ...filler,
        }));
  if (!previous || previous.work.length === 0) {
    const work = planWork();
    return {
      work,
      warmup: defaultWarmups(input.warmupSets, work[0]),
      source: { kind: "plan" },
    };
  }
  if (targets && !sameTargets(targets, previous.plannedTargets)) {
    // Doelen per set in het schema gewijzigd sinds die training: het
    // schema gaat voor (zoals bij een gewijzigd aantal sets).
    const work = planWork();
    let warmup = performedList(previous.warmupTargets, previous.warmup);
    if (warmup.length === 0) warmup = defaultWarmups(input.warmupSets, work[0]);
    return { work, warmup, source: { kind: "plan" } };
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

// ── Trainer: verhogen, vasthouden of verlagen ─────────────────────────
//
// Dubbele progressie: eerst herhalingen opbouwen binnen het bereik, en pas
// als alle sets de bovenkant halen gaat het gewicht omhoog (en begin je
// weer onderaan het bereik).
//   increase  alle sets op de bovenkant: beginner en gevorderd na één
//             keer, expert na twee keer op rij (kleinere stappen houden).
//   hold      vorige keer niet alle sets op de ondergrens: nog niet
//             verhogen (de trainer raadt een verhoging af).
//   decrease  twee keer op rij de meeste sets onder de ondergrens op
//             hetzelfde gewicht: ~10% lichter.
//   build     zelfde gewicht, probeer per set een herhaling meer.
//   max       klaar om te verhogen, maar je schijven laten niet meer toe.
// Alleen voor oefeningen met gewicht × herhalingen.

export type CoachAdvice =
  | { kind: "increase"; fromKg: number; toKg: number; text: string }
  | { kind: "decrease"; fromKg: number; toKg: number; text: string }
  | { kind: "hold"; weightKg: number; text: string }
  | { kind: "build"; weightKg: number; text: string }
  | { kind: "max"; weightKg: number; text: string };

export type CoachInput = {
  tracking: Tracking;
  repMin: number | null;
  repMax: number | null;
  level: "beginner" | "intermediate" | "advanced";
  stepKg: number;
  // Grote oefening voor het onderlichaam met een halterstang: beginners
  // mogen daar een dubbele stap zetten.
  bigLowerBody?: boolean;
  // Rondt een gewicht af op wat je kunt laden (zie loadableWeight).
  fit?: (kg: number, prefer: "below" | "above") => number;
};

const fmt = (kg: number) => `${String(kg).replace(".", ",")} kg`;

// Het werkgewicht van een training: het zwaarste gewicht waarmee sets zijn
// gedaan, met alleen de sets op dat gewicht.
function workingSets(p: Performance) {
  const weight = topWeight(p);
  return {
    weight,
    sets: p.work.filter((s) => (s.weightKg ?? 0) === weight),
    complete: p.work.length >= (p.targets.length || p.plannedSets || 0),
  };
}

export function coachAdvice(
  list: Performance[],
  input: CoachInput,
): CoachAdvice | null {
  if (input.tracking !== "weight_reps") return null;
  const last = list[0];
  if (!last || last.work.length === 0) return null;
  // Doelen per set (piramide e.d.): dubbele progressie gaat uit van gelijke
  // sets, dus geen advies; opbouwen gaat dan via het schema.
  if (last.plannedTargets?.length) return null;
  const repMin = last.repMin ?? input.repMin;
  const repMax = last.repMax ?? input.repMax ?? repMin;
  if (repMin === null || repMax === null) return null;
  const { weight, sets, complete } = workingSets(last);
  if (weight <= 0) return null;
  const reps = (s: SetValues) => s.reps ?? 0;

  const allTop = (p: Performance) => {
    const w = workingSets(p);
    return (
      w.weight === weight &&
      w.complete &&
      p.work.every((s) => (s.weightKg ?? 0) === weight) &&
      w.sets.every((s) => reps(s) >= repMax)
    );
  };
  const mostlyMissed = (p: Performance) => {
    const w = workingSets(p);
    const missed = w.sets.filter((s) => reps(s) < repMin).length;
    return w.weight === weight && missed > w.sets.length / 2;
  };

  const needed = input.level === "advanced" ? 2 : 1;
  if (list.length >= needed && list.slice(0, needed).every(allTop)) {
    const steps = input.level === "beginner" && input.bigLowerBody ? 2 : 1;
    const raw = weight + input.stepKg * steps;
    const toKg = input.fit ? input.fit(raw, "above") : raw;
    if (toKg <= weight) {
      return {
        kind: "max",
        weightKg: weight,
        text: `Je haalde ${repMax} herhalingen op alle sets, maar zwaarder dan ${fmt(weight)} kan niet met je schijven. Doe er een set bij of laat elke herhaling langzamer zakken (3 tellen).`,
      };
    }
    return {
      kind: "increase",
      fromKg: weight,
      toKg,
      text:
        needed === 1
          ? `Vorige keer alle sets ${repMax} herhalingen of meer op ${fmt(weight)}. Tijd om te verhogen naar ${fmt(toKg)} en weer met ${repMin} herhalingen te beginnen.`
          : `Twee keer op rij alle sets ${repMax} herhalingen of meer op ${fmt(weight)}. Tijd om te verhogen naar ${fmt(toKg)} en weer met ${repMin} herhalingen te beginnen.`,
    };
  }

  if (list.length >= 2 && mostlyMissed(list[0]) && mostlyMissed(list[1])) {
    const raw = Math.max(input.stepKg, weight * 0.9);
    let toKg = input.fit ? input.fit(raw, "below") : raw;
    if (toKg >= weight) toKg = Math.max(0, weight - input.stepKg);
    if (toKg > 0 && toKg < weight) {
      return {
        kind: "decrease",
        fromKg: weight,
        toKg,
        text: `Twee keer op rij haalde je de ${repMin} herhalingen bij de meeste sets niet op ${fmt(weight)}. De trainer raadt aan iets lichter te gaan (${fmt(toKg)}) en de herhalingen weer op te bouwen.`,
      };
    }
  }

  if (!complete) {
    const planned = last.targets.length || last.plannedSets || 0;
    return {
      kind: "hold",
      weightKg: weight,
      text: `Nog niet verhogen: vorige keer deed je ${last.work.length} van de ${planned} sets. Doe eerst alle sets op ${fmt(weight)}.`,
    };
  }
  if (sets.some((s) => reps(s) < repMin)) {
    return {
      kind: "hold",
      weightKg: weight,
      text: `Nog niet verhogen: haal eerst ${repMin} herhalingen op alle sets met ${fmt(weight)}.`,
    };
  }

  return {
    kind: "build",
    weightKg: weight,
    text: `Blijf op ${fmt(weight)} en probeer per set een herhaling meer dan vorige keer. Haal je ${repMax} op alle sets, dan gaat het gewicht omhoog.`,
  };
}

// Past een verhoging of verlaging toe op de werksets die nog op het oude
// gewicht staan; de herhalingen beginnen dan weer onderaan het bereik.
export function applyCoachWeight(
  work: SetValues[],
  advice: { kind: "increase" | "decrease"; fromKg: number; toKg: number },
  repMin: number | null,
  skip: (index: number) => boolean = () => false,
): SetValues[] {
  return work.map((s, i) =>
    !skip(i) && s.weightKg === advice.fromKg
      ? {
          ...s,
          weightKg: advice.toKg,
          reps: repMin ?? s.reps,
        }
      : s,
  );
}
