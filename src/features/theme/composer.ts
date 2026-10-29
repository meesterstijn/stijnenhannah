import { THEME_STYLES } from "./presets";
import {
  CATEGORY_ATTRS,
  ORIGINAL,
  THEME_CATEGORIES,
  type ColorScheme,
  type CssVars,
  type ThemeSelection,
  type ThemeStyleId,
} from "./tokens";

export interface ComposedTheme {
  // CSS custom properties voor <html style="...">.
  vars: CssVars;
  // data-ht-*-attributen voor <html>; leeg = volledig origineel.
  attrs: Record<string, string>;
  // Stylesheets (webfonts) die voor deze combinatie nodig zijn.
  fonts: string[];
}

export const ORIGINAL_SELECTION: ThemeSelection = Object.freeze({
  colors: ORIGINAL,
  typography: ORIGINAL,
  cards: ORIGINAL,
  background: ORIGINAL,
  icons: ORIGINAL,
  navigation: ORIGINAL,
  effects: ORIGINAL,
});

export function presetSelection(id: ThemeStyleId): ThemeSelection {
  const selection = {} as ThemeSelection;
  for (const category of THEME_CATEGORIES) selection[category] = id;
  return selection;
}

export function isOriginalSelection(selection: ThemeSelection): boolean {
  return THEME_CATEGORIES.every((c) => selection[c] === ORIGINAL);
}

// Welke volledige preset (indien een) exact overeenkomt met deze selectie.
export function matchingPreset(
  selection: ThemeSelection,
): ThemeStyleId | typeof ORIGINAL | null {
  if (isOriginalSelection(selection)) return ORIGINAL;
  const first = selection.colors;
  if (first === ORIGINAL) return null;
  return THEME_CATEGORIES.every((c) => selection[c] === first) ? first : null;
}

// Oorspronkelijke kleuren waartegen de sluier wordt afgezet als de kleuren-
// categorie op "origineel" staat: de lichte paginakleur van :root
// (contentpagina's) en de donkere fotoschaduw van de homepage.
const ORIGINAL_PAGE_VEIL = "oklch(0.975 0.018 75 / 0.84)";
const ORIGINAL_HOME_VEIL = "oklch(0.14 0.01 60 / 0.58)";
const NO_VEIL = "transparent";

function veil(color: string, amount: number): string {
  return `color-mix(in oklab, ${color} ${amount}%, transparent)`;
}

export function composeTheme(selection: ThemeSelection): ComposedTheme {
  const vars: CssVars = {};
  const attrs: Record<string, string> = {};
  const fonts: string[] = [];

  if (isOriginalSelection(selection)) return { vars, attrs, fonts };
  attrs["data-ht"] = "on";

  for (const category of THEME_CATEGORIES) {
    const choice = selection[category];
    if (choice === ORIGINAL) continue;
    const style = THEME_STYLES[choice];
    attrs[CATEGORY_ATTRS[category]] = choice;
    Object.assign(vars, style[category].vars);
    if (category === "colors") Object.assign(vars, style.colors.shadcn);
    if (category === "typography" && style.typography.fontUrl)
      fonts.push(style.typography.fontUrl);
  }

  // Conflicthantering tussen kleur en achtergrond: losse tekst staat direct
  // op de achtergrond. Heeft de achtergrond een andere toon dan het
  // tekstschema, dan komt er een sluier in de paginakleur tussen.
  // Contentpagina's zijn oorspronkelijk licht, de homepage donker (foto).
  const palette =
    selection.colors === ORIGINAL ? null : THEME_STYLES[selection.colors];
  const background =
    selection.background === ORIGINAL
      ? null
      : THEME_STYLES[selection.background].background;

  const pageScheme: ColorScheme = palette?.colors.scheme ?? "light";
  const homeScheme: ColorScheme = palette?.colors.scheme ?? "dark";
  const pageTone: ColorScheme = background?.tone ?? pageScheme;
  const homeTone: ColorScheme = background?.tone ?? "dark";
  const pageColor = palette?.colors.vars["--ht-page"];

  vars["--ht-veil-page"] =
    pageTone === pageScheme
      ? NO_VEIL
      : pageColor
        ? veil(pageColor, 84)
        : ORIGINAL_PAGE_VEIL;
  vars["--ht-veil-home"] =
    homeTone === homeScheme
      ? NO_VEIL
      : pageColor
        ? veil(pageColor, homeScheme === "light" ? 80 : 62)
        : ORIGINAL_HOME_VEIL;

  if (palette) attrs["data-ht-scheme"] = palette.colors.scheme;

  return { vars, attrs, fonts };
}

// Alle tokennamen die het systeem ooit op <html> kan zetten — nodig om bij
// wisselen precies die (en alleen die) weer weg te halen.
export const ALL_THEME_VAR_NAMES: ReadonlySet<string> = (() => {
  const names = new Set<string>(["--ht-veil-page", "--ht-veil-home"]);
  for (const style of Object.values(THEME_STYLES)) {
    for (const category of THEME_CATEGORIES) {
      for (const name of Object.keys(style[category].vars)) names.add(name);
    }
    for (const name of Object.keys(style.colors.shadcn)) names.add(name);
  }
  return names;
})();

export const ALL_THEME_ATTRS: readonly string[] = [
  "data-ht",
  "data-ht-scheme",
  ...Object.values(CATEGORY_ATTRS),
];
