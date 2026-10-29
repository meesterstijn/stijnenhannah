import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPMENT } from "./defaults";
import { calculatePlates, plateRequestFor, smallestStep } from "./plates";

const plates = DEFAULT_EQUIPMENT.plates; // 3×10, 6×5, 8×2, 4×1

describe("schijvencalculator", () => {
  it("rekent een stang met beide kanten gelijk", () => {
    const r = calculatePlates({
      targetKg: 60,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(r.exact).toBe(true);
    expect(r.perSideKg).toBe(20);
    expect(r.options[0]).toEqual([
      { weightKg: 10, perSide: 1 },
      { weightKg: 5, perSide: 2 },
    ]);
    // Meerdere verdelingen als die bestaan
    expect(r.options.length).toBeGreaterThan(1);
  });

  it("gebruikt de derde schijf van 10 kg niet (alleen in paren)", () => {
    const r = calculatePlates({
      targetKg: 60,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    for (const combo of r.options) {
      const tens = combo.find((p) => p.weightKg === 10)?.perSide ?? 0;
      expect(tens).toBeLessThanOrEqual(1);
    }
  });

  it("telt sluitingen mee", () => {
    const r = calculatePlates({
      targetKg: 61,
      barKg: 20,
      collarKg: 0.5,
      implements: 1,
      plates,
    });
    expect(r.perSideKg).toBe(20);
    expect(r.exact).toBe(true);
  });

  it("meldt niet-exact haalbare gewichten met dichtstbijzijnde alternatieven", () => {
    const r = calculatePlates({
      targetKg: 61,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(r.exact).toBe(false);
    expect(r.options).toEqual([]);
    expect(r.nearestBelow?.totalKg).toBe(60);
    expect(r.nearestAbove?.totalKg).toBe(62);
    expect(r.warnings[0]).toMatch(/niet exact/);
  });

  it("kan niet meer laden dan de voorraad", () => {
    // Max per kant: 10 + 3×5 + 4×2 + 2×1 = 35 kg → 20 + 70 = 90
    const max = calculatePlates({
      targetKg: 90,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(max.exact).toBe(true);
    const over = calculatePlates({
      targetKg: 92,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(over.exact).toBe(false);
    expect(over.nearestBelow?.totalKg).toBe(90);
    expect(over.nearestAbove).toBeNull();
  });

  it("rekent dumbbellgewicht per dumbbell en laadt twee dumbbells tegelijk", () => {
    // Per dumbbell 2 + 2×(5+2+1) = 18. Vier kanten: 4×5 ≤ 6, 4×2 ≤ 8, 4×1 ≤ 4.
    const r = calculatePlates({
      targetKg: 18,
      barKg: 2,
      collarKg: 0,
      implements: 2,
      plates,
    });
    expect(r.exact).toBe(true);
    expect(r.perSideKg).toBe(8);
    // 10 kg-schijven kunnen niet op twee dumbbells (3 < 4)
    for (const combo of r.options)
      expect(combo.some((p) => p.weightKg === 10)).toBe(false);
  });

  it("meldt als het met één dumbbell wel kan maar met twee niet", () => {
    const r = calculatePlates({
      targetKg: 24,
      barKg: 2,
      collarKg: 0,
      implements: 2,
      plates,
    });
    expect(r.exact).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/één dumbbell/);
    const single = calculatePlates({
      targetKg: 24,
      barKg: 2,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(single.exact).toBe(true);
  });

  it("weigert een gewicht onder de lege stang", () => {
    const r = calculatePlates({
      targetKg: 15,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(r.exact).toBe(false);
    expect(r.warnings[0]).toMatch(/lege stang/);
    expect(r.nearestAbove?.totalKg).toBe(20);
  });

  it("geeft een lege stang als geldige verdeling", () => {
    const r = calculatePlates({
      targetKg: 20,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
    });
    expect(r.exact).toBe(true);
    expect(r.options[0]).toEqual([]);
  });

  it("rekent decimale schijven exact", () => {
    const r = calculatePlates({
      targetKg: 22.5,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates: [{ weightKg: 1.25, count: 2 }],
    });
    expect(r.exact).toBe(true);
    expect(r.perSideKg).toBe(1.25);
  });

  it("waarschuwt bij overschrijden van de belastbaarheid", () => {
    const r = calculatePlates({
      targetKg: 60,
      barKg: 20,
      collarKg: 0,
      implements: 1,
      plates,
      maxLoadKg: 30,
    });
    expect(r.warnings.join(" ")).toMatch(/belastbaarheid/);
  });

  it("vraagt om het stanggewicht als dat onbekend is", () => {
    expect(plateRequestFor("barbell", 40, DEFAULT_EQUIPMENT)).toBeNull();
    const eq = {
      ...DEFAULT_EQUIPMENT,
      barbell: { owned: true, weightKg: 15, maxLoadKg: null },
    };
    expect(plateRequestFor("barbell", 40, eq)?.barKg).toBe(15);
  });

  it("kleinste stap is twee keer de kleinste schijf", () => {
    expect(smallestStep(plates, "barbell")).toBe(2);
    expect(smallestStep(plates, "dumbbell_pair")).toBe(2);
    expect(smallestStep([{ weightKg: 1.25, count: 2 }], "barbell")).toBe(2.5);
  });
});
