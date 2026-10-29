import type { TrainingGoal } from "./types";

// Standaardschema's en de coachbibliotheek. Eigen, zorgvuldig samengestelde
// schema's op basis van algemeen beschreven trainingsprincipes; geen kopie
// van een betaald of exclusief programma, en niet naar een coach vernoemd.
//
// Een sjabloon is "basisvolume voor gemiddeld niveau". De generator
// (generator.ts) past sets, herhalingen, rust en duur aan op niveau, doel,
// tijd en apparatuur.

// main      zware basisoefening (meer rust, opwarmsets)
// secondary tweede compoundoefening
// accessory isolatie/aanvullend
// core      buik/romp, vaste doelen
// conditioning touwspringen, vaste doelen
export type TemplateRole = "main" | "secondary" | "accessory" | "core" | "conditioning";

export type TemplateExercise = {
  exerciseId: string;
  sets: number;
  reps?: [number, number]; // alleen bij core (anders volgt het uit doel/rol)
  durationSec?: number;
  role: TemplateRole;
  priority: 1 | 2 | 3;
};

export type TemplateDay = {
  key: string;
  name: string;
  focus: string;
  weekdays: number[]; // 0 = maandag
  // Accent van deze dag (bv. Push A kracht, Push B spiermassa); schuift het
  // gekozen doel één stap die kant op.
  accent?: "strength" | "hypertrophy";
  exercises: TemplateExercise[];
};

export type ProgramTemplate = {
  id: string;
  name: string;
  category: "standard" | "library";
  daysPerWeek: number;
  recommendedLevel: string;
  description: string;
  principles: string[];
  sources: string[];
  goalFit: TrainingGoal[];
  days: TemplateDay[];
};

const x = (
  exerciseId: string,
  sets: number,
  role: TemplateRole,
  priority: 1 | 2 | 3,
  extra: Partial<TemplateExercise> = {},
): TemplateExercise => ({ exerciseId, sets, role, priority, ...extra });

const JUMP_FINISHER = (rounds: number, sec: number) =>
  x("jump-rope", rounds, "conditioning", 3, { durationSec: sec });

// Algemene bronnen (openbaar, wetenschappelijk). Bewust als "basis voor de
// principes" vermeld, niet als bron van een specifiek schema.
export const GENERAL_SOURCES = [
  "American College of Sports Medicine (2009). Position Stand: Progression Models in Resistance Training for Healthy Adults. Med Sci Sports Exerc 41(3).",
  "Schoenfeld, Ogborn & Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Medicine 46(11).",
  "Schoenfeld, Ogborn & Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11).",
  "Schoenfeld, Grgic, Van Every & Plotkin (2021). Loading recommendations for muscle strength, hypertrophy, and local endurance. Sports 9(2).",
];

