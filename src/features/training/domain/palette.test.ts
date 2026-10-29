import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  assignRoles,
  contrast,
  ensureContrast,
  paletteTokens,
  parseHex,
} from "./palette";

describe("kleurenpaletten", () => {
  it("geeft het standaardpalet dezelfde rollen als het ontwerp", () => {
    expect(assignRoles(DEFAULT_PALETTE.colors)).toEqual({
      ink: "#222222",
      paper: "#FFFFFF",
      primary: "#84DCC6",
      secondary: "#4B4E6D",
      neutral: "#95A3B3",
    });
  });

  it("rollen hangen niet af van de volgorde van invoer", () => {
    const shuffled = ["#95A3B3", "#84DCC6", "#FFFFFF", "#4B4E6D", "#222222"];
    expect(assignRoles(shuffled)).toEqual(assignRoles(DEFAULT_PALETTE.colors));
  });

  it("leest hexcodes in", () => {
    expect(parseHex("84dcc6")).toBe("#84DCC6");
    expect(parseHex("#fff")).toBe("#FFFFFF");
    expect(parseHex("blauw")).toBeNull();
  });

  it("corrigeert te weinig contrast", () => {
    const fixed = ensureContrast("#95A3B3", "#FFFFFF", 4.5);
    expect(contrast(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  // Ook lastige paletten (pastel, allemaal donker, felle kleuren) moeten
  // leesbaar uitkomen.
  const samples = [
    ["#F7E1D7", "#EDAFB8", "#DEDBD2", "#B0C4B1", "#4A5759"],
    ["#0D1B2A", "#1B263B", "#415A77", "#778DA9", "#E0E1DD"],
    ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93"],
    ["#000000", "#111111", "#222222", "#333333", "#444444"],
    ["#FFFFFF", "#FAFAFA", "#F0F0F0", "#EEEEEE", "#DDDDDD"],
  ];

  for (const colors of samples) {
    for (const scheme of ["light", "dark"] as const) {
      it(`${colors.join(" ")} (${scheme}) blijft leesbaar`, () => {
        const t = paletteTokens(colors, scheme);
        const surface = t["--tr-surface"];
        expect(contrast(t["--tr-ink"], surface)).toBeGreaterThanOrEqual(7);
        expect(contrast(t["--tr-ink-2"], surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["--tr-muted"], surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["--tr-aqua-ink"], surface)).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrast(t["--tr-on-aqua"], t["--tr-aqua"]),
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrast(t["--tr-on-grape"], t["--tr-grape"]),
        ).toBeGreaterThanOrEqual(3);
        for (const value of Object.values(t)) {
          expect(value === "transparent" || /^#[0-9A-F]{6}$/.test(value)).toBe(
            true,
          );
        }
      });
    }
  }
});
