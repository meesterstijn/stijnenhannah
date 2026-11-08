import type { Exercise, MuscleGroup } from "./types";

// Snel een eigen oefening aanmaken vanuit het kiesvenster (bijv. een machine
// in de sportschool die niet in de lijst staat). Alleen de vragen die nodig
// zijn om sets te kunnen registreren; de rest kan later via Oefeningen.

export type QuickKind =
  | "barbell"
  | "dumbbell_pair"
  | "dumbbell_single"
  | "machine"
  | "bodyweight"
  | "duration";

export const QUICK_KIND_LABELS: Record<QuickKind, string> = {
  machine: "Machine of kabel",
  dumbbell_pair: "Twee dumbbells",
  dumbbell_single: "Eén dumbbell",
  barbell: "Lange stang",
  bodyweight: "Lichaamsgewicht",
  duration: "Op tijd",
};

export type QuickExerciseInput = {
  name: string;
  kind: QuickKind;
  primary: MuscleGroup[];
};

export function quickExercise({
  name,
  kind,
  primary,
}: QuickExerciseInput): Exercise {
  const base: Exercise = {
    id: "",
    name: name.trim().slice(0, 80),
    primary,
    secondary: [],
    type: "isolation",
    // Machine/kabel: geen thuisapparatuur, dus geen eis (anders staat de
    // oefening als "Apparatuur ontbreekt" onderaan).
    equipment: [],
    tracking: "weight_reps",
    loadMode: "none",
    summary: "",
    steps: [],
    mistakes: [],
    safety: [],
    defaultRestSec: 90,
    alternatives: [],
    custom: true,
  };
  switch (kind) {
    case "barbell":
      return {
        ...base,
        type: "compound",
        equipment: ["barbell"],
        loadMode: "barbell",
        defaultRestSec: 120,
      };
    case "dumbbell_pair":
    case "dumbbell_single":
      return { ...base, equipment: ["dumbbell"], loadMode: kind };
    case "bodyweight":
      return {
        ...base,
        equipment: ["bodyweight"],
        tracking: "bodyweight_reps",
      };
    case "duration":
      return {
        ...base,
        type: "core",
        equipment: ["bodyweight"],
        tracking: "duration",
        defaultRestSec: 60,
      };
    case "machine":
      return base;
  }
}
