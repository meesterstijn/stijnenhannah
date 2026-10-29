// Eigen kleurenpaletten voor de trainingsmodule. Een palet is precies vijf
// kleuren; de app bepaalt zelf welke kleur welke rol krijgt en corrigeert
// het contrast, zodat elk palet leesbaar blijft:
//
//   ink       donkerste kleur            → tekst (licht) / oppervlak (donker)
//   paper     lichtste kleur             → achtergrond (licht) / tekst (donker)
//   primary   meest kleurrijke van de rest → hoofdactie (setknop, start)
//   secondary daarna meest kleurrijke     → secundaire knoppen, actieve tabs
//   neutral   minst kleurrijke            → iconen, randen, kleine tekst
//
// Contrastregels (WCAG): hoofdtekst ≥ 7:1, kleine/secundaire tekst en
// gekleurde tekst ≥ 4,5:1, grafieklijnen ≥ 3:1. Tekst op een knop wordt
// donker of wit, wat het best leesbaar is.

export type PaletteColors = [string, string, string, string, string];

export type Palette = { id: string; name: string; colors: PaletteColors };

export const DEFAULT_PALETTE_ID = "standaard";

// Het standaardpalet: Carbon Black, White, Dusty Grape, Pearl Aqua, Cool
// Steel. Dit gebruikt de vaste waarden uit training.css (niet berekend).
export const DEFAULT_PALETTE: Palette = {
  id: DEFAULT_PALETTE_ID,
  name: "Standaard",
  colors: ["#222222", "#FFFFFF", "#4B4E6D", "#84DCC6", "#95A3B3"],
};

export type Roles = {
  ink: string;
  paper: string;
  primary: string;
  secondary: string;
  neutral: string;
};

type RGB = [number, number, number];

