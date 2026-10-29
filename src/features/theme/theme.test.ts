import { describe, expect, it } from "vitest";
import {
  ALL_THEME_VAR_NAMES,
  ORIGINAL_SELECTION,
  composeTheme,
  matchingPreset,
  presetSelection,
} from "./composer";
import { THEME_STYLES } from "./presets";
import { parseCustomPresets, parseSelection } from "./storage";
import {
  ORIGINAL,
  THEME_CATEGORIES,
  THEME_STYLE_IDS,
  isThemeExcludedPath,
} from "./tokens";

describe("presets", () => {
  it("levert per categorie exact dezelfde tokens als elke andere stijl", () => {
    const reference = THEME_STYLES.minimal;
    for (const id of THEME_STYLE_IDS) {
      const style = THEME_STYLES[id];
      for (const category of THEME_CATEGORIES) {
        expect(
          Object.keys(style[category].vars).sort(),
          `${id}.${category}`,
        ).toEqual(Object.keys(reference[category].vars).sort());
      }
      expect(Object.keys(style.colors.shadcn).sort()).toEqual(
        Object.keys(reference.colors.shadcn).sort(),
      );
    }
  });

  it("bevat alleen bladwaarden, zodat categorieën los combineerbaar zijn", () => {
    for (const style of Object.values(THEME_STYLES)) {
      for (const category of THEME_CATEGORIES) {
        for (const [name, value] of Object.entries(style[category].vars)) {
          expect(value, `${style.id} ${name}`).not.toMatch(/var\(/);
        }
      }
    }
  });

  it("gebruikt de nummers uit de referentieafbeelding", () => {
    expect(Object.values(THEME_STYLES).map((s) => s.number)).toEqual([
      1, 2, 4, 5, 6, 7,
    ]);
  });
});

describe("composeTheme", () => {
  it("zet niets voor Origineel", () => {
    expect(composeTheme(ORIGINAL_SELECTION)).toEqual({
      vars: {},
      attrs: {},
      fonts: [],
    });
  });

  it("zet bij een volledige preset alle categorieën", () => {
    const theme = composeTheme(presetSelection("retro"));
    expect(theme.attrs).toMatchObject({
      "data-ht": "on",
      "data-ht-colors": "retro",
      "data-ht-type": "retro",
      "data-ht-cards": "retro",
      "data-ht-bg": "retro",
      "data-ht-icons": "retro",
      "data-ht-nav": "retro",
      "data-ht-fx": "retro",
      "data-ht-scheme": "light",
    });
    expect(theme.vars["--background"]).toBe(
      THEME_STYLES.retro.colors.shadcn["--background"],
    );
    expect(theme.fonts).toEqual([THEME_STYLES.retro.typography.fontUrl]);
  });

  it("wijzigt bij één categorie uitsluitend die categorie", () => {
    const theme = composeTheme({ ...ORIGINAL_SELECTION, cards: "glass" });
    expect(theme.attrs).toEqual({ "data-ht": "on", "data-ht-cards": "glass" });
    const cardKeys = Object.keys(THEME_STYLES.glass.cards.vars);
    const set = Object.keys(theme.vars).filter(
      (k) => !k.startsWith("--ht-veil"),
    );
    expect(set.sort()).toEqual(cardKeys.sort());
  });

  it("combineert categorieën uit verschillende stijlen", () => {
    const theme = composeTheme({
      colors: "dark",
      typography: "retro",
      cards: "glass",
      background: "minimal",
      icons: "mono",
      navigation: "neon",
      effects: "minimal",
    });
    expect(theme.vars["--ht-accent"]).toBe(
      THEME_STYLES.dark.colors.vars["--ht-accent"],
    );
    expect(theme.vars["--ht-font-heading"]).toBe(
      THEME_STYLES.retro.typography.vars["--ht-font-heading"],
    );
    expect(theme.vars["--ht-card-alpha"]).toBe("40%");
    expect(theme.vars["--ht-nav-glow"]).toBe(
      THEME_STYLES.neon.navigation.vars["--ht-nav-glow"],
    );
    expect(theme.vars["--ht-icon-stroke"]).toBe("1.4");
    expect(matchingPreset({ ...presetSelection("dark"), cards: "glass" })).toBe(
      null,
    );
  });

  it("legt een sluier over een achtergrond die niet bij de tekst past", () => {
    // Donkere tekstkleuren op lichte achtergrond: sluier in paginakleur.
    const mixed = composeTheme({
      ...ORIGINAL_SELECTION,
      colors: "dark",
      background: "minimal",
    });
    expect(mixed.vars["--ht-veil-page"]).toContain(
      THEME_STYLES.dark.colors.vars["--ht-page"],
    );
    expect(mixed.vars["--ht-veil-home"]).toContain(
      THEME_STYLES.dark.colors.vars["--ht-page"],
    );

    // Passende combinatie: geen sluier.
    const matching = composeTheme(presetSelection("dark"));
    expect(matching.vars["--ht-veil-page"]).toBe("transparent");
    expect(matching.vars["--ht-veil-home"]).toBe("transparent");

    // Originele (witte) dashboardtekst op een lichte achtergrond.
    const homeOnly = composeTheme({
      ...ORIGINAL_SELECTION,
      background: "retro",
    });
    expect(homeOnly.vars["--ht-veil-home"]).not.toBe("transparent");
    expect(homeOnly.vars["--ht-veil-page"]).toBe("transparent");
  });

  it("kent elke tokennaam die het kan zetten", () => {
    for (const id of THEME_STYLE_IDS) {
      for (const name of Object.keys(composeTheme(presetSelection(id)).vars)) {
        expect(ALL_THEME_VAR_NAMES.has(name), name).toBe(true);
      }
    }
  });

  it("herkent volledige presets en Origineel", () => {
    expect(matchingPreset(ORIGINAL_SELECTION)).toBe(ORIGINAL);
    expect(matchingPreset(presetSelection("neon"))).toBe("neon");
  });
});

describe("storage-validatie", () => {
  it("valt per categorie terug op origineel", () => {
    expect(parseSelection(null)).toEqual(ORIGINAL_SELECTION);
    expect(parseSelection("kapot")).toEqual(ORIGINAL_SELECTION);
    expect(
      parseSelection({ colors: "neon", cards: "bestaat-niet", icons: 3 }),
    ).toEqual({ ...ORIGINAL_SELECTION, colors: "neon" });
  });

  it("negeert ongeldige eigen presets", () => {
    const presets = parseCustomPresets([
      { id: "a", name: "Avond", selection: presetSelection("glass") },
      { id: "b", name: "   " },
      { name: "zonder id" },
      "onzin",
    ]);
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ id: "a", name: "Avond" });
    expect(presets[0].selection).toEqual(presetSelection("glass"));
    expect(parseCustomPresets({})).toEqual([]);
  });
});

describe("uitgesloten modules", () => {
  it("laat modules met een eigen vormgeving ongemoeid", () => {
    expect(isThemeExcludedPath("/gitaar")).toBe(true);
    expect(isThemeExcludedPath("/schietsport/logboek")).toBe(true);
    expect(isThemeExcludedPath("/tuinieren")).toBe(true);
    expect(isThemeExcludedPath("/")).toBe(false);
    expect(isThemeExcludedPath("/boodschappen")).toBe(false);
    expect(isThemeExcludedPath("/gitaarles")).toBe(false);
  });
});
