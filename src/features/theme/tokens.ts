// Ons Huisje-themasysteem — gedeelde types en categorie-indeling.
//
// Een thema is geen losse "skin" maar een combinatie van zeven onafhankelijke
// categorieën. Elke stijl (1, 2, 4, 5, 6, 7 uit de referentieafbeelding)
// levert voor elke categorie een eigen set CSS custom properties; de composer
// (composer.ts) plakt de gekozen sets per categorie aan elkaar. Componenten
// lezen uitsluitend de semantische --ht-*-tokens (en de bestaande shadcn-
// tokens zoals --background/--card), nooit een presetnaam.
//
// "origineel" betekent per categorie: zet niets — elke CSS-regel in
// theme.css valt dan via var(--ht-x, <oude waarde>) terug op de bestaande
// styling. Staat alles op origineel, dan krijgt <html> geen enkel attribuut
// of token en is de site exact zoals vóór het themasysteem.

export const THEME_CATEGORIES = [
  "colors",
  "typography",
  "cards",
  "background",
  "icons",
  "navigation",
  "effects",
] as const;

export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

export const THEME_STYLE_IDS = [
  "minimal",
  "dark",
  "glass",
  "retro",
  "neon",
  "mono",
] as const;

export type ThemeStyleId = (typeof THEME_STYLE_IDS)[number];

export const ORIGINAL = "origineel" as const;

export type ThemeChoice = ThemeStyleId | typeof ORIGINAL;

export type ThemeSelection = Record<ThemeCategory, ThemeChoice>;

export const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  colors: "Kleuren",
  typography: "Lettertype",
  cards: "Kaarten",
  background: "Achtergrond",
  icons: "Iconen",
  navigation: "Navigatie",
  effects: "Effecten",
};

// Korte attribuutnaam per categorie op <html> (data-ht-<attr>="<stijl>"),
// waar theme.css zijn regels aan ophangt.
export const CATEGORY_ATTRS: Record<ThemeCategory, string> = {
  colors: "data-ht-colors",
  typography: "data-ht-type",
  cards: "data-ht-cards",
  background: "data-ht-bg",
  icons: "data-ht-icons",
  navigation: "data-ht-nav",
  effects: "data-ht-fx",
};

export type CssVars = Record<`--${string}`, string>;

export type ColorScheme = "light" | "dark";

export interface PaletteTokens {
  scheme: ColorScheme;
  // Eigen --ht-*-tokens (dashboard, navigatie, iconen, achtergrondsluier).
  vars: CssVars;
  // De bestaande shadcn/Tailwind-tokens (--background, --card, --primary,
  // ...) zodat élke bestaande component op de contentpagina's meekleurt.
  shadcn: CssVars;
}

export interface TypographyTokens {
  vars: CssVars;
  // Google Fonts-stylesheet; wordt pas geladen zodra deze typografie actief
  // is (nooit alle themafonts tegelijk).
  fontUrl?: string;
}

export interface BackgroundTokens {
  // Toon van de achtergrond zelf. Wijkt die af van het kleurenschema van de
  // tekst, dan legt de composer er een sluier in de paginakleur overheen
  // zodat losse tekst (begroeting, koppen) leesbaar blijft.
  tone: ColorScheme;
  vars: CssVars;
}

export interface ThemeStyle {
  id: ThemeStyleId;
  // Nummer in de referentieafbeelding (1, 2, 4, 5, 6, 7).
  number: number;
  name: string;
  description: string;
  colors: PaletteTokens;
  typography: TypographyTokens;
  cards: { vars: CssVars };
  background: BackgroundTokens;
  icons: { vars: CssVars };
  navigation: { vars: CssVars };
  effects: { vars: CssVars };
}

// Modules met een eigen, bewust afwijkende visuele identiteit (en eigen
// scoped tokens/achtergronden in styles.css). Daar blijft de site altijd in
// zijn oorspronkelijke vorm; het gekozen thema geldt weer zodra je terug
// bent op een algemene pagina.
export const THEME_EXCLUDED_PREFIXES = [
  "/rainbow-six-siege",
  "/cocktail-bar",
  "/gitaar",
  "/game-night",
  "/schietsport",
  "/training",
  "/tuinieren",
  "/tuingids",
] as const;

export function isThemeExcludedPath(pathname: string): boolean {
  return THEME_EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
