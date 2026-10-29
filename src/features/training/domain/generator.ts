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

export function dayGoal(
  goal: TrainingGoal,
  accent?: "strength" | "hypertrophy",
): TrainingGoal {
  if (!accent) return goal;
  const index = GOAL_SCALE.indexOf(goal) + (accent === "strength" ? -1 : 1);
  return GOAL_SCALE[Math.min(2, Math.max(0, index))];
}

function adjustSets(
  base: number,
  role: TemplateRole,
  level: TrainingLevel,
): number {
  if (role === "core" || role === "conditioning") return base;
  if (level === "beginner") return Math.max(2, base - 1);
  if (level === "advanced" && (role === "main" || role === "secondary")) {
    return Math.min(5, base + 1);
  }
  return base;
}

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
        ? prefs.level === "beginner"
          ? 1
          : 2
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
  const days: ProgramDay[] = template.days.map((day) => {
    const goal = dayGoal(prefs.goal, day.accent);
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
      planned.push(plan(day.key, index, t, exercise, prefs, goal));
    });

    // Te lang? Eerst optionele oefeningen (van achter naar voren) weg, dan
    // isolatiesets inkorten. Kernoefeningen blijven altijd staan.
    const trimmed = [...planned];
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

    return {
      id: day.key,
      name: day.name,
      focus: day.focus,
      weekdays: [...day.weekdays],
      exercises: trimmed,
    };
  });

  return {
    content: {
      description: template.description,
      scheduleMode: prefs.scheduleMode,
      days,
      level: prefs.level,
      goal: prefs.goal,
    },
    notes,
  };
}
