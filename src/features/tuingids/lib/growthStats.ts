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

// Identity for grouping/labeling entries in the comparison chart below:
// plant_instance_id when the entry is linked to a concrete instance, else
// the plant_name itself (legacy/unlinked rows only). Two different
// instances that happen to share a display name (e.g. both left at the
// bare species name, no custom_name set) must never be merged into one
// series — grouping by name alone would silently combine their
// measurements into a single, wrong line.
function identityKey(e: LogEntry): string {
  return e.plant_instance_id ?? `legacy:${e.plant_name}`;
}

/** One display label per identity key, disambiguated with "(2)", "(3)", ...
 * whenever multiple different identities share the same plant_name. Pure
 * function of `entries` so every caller derives the same labels
 * independently without needing to share state. */
function buildLabelByIdentity(entries: LogEntry[]): Map<string, string> {
  const keysByName = new Map<string, string[]>();
  for (const e of entries) {
    const key = identityKey(e);
    const list = keysByName.get(e.plant_name) ?? [];
    if (!list.includes(key)) list.push(key);
    keysByName.set(e.plant_name, list);
  }
  const labelByKey = new Map<string, string>();
  for (const [name, keys] of keysByName) {
    if (keys.length === 1) {
      labelByKey.set(keys[0], name);
    } else {
      keys.forEach((key, i) => labelByKey.set(key, `${name} (${i + 1})`));
    }
  }
  return labelByKey;
}

/** Plant labels that have at least one height measurement, sorted alphabetically. */
export function getPlantNamesWithGrowth(entries: LogEntry[]): string[] {
  const labelByKey = buildLabelByIdentity(entries);
  const keys = new Set<string>();
  for (const e of entries) {
    if (e.height_cm !== null) keys.add(identityKey(e));
  }
  return [...keys].map((k) => labelByKey.get(k)!).sort();
}

/** Chronological height measurements for one plant label, derived from the existing growth log. */
export function getGrowthSeries(entries: LogEntry[], plantName: string): GrowthPoint[] {
  const labelByKey = buildLabelByIdentity(entries);
  return entries
    .filter((e) => labelByKey.get(identityKey(e)) === plantName && e.height_cm !== null)
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

/** Plant labels that have at least one fruit-size measurement, sorted alphabetically. */
export function getPlantNamesWithFruitData(entries: LogEntry[]): string[] {
  const labelByKey = buildLabelByIdentity(entries);
  const keys = new Set<string>();
  for (const e of entries) {
    if (e.fruit_length_cm !== null || e.fruit_width_cm !== null) keys.add(identityKey(e));
  }
  return [...keys].map((k) => labelByKey.get(k)!).sort();
}

/** Chronological fruit-size measurements for one plant label. */
export function getFruitMeasurements(entries: LogEntry[], plantName: string): FruitMeasurement[] {
  const labelByKey = buildLabelByIdentity(entries);
  return entries
    .filter((e) => labelByKey.get(identityKey(e)) === plantName && (e.fruit_length_cm !== null || e.fruit_width_cm !== null))
    .map((e) => ({ date: e.date, length: e.fruit_length_cm, width: e.fruit_width_cm, note: e.notes || null }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Per-season comparison (growing_season_id-scoped) ──────────────────────
// All inputs must already be filtered to the one season being summarized —
// this function only aggregates, it never filters by plant/instance itself.
// Fields are `null` (rendered as "Nog niet geregistreerd"/"Niet beschikbaar"
// by the caller) rather than 0 whenever nothing was ever recorded, so an
// empty season never looks like a zero-growth season.

export type SeasonStats = {
  maxHeightCm: number | null;
  growthPerWeekCm: number | null;
  totalHarvestWeightGrams: number | null;
  harvestCount: number;
  avgFruitLengthCm: number | null;
  avgFruitWidthCm: number | null;
  durationDays: number;
  waterCount: number;
  feedingCount: number;
};

export function computeSeasonStats(input: {
  startedAt: string;
  endedAt: string | null;
  growthEntries: LogEntry[];
  harvestWeights: (number | null)[];
  fruitMeasurements: { length: number | null; width: number | null }[];
}): SeasonStats {
  const heights = input.growthEntries
    .filter((e) => e.height_cm !== null)
    .map((e) => ({ date: e.date, height: e.height_cm as number }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxHeightCm = heights.length > 0 ? Math.max(...heights.map((h) => h.height)) : null;

  let growthPerWeekCm: number | null = null;
  if (heights.length >= 2) {
    const first = heights[0];
    const last = heights[heights.length - 1];
    const days = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
    growthPerWeekCm = ((last.height - first.height) / days) * 7;
  }

  const harvestWeights = input.harvestWeights.filter((w): w is number => w !== null);
  const totalHarvestWeightGrams = harvestWeights.length > 0 ? harvestWeights.reduce((a, b) => a + b, 0) : null;

  const lengths = input.fruitMeasurements.map((m) => m.length).filter((n): n is number => n !== null);
  const widths = input.fruitMeasurements.map((m) => m.width).filter((n): n is number => n !== null);
  const avgFruitLengthCm = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
  const avgFruitWidthCm = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : null;

  const durationDays = Math.max(
    0,
    Math.round(((input.endedAt ? new Date(input.endedAt) : new Date()).getTime() - new Date(input.startedAt).getTime()) / 86400000),
  );

  return {
    maxHeightCm,
    growthPerWeekCm,
    totalHarvestWeightGrams,
    harvestCount: input.harvestWeights.length,
    avgFruitLengthCm,
    avgFruitWidthCm,
    durationDays,
    waterCount: input.growthEntries.filter((e) => e.watered).length,
    feedingCount: input.growthEntries.filter((e) => e.fertilized).length,
  };
}
