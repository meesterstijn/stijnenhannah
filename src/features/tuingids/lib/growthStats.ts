import type { LogEntry } from "../types";

export type GrowthPoint = { date: string; height: number };

/** Consistent Dutch decimal formatting (comma separator, max 1 decimal) for cm values. */
export function formatMeasurement(n: number): string {
  return n.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/** Readable "18 cm lang en 4 cm breed" / "5,5 cm breed" description, or null if nothing to show. */
export function formatFruitSize(length: number | null, width: number | null): string | null {
  const parts: string[] = [];
  if (length !== null) parts.push(`${formatMeasurement(length)} cm lang`);
  if (width !== null) parts.push(`${formatMeasurement(width)} cm breed`);
  return parts.length > 0 ? parts.join(" en ") : null;
}

/** Plant names that have at least one height measurement, sorted alphabetically. */
export function getPlantNamesWithGrowth(entries: LogEntry[]): string[] {
  const names = new Set<string>();
  for (const e of entries) {
    if (e.height_cm !== null) names.add(e.plant_name);
  }
  return [...names].sort();
}

/** Chronological height measurements for one plant, derived from the existing growth log. */
export function getGrowthSeries(entries: LogEntry[], plantName: string): GrowthPoint[] {
  return entries
    .filter((e) => e.plant_name === plantName && e.height_cm !== null)
    .map((e) => ({ date: e.date, height: e.height_cm as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Same series, indexed from the first measurement (always 0 cm) — computed on the fly, never stored. */
export function toRelativeSeries(series: GrowthPoint[]): GrowthPoint[] {
  if (series.length === 0) return [];
  const baseline = series[0].height;
  return series.map((p) => ({ date: p.date, height: p.height - baseline }));
}

export type GrowthStats = {
  current: number;
  totalGrowth: number;
  avgPerDay: number;
  biggestSpurt: { from: string; to: string; delta: number } | null;
};

export function computeGrowthStats(series: GrowthPoint[]): GrowthStats | null {
  if (series.length === 0) return null;

  const first = series[0];
  const last = series[series.length - 1];
  const totalGrowth = last.height - first.height;
  const days = Math.max(
    1,
    Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000),
  );
  const avgPerDay = series.length > 1 ? totalGrowth / days : 0;

  let biggestSpurt: GrowthStats["biggestSpurt"] = null;
  for (let i = 1; i < series.length; i++) {
    const delta = series[i].height - series[i - 1].height;
    if (!biggestSpurt || delta > biggestSpurt.delta) {
      biggestSpurt = { from: series[i - 1].date, to: series[i].date, delta };
    }
  }

  return { current: last.height, totalGrowth, avgPerDay, biggestSpurt };
}

// ─── Fruit/vegetable size (separate from plant-height calculations above) ──
// These never feed into the height series/stats functions and vice versa —
// keeps the existing height growth chart unaffected by fruit measurements.

export type FruitMeasurement = { date: string; length: number | null; width: number | null; note: string | null };

/** Plant names that have at least one fruit-size measurement, sorted alphabetically. */
export function getPlantNamesWithFruitData(entries: LogEntry[]): string[] {
  const names = new Set<string>();
  for (const e of entries) {
    if (e.fruit_length_cm !== null || e.fruit_width_cm !== null) names.add(e.plant_name);
  }
  return [...names].sort();
}

/** Chronological fruit-size measurements for one plant. */
export function getFruitMeasurements(entries: LogEntry[], plantName: string): FruitMeasurement[] {
  return entries
    .filter((e) => e.plant_name === plantName && (e.fruit_length_cm !== null || e.fruit_width_cm !== null))
    .map((e) => ({ date: e.date, length: e.fruit_length_cm, width: e.fruit_width_cm, note: e.notes || null }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
