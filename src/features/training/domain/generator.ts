import { isAvailable } from "./exercises";
import type {
  ProgramTemplate,
  TemplateExercise,
  TemplateRole,
} from "./templates";
import type {
  Exercise,
  PlannedExercise,
  ProgramContent,
  ProgramDay,
  ScheduleMode,
  TrainingGoal,
  TrainingLevel,
} from "./types";

// Maakt van een sjabloon een concreet, bewerkbaar schema voor deze
// gebruiker: niveau, doel, trainingsduur en apparatuur bepalen sets,
// herhalingen, rust en welke oefeningen erin zitten.

export type GeneratorPrefs = {
  level: TrainingLevel;
  goal: TrainingGoal;
  sessionMinutes: number;
  owned: Set<string>;
  scheduleMode: ScheduleMode;
};

export type GeneratorResult = {
  content: ProgramContent;
  // Wat er automatisch is aangepast, zodat de gebruiker het kan zien.
  notes: string[];
};

const GOAL_SCALE: TrainingGoal[] = ["strength", "combined", "hypertrophy"];

// Herhalingsbereik per doel en rol.
const REP_RANGES: Record<
  TrainingGoal,
  Record<"main" | "secondary" | "accessory", [number, number]>
> = {
  strength: { main: [5, 8], secondary: [6, 10], accessory: [8, 12] },
  combined: { main: [6, 10], secondary: [8, 12], accessory: [10, 15] },
  hypertrophy: { main: [8, 12], secondary: [10, 12], accessory: [12, 15] },
};

const MAIN_REST: Record<TrainingGoal, number> = {
  strength: 180,
  combined: 150,
  hypertrophy: 120,
};

// Wat er per niveau anders is (naast het startgewicht, zie start-weights.ts).
//   baseSets   sets ten opzichte van het sjabloon (minimaal 2)
//   maxSets    plafond per oefening als er tijd over is
//   sessionSets  plafond werksets per training (core/conditie tellen niet):
//              daarboven levert extra volume weinig op en kost het herstel
//   warmups    opwarmsets voor de basisoefening
//   effort     hoe zwaar elke werkset moet voelen
export const LEVEL_PROFILES: Record<
  TrainingLevel,
  {
    baseSets: Partial<Record<TemplateRole, number>>;
    maxSets: Record<"main" | "secondary" | "accessory", number>;
    sessionSets: number;
    warmups: number;
    effort: string;
  }
> = {
  beginner: {
    baseSets: { main: -1, secondary: -1, accessory: -1 },
    maxSets: { main: 3, secondary: 3, accessory: 3 },
    sessionSets: 16,
    warmups: 1,
    effort:
      "Stop elke set met 2–3 herhalingen in reserve. Eerst de techniek, dan het gewicht.",
  },
  intermediate: {
    baseSets: {},
    maxSets: { main: 4, secondary: 4, accessory: 3 },
    sessionSets: 22,
    warmups: 2,
    effort: "Stop elke set met 1–3 herhalingen in reserve.",
  },
  advanced: {
    baseSets: { main: 1, secondary: 1 },
    maxSets: { main: 5, secondary: 5, accessory: 4 },
    sessionSets: 26,
    warmups: 2,
    effort:
      "Basisoefeningen met 1–2 herhalingen in reserve; isolatie mag tot vlak bij falen. Zonder spotter nooit tot falen bij bankdrukken.",
  },
};

export function dayGoal(
  goal: TrainingGoal,
  accent?: "strength" | "hypertrophy",
  level?: TrainingLevel,
): TrainingGoal {
  let index = GOAL_SCALE.indexOf(goal);
  if (accent) index += accent === "strength" ? -1 : 1;
  // Beginners trainen niet in het zware 5–8-bereik: eerst techniek en
  // gewenning met iets meer herhalingen.
  const min = level === "beginner" ? 1 : 0;
  return GOAL_SCALE[Math.min(2, Math.max(min, index))];
}

