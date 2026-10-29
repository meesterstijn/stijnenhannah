import { describe, expect, it } from "vitest";
import { niceScale } from "@/features/schietsport/lib/axis";

describe("nette assen", () => {
  it("ronde stappen binnen de schaal", () => {
    expect(niceScale([271, 290], 300)).toEqual({
      domain: [265, 295],
      ticks: [265, 270, 275, 280, 285, 290, 295],
    });
    const cards = niceScale([44.5, 48.5], 50);
    expect(cards.domain[1]).toBeLessThanOrEqual(50);
    expect(cards.ticks.every((t) => Number.isInteger(t))).toBe(true);
  });

  it("nooit boven het maximum, nooit onder nul, en lege reeks", () => {
    expect(niceScale([299, 300], 300).domain[1]).toBe(300);
    expect(niceScale([0, 3], 50).domain[0]).toBe(0);
    expect(niceScale([], 50)).toEqual({ domain: [0, 50], ticks: [0, 25, 50] });
  });
});
