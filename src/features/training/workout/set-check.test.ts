import { describe, expect, it } from "vitest";
import { countsReps, repChoices } from "./set-check";

describe("repChoices", () => {
  it("4 lager tot 2 hoger dan het doel", () => {
    expect(repChoices(10)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("nooit onder 1", () => {
    expect(repChoices(3)).toEqual([1, 2, 3, 4, 5]);
    expect(repChoices(1)).toEqual([1, 2, 3]);
  });

  it("geen doel: geen rij (dan via Anders…)", () => {
    expect(repChoices(null)).toEqual([]);
    expect(repChoices(0)).toEqual([]);
  });

  it("alleen bij herhalingen", () => {
    expect(countsReps("weight_reps")).toBe(true);
    expect(countsReps("bodyweight_reps")).toBe(true);
    expect(countsReps("duration")).toBe(false);
    expect(countsReps("jump_rope")).toBe(false);
  });
});