const BASE_PRINCIPLES = [
  "Progressieve overbelasting: jij bepaalt wanneer gewicht of herhalingen omhoog gaan.",
  "Elke spiergroep ongeveer twee keer per week, met minstens een dag herstel ertussen.",
  "Compoundoefeningen eerst, isolatie daarna.",
  "Zonder spotter: zware sets niet tot falen, 1–3 herhalingen in reserve.",
];

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: "fullbody-3",
    name: "Full Body — 3 dagen",
    category: "standard",
    daysPerWeek: 3,
    recommendedLevel: "Beginner tot gevorderd",
    description:
      "Drie verschillende full-bodytrainingen (A, B, C), bijvoorbeeld maandag, woensdag en vrijdag. Elke training raakt benen, borst, rug, schouders, armen en core.",
    principles: [
      ...BASE_PRINCIPLES,
      "Afwisseling in bewegingspatronen (squat, heupscharnier, duwen, trekken) over A, B en C.",
      "Korte touwspringfinisher voor conditie; valt als eerste weg als de training te lang wordt.",
    ],
    sources: GENERAL_SOURCES,
    goalFit: ["strength", "hypertrophy", "combined"],
    days: [
      {
        key: "a",
        name: "Full Body A",
        focus: "Squat, bankdrukken, roeien",
        weekdays: [0],
        exercises: [
          x("goblet-squat", 3, "main", 1),
          x("bench-press", 3, "main", 1),
          x("one-arm-db-row", 3, "secondary", 1),
          x("db-shoulder-press", 2, "secondary", 2),
          x("db-rdl", 2, "secondary", 2),
          x("db-curl", 2, "accessory", 3),
          x("plank", 2, "core", 2, { durationSec: 40 }),
          JUMP_FINISHER(4, 60),
        ],
      },
      {
        key: "b",
        name: "Full Body B",
        focus: "Heupscharnier, schuin drukken, roeien",
        weekdays: [2],
        exercises: [
          x("barbell-rdl", 3, "main", 1),
          x("db-incline-press", 3, "secondary", 1),
          x("barbell-row", 3, "main", 1),
          x("bulgarian-split-squat", 2, "secondary", 2),
          x("db-lateral-raise", 3, "accessory", 2),
          x("lying-triceps-extension", 2, "accessory", 3),
          x("dead-bug", 2, "core", 3, { reps: [8, 10] }),
        ],
      },
      {
        key: "c",
        name: "Full Body C",
        focus: "Uitvalspas, dumbbell drukken, hip thrust",
        weekdays: [4],
        exercises: [
          x("reverse-lunge", 3, "secondary", 1),
          x("db-bench-press", 3, "main", 1),
          x("hip-thrust", 3, "secondary", 1),
          x("db-bent-over-row", 3, "secondary", 1),
          x("rear-delt-raise", 2, "accessory", 3),
          x("hammer-curl", 2, "accessory", 3),
          x("overhead-db-extension", 2, "accessory", 3),
          x("standing-calf-raise", 2, "accessory", 3),
          x("sit-up", 2, "core", 2, { reps: [12, 20] }),
          JUMP_FINISHER(4, 60),
        ],
      },
    ],
  },
  {
    id: "split-5",
    name: "Vijfdaagse split",
    category: "standard",
    daysPerWeek: 5,
    recommendedLevel: "Gemiddeld tot gevorderd",
    description:
      "Upper, Lower, Push, Pull, Legs. Standaard ma, di, do, vr, za met rust op woensdag en zondag. Elke spiergroep komt twee keer per week aan bod.",
    principles: [
      ...BASE_PRINCIPLES,
      "Upper/Lower aan het begin van de week, Push/Pull/Legs erna: elke spiergroep twee keer per week.",
      "Volume bewust gematigd per training, omdat je vaak traint.",
    ],
    sources: GENERAL_SOURCES,
    goalFit: ["strength", "hypertrophy", "combined"],
    days: [
      {
        key: "upper",
        name: "Upper Body",
        focus: "Borst, rug, schouders, armen",
        weekdays: [0],
        accent: "strength",
        exercises: [
          x("bench-press", 3, "main", 1),
          x("barbell-row", 3, "main", 1),
          x("db-shoulder-press", 2, "secondary", 2),
          x("one-arm-db-row", 2, "secondary", 2),
          x("db-curl", 2, "accessory", 3),
          x("lying-triceps-extension", 2, "accessory", 3),
        ],
      },
      {
        key: "lower",
        name: "Lower Body",
        focus: "Heupscharnier, squat, kuiten, core",
        weekdays: [1],
        accent: "strength",
        exercises: [
          x("barbell-rdl", 3, "main", 1),
          x("goblet-squat", 3, "secondary", 1),
          x("reverse-lunge", 2, "secondary", 2),
          x("standing-calf-raise", 3, "accessory", 3),
          x("plank", 3, "core", 2, { durationSec: 45 }),
        ],
      },
      {
        key: "push",
        name: "Push",
        focus: "Borst, schouders, triceps",
        weekdays: [3],
        accent: "hypertrophy",
        exercises: [
          x("db-incline-press", 3, "main", 1),
          x("db-shoulder-press", 3, "secondary", 1),
          x("db-fly", 2, "accessory", 2),
          x("db-lateral-raise", 3, "accessory", 2),
          x("overhead-db-extension", 2, "accessory", 3),
          x("push-up", 1, "core", 3, { reps: [10, 25] }),
        ],
      },
      {
        key: "pull",
        name: "Pull",
        focus: "Rug, achterkant schouders, biceps",
        weekdays: [4],
        accent: "hypertrophy",
        exercises: [
          x("db-bent-over-row", 3, "main", 1),
          x("one-arm-db-row", 3, "secondary", 1),
          x("db-pullover", 2, "accessory", 2),
          x("reverse-fly", 3, "accessory", 2),
          x("hammer-curl", 2, "accessory", 3),
          x("concentration-curl", 2, "accessory", 3),
        ],
      },
      {
        key: "legs",
        name: "Legs",
        focus: "Eenbenig, billen, hamstrings, conditie",
        weekdays: [5],
        accent: "hypertrophy",
        exercises: [
          x("bulgarian-split-squat", 3, "main", 1),
          x("db-rdl", 3, "secondary", 1),
          x("hip-thrust", 3, "secondary", 2),
          x("standing-calf-raise", 3, "accessory", 3),
          x("dead-bug", 2, "core", 3, { reps: [8, 10] }),
          JUMP_FINISHER(5, 45),
        ],
      },
    ],
  },
  {
    id: "ppl-6",
    name: "Push / Pull / Legs — 6 dagen",
    category: "standard",
    daysPerWeek: 6,
    recommendedLevel: "Gevorderd (veel trainingsdagen, goed herstel nodig)",
    description:
      "Push, Pull, Legs twee keer per week, zondag rust. A-dagen met nadruk op kracht (zwaarder, minder herhalingen), B-dagen op spiermassa (meer herhalingen).",
    principles: [
      ...BASE_PRINCIPLES,
      "A-dagen kracht, B-dagen hypertrofie: afwisseling in belasting binnen de week.",
      "Zes dagen vraagt veel herstel. Slaap je slecht of gaan prestaties achteruit, plan dan een extra rustdag.",
    ],
    sources: GENERAL_SOURCES,
    goalFit: ["strength", "hypertrophy", "combined"],
    days: [
      {
        key: "push-a",
        name: "Push A",
        focus: "Kracht: borst, schouders, triceps",
        weekdays: [0],
        accent: "strength",
        exercises: [
          x("bench-press", 3, "main", 1),
          x("db-shoulder-press", 3, "secondary", 1),
          x("db-incline-press", 2, "secondary", 2),
          x("db-lateral-raise", 3, "accessory", 2),
          x("close-grip-floor-press", 2, "accessory", 3),
        ],
      },
      {
        key: "pull-a",
        name: "Pull A",
        focus: "Kracht: rug en biceps",
        weekdays: [1],
        accent: "strength",
        exercises: [
          x("barbell-row", 3, "main", 1),
          x("one-arm-db-row", 3, "secondary", 1),
          x("db-pullover", 2, "accessory", 2),
          x("rear-delt-raise", 2, "accessory", 3),
          x("barbell-curl", 3, "accessory", 2),
          x("reverse-curl", 2, "accessory", 3),
        ],
      },
      {
        key: "legs-a",
        name: "Legs A",
        focus: "Kracht: heupscharnier en squat",
        weekdays: [2],
        accent: "strength",
        exercises: [
          x("barbell-rdl", 3, "main", 1),
          x("goblet-squat", 3, "secondary", 1),
          x("bulgarian-split-squat", 2, "secondary", 2),
          x("standing-calf-raise", 3, "accessory", 3),
          x("leg-raise", 3, "core", 3, { reps: [10, 15] }),
        ],
      },
      {
        key: "push-b",
        name: "Push B",
        focus: "Spiermassa: borst, schouders, triceps",
        weekdays: [3],
        accent: "hypertrophy",
        exercises: [
          x("db-incline-press", 3, "main", 1),
          x("db-bench-press", 3, "secondary", 1),
          x("db-fly", 2, "accessory", 2),
          x("db-lateral-raise", 3, "accessory", 2),
          x("overhead-db-extension", 2, "accessory", 3),
          x("db-kickback", 2, "accessory", 3),
        ],
      },
      {
        key: "pull-b",
        name: "Pull B",
        focus: "Spiermassa: rug, achterkant schouders, biceps",
        weekdays: [4],
        accent: "hypertrophy",
        exercises: [
          x("db-bent-over-row", 3, "main", 1),
          x("chest-supported-db-row", 2, "secondary", 2),
          x("reverse-fly", 3, "accessory", 2),
          x("db-pullover", 2, "accessory", 3),
          x("hammer-curl", 3, "accessory", 2),
          x("concentration-curl", 2, "accessory", 3),
        ],
      },
      {
        key: "legs-b",
        name: "Legs B",
        focus: "Spiermassa: eenbenig, billen, conditie",
        weekdays: [5],
        accent: "hypertrophy",
        exercises: [
          x("reverse-lunge", 3, "main", 1),
          x("db-rdl", 3, "secondary", 1),
          x("hip-thrust", 3, "secondary", 2),
          x("standing-calf-raise", 3, "accessory", 3),
          x("side-plank", 2, "core", 3, { durationSec: 30 }),
          JUMP_FINISHER(5, 60),
        ],
      },
    ],
  },
  // ── Coachbibliotheek ────────────────────────────────────────────────
  {
    id: "fullbody-2-beginner",
    name: "Full Body voor beginners — 2 dagen",
    category: "library",
    daysPerWeek: 2,
    recommendedLevel: "Beginner",
    description:
      "Twee eenvoudige full-bodytrainingen per week (bv. maandag en donderdag) om techniek en routine op te bouwen.",
    principles: [
      ...BASE_PRINCIPLES,
      "Weinig oefeningen, vaste volgorde: eerst techniek en gewoonte, dan pas meer volume.",
    ],
    sources: GENERAL_SOURCES,
    goalFit: ["combined", "hypertrophy"],
    days: [
      {
        key: "a",
        name: "Beginner A",
        focus: "Squat, drukken, roeien",
        weekdays: [0],
        exercises: [
          x("goblet-squat", 3, "main", 1),
          x("db-bench-press", 3, "main", 1),
          x("one-arm-db-row", 3, "secondary", 1),
          x("glute-bridge", 2, "core", 2, { reps: [12, 15] }),
          x("plank", 2, "core", 2, { durationSec: 30 }),
        ],
      },
      {
        key: "b",
        name: "Beginner B",
        focus: "Heupscharnier, schouders, rug",
        weekdays: [3],
        exercises: [
          x("db-rdl", 3, "main", 1),
          x("db-shoulder-press", 3, "secondary", 1),
          x("db-bent-over-row", 3, "secondary", 1),
          x("reverse-lunge", 2, "secondary", 2),
          x("dead-bug", 2, "core", 2, { reps: [6, 8] }),
        ],
      },
    ],
  },
  {
    id: "upper-lower-4",
    name: "Upper/Lower — 4 dagen",
    category: "library",
    daysPerWeek: 4,
    recommendedLevel: "Gemiddeld",
    description:
      "Twee bovenlichaam- en twee onderlichaamtrainingen per week (ma, di, do, vr), voor kracht en spiergroei.",
    principles: [
      ...BASE_PRINCIPLES,
      "Dag A met zwaardere basisoefeningen, dag B met meer herhalingen.",
    ],
    sources: GENERAL_SOURCES,
    goalFit: ["strength", "hypertrophy", "combined"],
    days: [
      {
        key: "upper-a",
        name: "Upper A",
        focus: "Kracht bovenlichaam",
        weekdays: [0],
        accent: "strength",
        exercises: [
          x("bench-press", 3, "main", 1),
          x("barbell-row", 3, "main", 1),
          x("db-shoulder-press", 2, "secondary", 2),
          x("db-curl", 2, "accessory", 3),
          x("lying-triceps-extension", 2, "accessory", 3),
        ],
      },
      {
        key: "lower-a",
        name: "Lower A",
        focus: "Kracht onderlichaam",
        weekdays: [1],
        accent: "strength",
        exercises: [
          x("barbell-rdl", 3, "main", 1),
          x("goblet-squat", 3, "secondary", 1),
          x("standing-calf-raise", 3, "accessory", 3),
          x("plank", 3, "core", 2, { durationSec: 45 }),
        ],
      },
      {
        key: "upper-b",
        name: "Upper B",
        focus: "Spiermassa bovenlichaam",
        weekdays: [3],
        accent: "hypertrophy",
        exercises: [
          x("db-incline-press", 3, "main", 1),
          x("one-arm-db-row", 3, "secondary", 1),
          x("db-lateral-raise", 3, "accessory", 2),
          x("rear-delt-raise", 2, "accessory", 3),
          x("hammer-curl", 2, "accessory", 3),
          x("overhead-db-extension", 2, "accessory", 3),
        ],
      },
      {
        key: "lower-b",
        name: "Lower B",
        focus: "Spiermassa onderlichaam en conditie",
        weekdays: [4],
        accent: "hypertrophy",
        exercises: [
          x("bulgarian-split-squat", 3, "main", 1),
          x("hip-thrust", 3, "secondary", 1),
          x("db-rdl", 2, "secondary", 2),
          x("sit-up", 2, "core", 3, { reps: [12, 20] }),
          JUMP_FINISHER(5, 45),
        ],
      },
    ],
  },
];

export function programTemplate(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find((t) => t.id === id);
}
