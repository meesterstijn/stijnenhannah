import { fromGrams, toGrams } from "./units";
import type { EquipmentConfig, LoadMode, PlateStock } from "./types";

// Gewichtsschijvencalculator. Rekent in hele grammen, gebruikt alleen
// schijven die er echt zijn en laadt altijd symmetrisch: elke kant van elke
// stang krijgt exact dezelfde schijven. Bij twee dumbbells tegelijk moet de
// voorraad dus voor vier kanten volstaan.

export type PlateCombo = { weightKg: number; perSide: number }[];

export type PlateRequest = {
  targetKg: number; // totaal (stang) of per dumbbell
  barKg: number;
  collarKg: number; // per sluiting (0 = geen sluitingen meetellen)
  implements: number; // 1 = één stang/dumbbell, 2 = twee dumbbells tegelijk
  plates: PlateStock[];
  maxLoadKg?: number | null; // belastbaarheid per stang (schijven + sluitingen)
};

export type PlateResult = {
  targetKg: number;
  perSideKg: number; // schijven per kant
  exact: boolean;
  options: PlateCombo[]; // exacte verdelingen, minst aantal schijven eerst
  nearestBelow: { totalKg: number; combo: PlateCombo } | null;
  nearestAbove: { totalKg: number; combo: PlateCombo } | null;
  warnings: string[];
};

const MAX_OPTIONS = 4;

type Choice = { grams: number; perSide: number }[];

// Alle mogelijke symmetrische beladingen (per kant), met hun gewicht.
function enumerate(
  plates: PlateStock[],
  sides: number,
): { sideGrams: number; choice: Choice }[] {
  const types = plates
    .filter((p) => p.weightKg > 0 && p.count > 0)
    .map((p) => ({
      grams: toGrams(p.weightKg),
      max: Math.floor(p.count / sides),
    }))
    .filter((p) => p.max > 0)
    .sort((a, b) => b.grams - a.grams);
  // Samenvoegen van gelijke gewichten (bv. twee regels "5 kg").
  const merged: { grams: number; max: number }[] = [];
  for (const t of types) {
    const same = merged.find((m) => m.grams === t.grams);
    if (same) same.max += t.max;
    else merged.push({ ...t });
  }

  const results: { sideGrams: number; choice: Choice }[] = [];
  const walk = (i: number, sum: number, choice: Choice) => {
    if (i === merged.length) {
      results.push({
        sideGrams: sum,
        choice: choice.filter((c) => c.perSide > 0),
      });
      return;
    }
    for (let n = merged[i].max; n >= 0; n--) {
      walk(i + 1, sum + n * merged[i].grams, [
        ...choice,
        { grams: merged[i].grams, perSide: n },
      ]);
      if (results.length > 20000) return; // veiligheidsgrens bij enorme voorraad
    }
  };
  walk(0, 0, []);
  return results;
}

const toCombo = (choice: Choice): PlateCombo =>
  choice.map((c) => ({ weightKg: fromGrams(c.grams), perSide: c.perSide }));

const plateCount = (choice: Choice) =>
  choice.reduce((n, c) => n + c.perSide, 0);