function adjustSets(
  base: number,
  role: TemplateRole,
  level: TrainingLevel,
): number {
  if (role === "core" || role === "conditioning") return base;
  const delta = LEVEL_PROFILES[level].baseSets[role] ?? 0;
  return Math.min(
    LEVEL_PROFILES[level].maxSets[role],
    Math.max(2, base + delta),
  );
}

const isWeighted = (role: TemplateRole | undefined) =>
  role === "main" || role === "secondary" || role === "accessory";

function restFor(
  role: TemplateRole,
  goal: TrainingGoal,
  exercise: Exercise,
): number {
  switch (role) {
    case "main":
      return MAIN_REST[goal];
    case "secondary":
      return goal === "strength" ? 150 : 120;
    case "accessory":
      return exercise.defaultRestSec;
    case "core":
      return 45;
    case "conditioning":
      return 60;
  }
}

// Geschatte duur van een training in minuten: per werkset ~40 s werk plus
// rust, opwarmsets ~1,5 min, en 1 min wisselen per oefening.
export function estimateMinutes(
  exercises: Pick<
    PlannedExercise,
    "sets" | "warmupSets" | "restSec" | "durationSec"
  >[],
): number {
  let seconds = 0;
  for (const e of exercises) {
    const work = e.durationSec ?? 40;
    seconds += e.sets * (work + e.restSec) - e.restSec; // geen rust na de laatste set
    seconds += e.warmupSets * 90;
    seconds += 60;
  }
  return Math.max(0, Math.round(seconds / 60));
}

function plan(
  dayKey: string,
  index: number,
  t: TemplateExercise,
  exercise: Exercise,
  prefs: GeneratorPrefs,
  goal: TrainingGoal,
): PlannedExercise {
  const timed =
    exercise.tracking === "duration" || exercise.tracking === "jump_rope";
  const role = t.role;
  const reps: [number, number] | null = timed
    ? null
    : (t.reps ??
      (role === "main" || role === "secondary" || role === "accessory"
        ? REP_RANGES[goal][role]
        : [10, 15]));
  return {
    id: `${dayKey}-${index + 1}`,
    exerciseId: exercise.id,
    sets: adjustSets(t.sets, role, prefs.level),
    warmupSets:
      role === "main" && exercise.tracking === "weight_reps"
        ? LEVEL_PROFILES[prefs.level].warmups
        : 0,
    repMin: reps ? reps[0] : null,
    repMax: reps ? reps[1] : null,
    durationSec: timed ? (t.durationSec ?? 30) : null,
    restSec: restFor(role, goal, exercise),
    startWeightKg: null,
    priority: t.priority,
  };
}

