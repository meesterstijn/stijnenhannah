import type { EquipmentKind, MuscleGroup, SessionStatus } from "./types";

// Gewichten rekenen we in hele grammen: 0,1 + 0,2 blijft zo exact 0,3 en
// sommen van schijven kloppen altijd. In de database staat numeric(6,2).

export const toGrams = (kg: number): number => Math.round(kg * 1000);
export const fromGrams = (g: number): number => Math.round(g / 10) / 100;

// Afronden op 0,01 kg (de precisie van de database).
export const roundKg = (kg: number): number => Math.round(kg * 100) / 100;

export function addKg(a: number, b: number): number {
  return fromGrams(toGrams(a) + toGrams(b));
}

const kgFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 1,
});

export function formatKg(kg: number | null | undefined): string {
  return kg === null || kg === undefined ? "–" : kgFormat.format(kg);
}

export function formatNumber(value: number, decimals = 1): string {
  return decimals === 1
    ? oneDecimal.format(value)
    : new Intl.NumberFormat("nl-NL", {
        maximumFractionDigits: decimals,
      }).format(value);
}

// "1:30" of "45 s"
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined) return "–";
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
}

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.ceil(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// Komma of punt als decimaalteken; ongeldig = null.
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (cleaned === "" || !/^\d*(\.\d*)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Borst",
  back: "Rug",
  shoulders: "Schouders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quadriceps",
  hamstrings: "Hamstrings",
  glutes: "Bilspieren",
  calves: "Kuiten",
  core: "Buik/core",
  forearms: "Onderarmen",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Lange halterstang",
  dumbbell: "Dumbbells",
  bench: "Halterbank",
  bodyweight: "Lichaamsgewicht",
  jump_rope: "Springtouw",
  plates: "Gewichtsschijven",
};

export function equipmentLabel(kind: EquipmentKind): string {
  return EQUIPMENT_LABELS[kind] ?? kind;
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  planned: "Gepland",
  active: "Bezig",
  paused: "Onderbroken",
  completed: "Voltooid",
  cancelled: "Geannuleerd",
  skipped: "Overgeslagen",
};

export const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const WEEKDAY_LONG = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];
