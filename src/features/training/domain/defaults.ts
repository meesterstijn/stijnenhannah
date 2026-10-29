import type { EquipmentConfig, Profile, TrainingSettings } from "./types";

export const DEFAULT_SETTINGS: TrainingSettings = {
  level: "intermediate",
  goal: "combined",
  daysPerWeek: 3,
  sessionMinutes: 60,
  activeProgramId: null,
  historyScope: "any",
  progressionHints: true,
  sound: true,
  vibrate: true,
  notifications: false,
  keepAwake: true,
  appearance: "light",
  paletteId: "standaard",
  palettes: [],
  showE1rm: true,
};

// De opgegeven thuisinventaris. Stanggewichten zijn nog onbekend (null):
// de app vraagt erom zodra het nodig is en verzint niets.
export const DEFAULT_EQUIPMENT: EquipmentConfig = {
  barbell: { owned: true, weightKg: null, maxLoadKg: null },
  dumbbells: { count: 2, handleWeightKg: null, maxLoadKg: null },
  collars: { weightKg: 0, useOnBarbell: false, useOnDumbbells: false },
  plates: [
    { weightKg: 10, count: 3 },
    { weightKg: 5, count: 6 },
    { weightKg: 2, count: 8 },
    { weightKg: 1, count: 4 },
  ],
  owned: ["barbell", "dumbbell", "bench", "plates", "jump_rope", "bodyweight"],
};

export function defaultProfile(userId: string, now: string): Profile {
  return {
    id: userId,
    userId,
    settings: { ...DEFAULT_SETTINGS },
    equipment: structuredClone(DEFAULT_EQUIPMENT),
    exercisePrefs: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 0,
  };
}

// Oudere/onvolledige profielen (bv. van een vorige appversie) aanvullen
// met de standaardwaarden, zonder bestaande keuzes te overschrijven.
export function normalizeProfile(profile: Profile): Profile {
  const equipment = profile.equipment ?? DEFAULT_EQUIPMENT;
  return {
    ...profile,
    settings: { ...DEFAULT_SETTINGS, ...(profile.settings ?? {}) },
    equipment: {
      barbell: { ...DEFAULT_EQUIPMENT.barbell, ...(equipment.barbell ?? {}) },
      dumbbells: {
        ...DEFAULT_EQUIPMENT.dumbbells,
        ...(equipment.dumbbells ?? {}),
      },
      collars: { ...DEFAULT_EQUIPMENT.collars, ...(equipment.collars ?? {}) },
      plates: Array.isArray(equipment.plates)
        ? equipment.plates
        : DEFAULT_EQUIPMENT.plates,
      owned: Array.isArray(equipment.owned)
        ? equipment.owned
        : DEFAULT_EQUIPMENT.owned,
    },
    exercisePrefs: profile.exercisePrefs ?? {},
  };
}
