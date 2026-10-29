// Datamodel van de trainingsmodule. Puur TypeScript, zonder React of
// database, zodat alle rekenregels los te testen zijn.

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Uitbreidbaar: nieuwe apparatuur is gewoon een nieuwe string.
export type EquipmentKind =
  | "barbell"
  | "dumbbell"
  | "bench"
  | "bodyweight"
  | "jump_rope"
  | (string & {});

export type ExerciseType = "compound" | "isolation" | "core" | "conditioning";

// Hoe een set wordt vastgelegd.
//   weight_reps     kg × herhalingen
//   bodyweight_reps herhalingen, optioneel met extra gewicht
//   duration        tijd (bv. plank)
//   jump_rope       tijd per ronde, optioneel aantal sprongen
export type Tracking =
  | "weight_reps"
  | "bodyweight_reps"
  | "duration"
  | "jump_rope";

// Hoe het gewicht geladen wordt (voor de schijvencalculator).
//   barbell         lange stang, gewicht = totaal
//   dumbbell_pair   twee dumbbells tegelijk, gewicht = per dumbbell
//   dumbbell_single één dumbbell, gewicht = die dumbbell
export type LoadMode = "barbell" | "dumbbell_pair" | "dumbbell_single" | "none";

export type Exercise = {
  id: string; // stabiel, nooit hernoemen (historie hangt hieraan)
  name: string;
  nameEn?: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  type: ExerciseType;
  equipment: EquipmentKind[]; // alles wat nodig is
  tracking: Tracking;
  loadMode: LoadMode;
  perSide?: boolean; // herhalingen/tijd per kant
  summary: string;
  steps: string[];
  mistakes: string[];
  safety: string[];
  homeNote?: string;
  defaultRestSec: number;
  alternatives: string[]; // ids van vergelijkbare oefeningen
  link?: string;
  custom?: boolean;
  archived?: boolean;
};

// ── Schema's ──────────────────────────────────────────────────────────

export type ScheduleMode = "weekly" | "sequence";

export type PlannedExercise = {
  id: string; // uniek binnen het schema
  exerciseId: string;
  sets: number;
  warmupSets: number;
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null; // doel bij tijd/touwspringen
  restSec: number;
  startWeightKg: number | null; // beginwaarde zolang er geen historie is
  notes?: string;
  // 1 = kern, 2 = belangrijk, 3 = optioneel (valt als eerste af bij korte
  // trainingen). Alleen gebruikt door de schemagenerator.
  priority?: 1 | 2 | 3;
  // Voorbereid voor supersets/dropsets; nog geen UI.
  groupId?: string | null;
};

export type ProgramDay = {
  id: string;
  name: string;
  focus?: string;
  weekdays: number[]; // 0 = maandag … 6 = zondag (vaste weekplanning)
  exercises: PlannedExercise[];
};

export type ProgramContent = {
  description?: string;
  scheduleMode: ScheduleMode;
  days: ProgramDay[];
  level?: TrainingLevel;
  goal?: TrainingGoal;
};

export type SyncMeta = {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
};

export type Program = SyncMeta & {
  id: string;
  userId: string;
  name: string;
  content: ProgramContent;
  revision: number;
  source: string | null; // id van het sjabloon waaruit het komt
  archivedAt: string | null;
};

// ── Sessies en sets ───────────────────────────────────────────────────

export type SessionStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "skipped";

export type SetValues = {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  jumps: number | null;
};

export type SetKind = "warmup" | "work";

// Waar de voorgeschreven waarden vandaan komen.
export type PrescriptionSource =
  | {
      kind: "previous";
      sessionId: string;
      date: string;
      programId: string | null;
      programName: string | null;
      dayName: string | null;
    }
  | { kind: "plan" };

export type SessionExercise = {
  slot: number; // positie in deze sessie, stabiel (ook na verwijderen)
  plannedId: string | null;
  exerciseId: string;
  name: string; // naam op het moment van trainen
  tracking: Tracking;
  loadMode: LoadMode;
  perSide?: boolean;
  restSec: number;
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null;
  plannedSets: number; // aantal werksets in het schema op dat moment
  warmup: SetValues[]; // voorgeschreven/aangepaste waarden per set
  work: SetValues[];
  source: PrescriptionSource;
  notes?: string;
  removed?: boolean; // oefening tijdens de training weggehaald
  replacedFrom?: string | null; // oorspronkelijke oefening bij vervangen
};

export type SessionSnapshot = {
  programName: string | null;
  dayName: string | null;
  exercises: SessionExercise[];
  // Waar de gebruiker was (hervatten op dezelfde plek).
  cursor?: { slot: number; kind: SetKind; index: number } | null;
  endedEarly?: boolean;
};

export type TrainingSession = SyncMeta & {
  id: string;
  userId: string;
  programId: string | null;
  programRevision: number | null;
  dayId: string | null;
  name: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  localDate: string; // YYYY-MM-DD in de tijdzone van de gebruiker
  timeZone: string | null;
  notes: string | null;
  snapshot: SessionSnapshot;
};

export type TrainingSet = SyncMeta &
  SetValues & {
    id: string;
    userId: string;
    sessionId: string;
    exerciseId: string;
    slot: number;
    kind: SetKind;
    setIndex: number;
    rpe: number | null;
    rir: number | null;
    notes: string | null;
    completedAt: string;
  };

// ── Profiel, apparatuur, lichaam ──────────────────────────────────────

export type TrainingLevel = "beginner" | "intermediate" | "advanced";
export type TrainingGoal = "strength" | "hypertrophy" | "combined";

export type TrainingSettings = {
  level: TrainingLevel;
  goal: TrainingGoal;
  daysPerWeek: number;
  sessionMinutes: number;
  activeProgramId: string | null;
  // Vorige prestatie: meest recente uitvoering ongeacht schema, of alleen
  // binnen het schema van de huidige training.
  historyScope: "any" | "program";
  progressionHints: boolean;
  sound: boolean;
  vibrate: boolean;
  notifications: boolean;
  keepAwake: boolean;
  // "auto" bestaat nog voor oudere profielen en betekent licht.
  appearance: "auto" | "light" | "dark";
  showE1rm: boolean;
};

export type PlateStock = { weightKg: number; count: number };

export type EquipmentConfig = {
  // Gewicht onbekend = null; de calculator vraagt er dan om.
  barbell: {
    owned: boolean;
    weightKg: number | null;
    maxLoadKg: number | null;
  };
  dumbbells: {
    count: number;
    handleWeightKg: number | null; // per stang
    maxLoadKg: number | null; // per dumbbell
  };
  collars: {
    weightKg: number; // per sluiting
    useOnBarbell: boolean;
    useOnDumbbells: boolean;
  };
  plates: PlateStock[];
  owned: EquipmentKind[]; // overige apparatuur (bank, springtouw, …)
};

export type ExercisePref = {
  favorite?: boolean;
  notes?: string;
  restSec?: number;
  startWeightKg?: number;
};

export type Profile = SyncMeta & {
  id: string; // = userId
  userId: string;
  settings: TrainingSettings;
  equipment: EquipmentConfig;
  exercisePrefs: Record<string, ExercisePref>;
};

export type BodyMetric = SyncMeta & {
  id: string;
  userId: string;
  measuredOn: string; // YYYY-MM-DD
  weightKg: number | null;
  measurements: Record<string, number>; // cm, bv. { waist: 84 }
  notes: string | null;
};

export type CustomExerciseRecord = SyncMeta & {
  id: string;
  userId: string;
  name: string;
  data: Omit<Exercise, "id" | "name" | "custom">;
  archivedAt: string | null;
};
