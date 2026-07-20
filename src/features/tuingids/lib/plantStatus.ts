import type { Plant } from "@/lib/supabase";

// Single source of truth for "is this plant due for water/feeding" — reused by
// the Tuinieren page (badges, filters, sorting) and the Tuingids dashboard /
// "Mijn tuin" widgets, so a skipped-today plant or a pot-specific interval is
// never treated as overdue in one place and not in another.

export const MONTH_OPTIONS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

export function effectiveWaterIntervalDays(p: Plant): number | null {
  if (p.growing_method === "Pot" && p.pot_water_interval_days) {
    return p.pot_water_interval_days;
  }
  return p.water_interval_days;
}

export function isWaterSkippedToday(p: Plant): boolean {
  const todayIso = new Date().toISOString().slice(0, 10);
  return !!p.water_skip_until && todayIso < p.water_skip_until;
}

export function waterStatus(p: Plant): { label: string; overdue: boolean } | null {
  if (!p.planted) return null;
  const intervalDays = effectiveWaterIntervalDays(p);
  if (!intervalDays) return null;
  if (isWaterSkippedToday(p)) {
    return { label: "Uitgesteld tot morgen", overdue: false };
  }
  if (!p.last_watered_at) return { label: "Nog geen water gegeven", overdue: true };
  const dueAt = new Date(p.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return { label: "Water geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen water geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

export function feedingStatus(p: Plant): { label: string; overdue: boolean } | null {
  if (!p.planted) return null;
  if (!p.feeding_interval_days) return null;
  if (p.feeding_months.length > 0) {
    const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
    if (!p.feeding_months.includes(currentMonth)) return null;
  }
  if (!p.last_fed_at) return { label: "Nog geen voeding gegeven", overdue: true };
  const dueAt = new Date(p.last_fed_at).getTime() + p.feeding_interval_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return { label: "Voeding geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen voeding geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}