export function parseHex(input: string): string | null {
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${hex.toUpperCase()}`;
}

const toRgb = (hex: string): RGB => {
  const h = parseHex(hex) ?? "#000000";
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

const toHex = ([r, g, b]: RGB) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Kleurrijkheid (chroma in RGB-termen, 0–1).
export function chroma(hex: string): number {
  const rgb = toRgb(hex);
  return (Math.max(...rgb) - Math.min(...rgb)) / 255;
}

// a gemengd met b; t = 0 → a, 1 → b.
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}

// Schuift een kleur stapsgewijs naar zwart of wit (wat het contrast
// vergroot) tot het doelcontrast met de achtergrond gehaald is.
export function ensureContrast(
  color: string,
  background: string,
  target: number,
): string {
  if (contrast(color, background) >= target) return color;
  const towards = luminance(background) > 0.18 ? "#000000" : "#FFFFFF";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const candidate = mix(color, towards, t);
    if (contrast(candidate, background) >= target) return candidate;
  }
  return towards;
}

// Donkere of witte tekst op een gekleurde ondergrond, wat het best leest.
export function textOn(background: string, dark: string): string {
  const darkText = ensureContrast(dark, background, 4.5);
  return contrast("#FFFFFF", background) >= contrast(darkText, background)
    ? "#FFFFFF"
    : darkText;
}

export function assignRoles(colors: string[]): Roles {
  const list = colors.map((c) => parseHex(c) ?? "#808080");
  const byLum = [...list].sort((a, b) => luminance(a) - luminance(b));
  const ink = byLum[0];
  const paper = byLum[byLum.length - 1];
  const rest = [...list];
  rest.splice(rest.indexOf(ink), 1);
  rest.splice(rest.indexOf(paper), 1);
  // Meest kleurrijk = hoofdactie; bij gelijke kleurrijkheid de lichtste
  // (een lichte, frisse knop met donkere tekst springt het meest in het oog).
  const byChroma = [...rest].sort(
    (a, b) => chroma(b) - chroma(a) || luminance(b) - luminance(a),
  );
  const primary = byChroma[0];
  const [secondary, neutral] = byChroma
    .slice(1)
    .sort((a, b) => chroma(b) - chroma(a) || luminance(a) - luminance(b));
  return { ink, paper, primary, secondary, neutral };
}

export type PaletteTokens = Record<`--tr-${string}`, string>;

export function paletteTokens(
  colors: string[],
  scheme: "light" | "dark",
): PaletteTokens {
  const r = assignRoles(colors);
  if (scheme === "light") {
    const surface = r.paper;
    const ink = ensureContrast(r.ink, surface, 7);
    return {
      "--tr-bg": mix(surface, ink, 0.04),
      "--tr-surface": surface,
      "--tr-surface-2": mix(surface, ink, 0.06),
      "--tr-ink": ink,
      "--tr-ink-2": ensureContrast(mix(ink, surface, 0.2), surface, 7),
      "--tr-muted": ensureContrast(r.neutral, surface, 4.5),
      "--tr-steel": r.neutral,
      "--tr-border": mix(surface, r.neutral, 0.22),
      "--tr-border-strong": mix(surface, r.neutral, 0.4),
      "--tr-aqua": r.primary,
      "--tr-aqua-hover": mix(r.primary, ink, 0.1),
      "--tr-aqua-soft": mix(surface, r.primary, 0.14),
      "--tr-aqua-ink": ensureContrast(r.primary, surface, 4.5),
      "--tr-on-aqua": textOn(r.primary, ink),
      "--tr-grape": r.secondary,
      "--tr-grape-hover": mix(r.secondary, ink, 0.15),
      "--tr-grape-soft": mix(surface, r.secondary, 0.1),
      "--tr-on-grape": textOn(r.secondary, ink),
      "--tr-chart-1": ensureContrast(r.primary, surface, 3),
      "--tr-chart-2": ensureContrast(r.secondary, surface, 3),
      "--tr-chart-3": ensureContrast(r.neutral, surface, 3),
      "--tr-glow": mix(surface, r.primary, 0.45),
    };
  }
  // Donker: dezelfde vijf kleuren, andere rollen voor oppervlak en tekst.
  const surface = luminance(r.ink) < 0.03 ? r.ink : mix(r.ink, "#000000", 0.6);
  const text = ensureContrast(r.paper, surface, 7);
  const secondary = ensureContrast(r.secondary, surface, 1.8);
  const primary = ensureContrast(r.primary, surface, 3);
  return {
    "--tr-bg": mix(surface, "#000000", 0.35),
    "--tr-surface": surface,
    "--tr-surface-2": mix(surface, text, 0.07),
    "--tr-ink": text,
    "--tr-ink-2": ensureContrast(mix(text, surface, 0.18), surface, 7),
    "--tr-muted": ensureContrast(r.neutral, surface, 4.5),
    "--tr-steel": r.neutral,
    "--tr-border": mix(surface, text, 0.12),
    "--tr-border-strong": mix(surface, text, 0.22),
    "--tr-aqua": primary,
    "--tr-aqua-hover": mix(primary, "#FFFFFF", 0.12),
    "--tr-aqua-soft": mix(surface, primary, 0.15),
    "--tr-aqua-ink": ensureContrast(primary, surface, 4.5),
    "--tr-on-aqua": textOn(primary, surface),
    "--tr-grape": secondary,
    "--tr-grape-hover": mix(secondary, "#FFFFFF", 0.1),
    "--tr-grape-soft": mix(surface, r.neutral, 0.16),
    "--tr-on-grape": textOn(secondary, surface),
    "--tr-chart-1": primary,
    "--tr-chart-2": ensureContrast(r.secondary, surface, 3),
    "--tr-chart-3": ensureContrast(r.neutral, surface, 3),
    "--tr-glow": "transparent",
  };
}

export const ROLE_LABELS: Record<keyof Roles, string> = {
  ink: "Tekst",
  paper: "Achtergrond",
  primary: "Hoofdactie",
  secondary: "Secundair",
  neutral: "Details",
};