export function calculatePlates(req: PlateRequest): PlateResult {
  const implementsCount = Math.max(1, Math.floor(req.implements));
  const sides = 2 * implementsCount;
  const fixed = toGrams(req.barKg) + 2 * toGrams(req.collarKg);
  const target = toGrams(req.targetKg);
  const needed = target - fixed; // voor beide kanten van één stang
  const warnings: string[] = [];

  const all = enumerate(req.plates, sides);
  const exact =
    needed >= 0 && needed % 2 === 0
      ? all
          .filter((r) => r.sideGrams * 2 === needed)
          .sort((a, b) => plateCount(a.choice) - plateCount(b.choice))
      : [];

  const totals = new Map<number, Choice>();
  for (const r of all) {
    const total = fixed + 2 * r.sideGrams;
    const known = totals.get(total);
    if (!known || plateCount(r.choice) < plateCount(known))
      totals.set(total, r.choice);
  }
  let below: [number, Choice] | null = null;
  let above: [number, Choice] | null = null;
  for (const [total, choice] of totals) {
    if (total < target && (!below || total > below[0])) below = [total, choice];
    if (total > target && (!above || total < above[0])) above = [total, choice];
  }

  if (needed < 0) {
    warnings.push(
      implementsCount > 1 || req.barKg === 0
        ? "Dit gewicht is lager dan de lege dumbbell."
        : "Dit gewicht is lager dan de lege stang.",
    );
  } else if (exact.length === 0) {
    warnings.push("Dit gewicht is met je schijven niet exact te laden.");
  }
  if (implementsCount > 1 && exact.length === 0 && needed >= 0) {
    const single = enumerate(req.plates, 2).some(
      (r) => r.sideGrams * 2 === needed,
    );
    if (single) {
      warnings.push(
        "Met één dumbbell lukt het wel; voor twee dumbbells tegelijk heb je te weinig schijven.",
      );
    }
  }
  if (req.maxLoadKg != null && exact.length > 0) {
    const load = target - toGrams(req.barKg);
    if (load > toGrams(req.maxLoadKg)) {
      warnings.push(
        `Let op: meer dan de opgegeven belastbaarheid van ${fromGrams(toGrams(req.maxLoadKg))} kg.`,
      );
    }
  }

  return {
    targetKg: req.targetKg,
    perSideKg: fromGrams(Math.max(0, needed) / 2),
    exact: exact.length > 0,
    options: exact.slice(0, MAX_OPTIONS).map((r) => toCombo(r.choice)),
    nearestBelow: below
      ? { totalKg: fromGrams(below[0]), combo: toCombo(below[1]) }
      : null,
    nearestAbove: above
      ? { totalKg: fromGrams(above[0]), combo: toCombo(above[1]) }
      : null,
    warnings,
  };
}

// Vertaalt een oefening + apparatuur naar een calculatorverzoek. null als
// het stanggewicht nog onbekend is (dan vraagt de UI erom).
export function plateRequestFor(
  loadMode: LoadMode,
  targetKg: number,
  equipment: EquipmentConfig,
): PlateRequest | null {
  if (loadMode === "barbell") {
    if (equipment.barbell.weightKg === null) return null;
    return {
      targetKg,
      barKg: equipment.barbell.weightKg,
      collarKg: equipment.collars.useOnBarbell ? equipment.collars.weightKg : 0,
      implements: 1,
      plates: equipment.plates,
      maxLoadKg: equipment.barbell.maxLoadKg,
    };
  }
  if (loadMode === "dumbbell_pair" || loadMode === "dumbbell_single") {
    if (equipment.dumbbells.handleWeightKg === null) return null;
    return {
      targetKg,
      barKg: equipment.dumbbells.handleWeightKg,
      collarKg: equipment.collars.useOnDumbbells
        ? equipment.collars.weightKg
        : 0,
      implements:
        loadMode === "dumbbell_pair"
          ? Math.min(2, equipment.dumbbells.count)
          : 1,
      plates: equipment.plates,
      maxLoadKg: equipment.dumbbells.maxLoadKg,
    };
  }
  return null;
}

// Kleinste gewichtsstap die symmetrisch kan (2 × kleinste schijf), voor de
// plus/min-knoppen. Zonder schijven: 1 kg.
export function smallestStep(plates: PlateStock[], loadMode: LoadMode): number {
  const sides = loadMode === "dumbbell_pair" ? 4 : 2;
  const usable = plates.filter((p) => p.weightKg > 0 && p.count >= sides);
  if (loadMode === "none" || usable.length === 0) return 1;
  const smallest = Math.min(...usable.map((p) => toGrams(p.weightKg)));
  return fromGrams(smallest * 2);
}
