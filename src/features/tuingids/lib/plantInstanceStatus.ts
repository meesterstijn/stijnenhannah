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

export function isInstanceWaterSkippedToday(instance: PlantInstance): boolean {
  const todayIso = new Date().toISOString().slice(0, 10);
  return !!instance.water_skip_until && todayIso < instance.water_skip_until;
}

/** A dormant/archived/dead/removed instance never shows urgent care status —
 * only an active instance can be "overdue" for water or feeding. */
export function instanceWaterStatus(instance: PlantInstance, species: Plant): { label: string; overdue: boolean } | null {
  if (instance.status !== "active") return null;
  const intervalDays = effectiveInstanceWaterIntervalDays(instance, species);
  if (!intervalDays) return null;
  if (isInstanceWaterSkippedToday(instance)) {
    return { label: "Uitgesteld tot morgen", overdue: false };
  }
  if (!instance.last_watered_at) return { label: "Nog geen water gegeven", overdue: true };
  const dueAt = new Date(instance.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
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
  const dueAt = new Date(instance.last_fed_at).getTime() + species.feeding_interval_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
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
