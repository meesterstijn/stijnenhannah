import type { Plant, PlantInstance } from "@/lib/supabase";
import { MONTH_OPTIONS } from "./plantStatus";

// Instance-aware counterpart of plantStatus.ts. Water/feeding urgency is
// computed from the INSTANCE's own last_watered_at/last_fed_at/status
// combined with the SPECIES' general advice (interval days, feeding
// months) — never from `plants.last_watered_at`/`plants.planted`, which
// stay legacy fields for the old species-level UI only (see plantStatus.ts).

export function effectiveInstanceWaterIntervalDays(instance: PlantInstance, species: Plant): number | null {
  if (instance.cultivation_type === "pot" && species.pot_water_interval_days) {
    return species.pot_water_interval_days;
  }
  return species.water_interval_days;
}

// Returns the local calendar date as "YYYY-MM-DD" without UTC conversion.
// Using toISOString().slice(0,10) would give the UTC date which can be the
// previous calendar day for timezones east of UTC (e.g. CET/CEST +1/+2).
function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Normalises a Date to local midnight so all comparisons are day-granular.
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Whole-day difference between two dates. Math.round absorbs the ±1 h drift
// that DST transitions can introduce when adding exact milliseconds.
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function isInstanceWaterSkippedToday(instance: PlantInstance): boolean {
  const todayLocal = localDateIso(new Date());
  return !!instance.water_skip_until && todayLocal < instance.water_skip_until;
}

/** A dormant/archived/dead/removed instance never shows urgent care status —
 * only an active instance can be "overdue" for water or feeding. */
export function instanceWaterStatus(instance: PlantInstance, species: Plant): { label: string; overdue: boolean } | null {
  if (instance.status !== "active") return null;
  // Zaailingen altijd dagelijks water, ongeacht de soortinstellingen.
  const intervalDays = instance.health_status === "Zaailing"
    ? 1
    : effectiveInstanceWaterIntervalDays(instance, species);
  if (!intervalDays) return null;
  if (isInstanceWaterSkippedToday(instance)) {
    return { label: "Uitgesteld tot morgen", overdue: false };
  }
  if (!instance.last_watered_at) return { label: "Nog geen water gegeven", overdue: true };
  const lastWateredDay = startOfDay(new Date(instance.last_watered_at));
  const dueDay = new Date(lastWateredDay);
  dueDay.setDate(dueDay.getDate() + intervalDays);
  const today = startOfDay(new Date());
  const daysLeft = daysBetween(today, dueDay);
  if (daysLeft <= 0) return { label: "Water geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen water geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

export function instanceFeedingStatus(instance: PlantInstance, species: Plant): { label: string; overdue: boolean } | null {
  if (instance.status !== "active") return null;
  if (!species.feeding_interval_days) return null;
  if (species.feeding_months.length > 0) {
    const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
    if (!species.feeding_months.includes(currentMonth)) return null;
  }
  if (!instance.last_fed_at) return { label: "Nog geen voeding gegeven", overdue: true };
  const lastFedDay = startOfDay(new Date(instance.last_fed_at));
  const dueDay = new Date(lastFedDay);
  dueDay.setDate(dueDay.getDate() + species.feeding_interval_days);
  const today = startOfDay(new Date());
  const daysLeft = daysBetween(today, dueDay);
  if (daysLeft <= 0) return { label: "Voeding geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen voeding geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

export const INSTANCE_STATUS_LABELS: Record<PlantInstance["status"], string> = {
  active: "Actief",
  dormant: "In rust",
  archived: "Gearchiveerd",
  dead: "Afgestorven",
  removed: "Verwijderd",
};

// Moved here from Tuinieren.tsx (single source of truth) so it can be
// reused outside that page-level file too, e.g. by QuickGrowthPhotoDialog,
// without a circular import back into the page component.
export const HEALTH_STATUS_EMOJI: Record<string, string> = {
  Zaailing: "🌿",
  "Net geplant": "🌱",
  Gezond: "💚",
  "In bloei": "🌼",
  Vruchten: "🍓",
  Stress: "⚠️",
  Ziek: "🤒",
  Afgestorven: "☠️",
};