export function generateProgram(
  template: ProgramTemplate,
  prefs: GeneratorPrefs,
  lookup: (id: string) => Exercise | undefined,
): GeneratorResult {
  const notes: string[] = [];
  const profile = LEVEL_PROFILES[prefs.level];
  const roles = new Map<PlannedExercise, TemplateRole>();
  let filled = false;
  let unfilled = false;
  if (prefs.level === "beginner" && template.daysPerWeek >= 5) {
    notes.push(
      `${template.daysPerWeek} trainingen per week is voor een beginner veel. Het kan, maar Full Body 3 dagen geeft evenveel vooruitgang met meer herstel. Merk je dat je moe blijft, sla dan een dag over.`,
    );
  }
  const days: ProgramDay[] = template.days.map((day) => {
    const goal = dayGoal(prefs.goal, day.accent, prefs.level);
    const planned: PlannedExercise[] = [];
    day.exercises.forEach((t, index) => {
      let exercise = lookup(t.exerciseId);
      if (!exercise) return;
      if (!isAvailable(exercise, prefs.owned)) {
        const alternative = exercise.alternatives
          .map(lookup)
          .find(
            (alt): alt is Exercise => !!alt && isAvailable(alt, prefs.owned),
          );
        if (!alternative) {
          notes.push(
            `${day.name}: ${exercise.name} weggelaten (apparatuur ontbreekt).`,
          );
          return;
        }
        notes.push(
          `${day.name}: ${exercise.name} vervangen door ${alternative.name}.`,
        );
        exercise = alternative;
      }
      const p = plan(day.key, index, t, exercise, prefs, goal);
      roles.set(p, t.role);
      planned.push(p);
    });

    // Te lang? Eerst optionele oefeningen (van achter naar voren) weg, dan
    // isolatiesets inkorten. Kernoefeningen blijven altijd staan.
    const trimmed = [...planned];
    const tooLong = estimateMinutes(trimmed) > prefs.sessionMinutes;
    for (const priority of [3, 2] as const) {
      for (let i = trimmed.length - 1; i >= 0; i--) {
        if (estimateMinutes(trimmed) <= prefs.sessionMinutes) break;
        if (trimmed[i].priority === priority && trimmed.length > 4) {
          const name =
            lookup(trimmed[i].exerciseId)?.name ?? trimmed[i].exerciseId;
          notes.push(
            `${day.name}: ${name} weggelaten om binnen ${prefs.sessionMinutes} min te blijven.`,
          );
          trimmed.splice(i, 1);
        }
      }
    }
    for (const e of trimmed) {
      if (estimateMinutes(trimmed) <= prefs.sessionMinutes) break;
      if (e.priority !== 1 && e.sets > 2) e.sets -= 1;
    }
    // Nog steeds te lang: ook de kern inkorten (van achter naar voren,
    // minimaal 2 sets).
    for (let i = trimmed.length - 1; i >= 0; i--) {
      while (
        estimateMinutes(trimmed) > prefs.sessionMinutes &&
        trimmed[i].sets > 2 &&
        isWeighted(roles.get(trimmed[i]))
      ) {
        trimmed[i].sets -= 1;
      }
    }

    // Tijd over: sets erbij tot de tijd vol is of het plafond van het
    // niveau bereikt is. Eerst de basisoefeningen, dan de rest; telkens één
    // set per oefening, zodat het volume gelijkmatig groeit.
    const workSets = () =>
      trimmed.reduce((n, e) => (isWeighted(roles.get(e)) ? n + e.sets : n), 0);
    const order = [...trimmed]
      .filter((e) => isWeighted(roles.get(e)))
      .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
    // Na inkorten niet weer opvullen: dan zou een isolatieoefening sets
    // terugkrijgen die net bij een basisoefening zijn weggehaald.
    let added = !tooLong;
    while (added) {
      added = false;
      for (const e of order) {
        const role = roles.get(e) as "main" | "secondary" | "accessory";
        if (e.sets >= profile.maxSets[role]) continue;
        if (workSets() >= profile.sessionSets) break;
        e.sets += 1;
        if (estimateMinutes(trimmed) > prefs.sessionMinutes) {
          e.sets -= 1;
          continue;
        }
        added = true;
        filled = true;
      }
    }
    if (prefs.sessionMinutes - estimateMinutes(trimmed) >= 15) unfilled = true;

    return {
      id: day.key,
      name: day.name,
      focus: day.focus,
      weekdays: [...day.weekdays],
      exercises: trimmed,
    };
  });

  if (filled) {
    notes.push(
      `Sets toegevoegd om je ${prefs.sessionMinutes} minuten te benutten.`,
    );
  }
  if (unfilled) {
    notes.push(
      `Sommige trainingen blijven ruim korter dan ${prefs.sessionMinutes} minuten. Bewust: nog meer sets (maximaal ${profile.maxSets.main} per basisoefening en ${profile.sessionSets} per training op dit niveau) levert weinig extra op en kost vooral herstel.`,
    );
  }
  notes.push(`Inspanning: ${profile.effort}`);

  return {
    content: {
      description: `${template.description}\n\nInspanning: ${profile.effort}`,
      scheduleMode: prefs.scheduleMode,
      days,
      level: prefs.level,
      goal: prefs.goal,
    },
    notes,
  };
}
