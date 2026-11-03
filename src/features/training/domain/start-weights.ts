import { loadableWeight } from "./plates";
import type { EquipmentConfig, Exercise, TrainingLevel } from "./types";

// Startgewichten van de trainer voor een oefening zonder historie. Bewust
// voorzichtig: bedoeld voor sets van ongeveer 8–12 herhalingen met 2–3
// herhalingen in reserve. Te zwaar of te licht? Pas het in de training aan;
// vanaf dan geldt je eigen gewicht (vorige prestatie wordt de opdracht).
//
// Eenheid volgt de oefening: halterstang = totaal inclusief stang,
// twee dumbbells = gewicht per dumbbell, één dumbbell = die dumbbell.
// Volgorde: [beginner, gevorderd, expert].
const START_WEIGHTS: Record<string, [number, number, number]> = {
  // Borst
  "bench-press": [30, 50, 70],
  "incline-bench-press": [25, 40, 60],
  "floor-press": [30, 50, 70],
  "db-bench-press": [10, 16, 22],
  "db-incline-press": [8, 14, 20],
  "db-floor-press": [10, 16, 22],
  "db-fly": [6, 10, 14],
  // Rug
  "one-arm-db-row": [12, 22, 32],
  "barbell-row": [30, 45, 65],
  "db-bent-over-row": [10, 16, 22],
  "chest-supported-db-row": [8, 14, 20],
  "reverse-fly": [4, 6, 10],
  "db-pullover": [8, 14, 22],
  // Schouders
  "db-shoulder-press": [8, 14, 20],
  "barbell-overhead-press": [20, 30, 45],
  "db-lateral-raise": [4, 6, 10],
  "db-front-raise": [4, 6, 10],
  "rear-delt-raise": [4, 6, 10],
  // Armen
  "db-curl": [6, 10, 14],
  "hammer-curl": [8, 12, 16],
  "concentration-curl": [6, 10, 14],
  "incline-db-curl": [6, 8, 12],
  "barbell-curl": [15, 25, 35],
  "reverse-curl": [12, 20, 28],
  "lying-triceps-extension": [6, 10, 14],
  "overhead-db-extension": [10, 16, 24],
  "close-grip-floor-press": [25, 40, 60],
  "db-kickback": [4, 8, 10],
  // Benen
  "goblet-squat": [12, 22, 32],
  "db-squat": [10, 16, 22],
  "bulgarian-split-squat": [6, 12, 18],
  "db-lunge": [8, 14, 20],
  "reverse-lunge": [8, 14, 20],
  "step-up": [6, 12, 18],
  "barbell-rdl": [35, 60, 90],
  "db-rdl": [12, 18, 22],
  "single-leg-rdl": [8, 14, 22],
  "hip-thrust": [40, 60, 90],
  "db-hip-thrust": [16, 26, 36],
  "standing-calf-raise": [10, 16, 22],
};

const LEVEL_INDEX: Record<TrainingLevel, 0 | 1 | 2> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// Startgewicht van de trainer, passend gemaakt op je schijven (nooit
// zwaarder dan je kunt laden). null = geen voorstel (lichaamsgewicht,
// tijd, eigen oefening).
export function trainerStartWeight(
  exercise: Pick<Exercise, "id" | "tracking" | "loadMode">,
  level: TrainingLevel,
  equipment?: EquipmentConfig,
): number | null {
  if (exercise.tracking !== "weight_reps") return null;
  const row = START_WEIGHTS[exercise.id];
  if (!row) return null;
  const kg = row[LEVEL_INDEX[level]];
  return equipment
    ? loadableWeight(exercise.loadMode, kg, equipment, "below")
    : kg;
}

export const hasTrainerStartWeight = (exerciseId: string) =>
  exerciseId in START_WEIGHTS;
