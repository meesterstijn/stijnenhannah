import { ORIGINAL_SELECTION, type ComposedTheme } from "./composer";
import {
  ORIGINAL,
  THEME_CATEGORIES,
  THEME_EXCLUDED_PREFIXES,
  THEME_STYLE_IDS,
  type ThemeChoice,
  type ThemeSelection,
} from "./tokens";

// Eigen sleutels, los van alle bestaande opslag. De laatst gekozen combinatie
// en de eigen presets staan bewust apart: een preset verwijderen raakt het
// actieve thema niet, en andersom.
export const THEME_STORAGE_KEYS = {
  selection: "onshuisje.theme.selection.v1",
  customPresets: "onshuisje.theme.custom-presets.v1",
  // Kant-en-klaar samengestelde tokens voor het inline script in index.html,
  // zodat het thema er al staat vóór React laadt (geen flits van het
  // verkeerde thema). Pure afgeleide van `selection`.
  applied: "onshuisje.theme.applied.v1",
} as const;

export interface CustomThemePreset {
  id: string;
  name: string;
  selection: ThemeSelection;
  createdAt: string;
}

const VALID_CHOICES = new Set<string>([ORIGINAL, ...THEME_STYLE_IDS]);

function isChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && VALID_CHOICES.has(value);
}

// Onbekende of ontbrekende categorieën vallen per stuk terug op origineel,
// zodat een half kapotte of oudere opgeslagen waarde nooit de rest wegvaagt.
export function parseSelection(value: unknown): ThemeSelection {
  const selection: ThemeSelection = { ...ORIGINAL_SELECTION };
  if (!value || typeof value !== "object") return selection;
  const record = value as Record<string, unknown>;
  for (const category of THEME_CATEGORIES) {
    if (isChoice(record[category])) selection[category] = record[category];
  }
  return selection;
}

export function parseCustomPresets(value: unknown): CustomThemePreset[] {
  if (!Array.isArray(value)) return [];
  const presets: CustomThemePreset[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { id, name, selection, createdAt } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || !name.trim())
      continue;
    presets.push({
      id,
      name: name.trim().slice(0, 40),
      selection: parseSelection(selection),
      createdAt: typeof createdAt === "string" ? createdAt : "",
    });
  }
  return presets;
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Opslag vol of geblokkeerd (privévenster): het thema werkt dan alleen
    // voor deze sessie.
  }
}

export function loadSelection(): ThemeSelection {
  return parseSelection(readJson(THEME_STORAGE_KEYS.selection));
}

export function saveSelection(selection: ThemeSelection) {
  writeJson(THEME_STORAGE_KEYS.selection, selection);
}

export function loadCustomPresets(): CustomThemePreset[] {
  return parseCustomPresets(readJson(THEME_STORAGE_KEYS.customPresets));
}

export function saveCustomPresets(presets: CustomThemePreset[]) {
  writeJson(THEME_STORAGE_KEYS.customPresets, presets);
}

export function saveAppliedCache(theme: ComposedTheme) {
  if (!theme.attrs["data-ht"]) {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEYS.applied);
    } catch {
      // zie writeJson
    }
    return;
  }
  writeJson(THEME_STORAGE_KEYS.applied, {
    v: 1,
    ...theme,
    excluded: THEME_EXCLUDED_PREFIXES,
  });
}
