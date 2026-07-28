// `r6_score_rules.color` is een vaste, semantische token (geen vrije hex) —
// zo blijft elke tegel gegarandeerd leesbaar/consistent op het donkere
// live-dashboard, ongeacht wat een gebruiker in de instellingen invult.
// Onbekende/lege tokens vallen terug op 'zinc'.
const TILE_COLOR_CLASSES: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/25",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400 active:bg-amber-500/25",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-400 active:bg-sky-500/25",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-400 active:bg-violet-500/25",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-400 active:bg-rose-500/25",
  zinc: "border-zinc-700 bg-zinc-900 text-zinc-300 active:bg-zinc-800",
};

export const TILE_COLOR_TOKENS = Object.keys(TILE_COLOR_CLASSES);

export function tileColorClasses(color: string | null): string {
  return TILE_COLOR_CLASSES[color ?? ""] ?? TILE_COLOR_CLASSES.zinc;
}

// Alleen voor de daadwerkelijke live tik-tegels (R6PlayerActionTiles) —
// het tactische R6-ontwerp wil geen "vrolijke", volledig gekleurde tegels
// meer; de gekozen kleur wordt daar nog uitsluitend als dunne linker
// accentrand gebruikt (zelfde herkenbaarheid, zonder de tegel zelf drukker
// te maken). De volledige kleurbadge (tileColorClasses hierboven) blijft
// wél gebruikt in de instellingen-UI, waar je juist wílt zien welke kleur
// je kiest.
const TILE_ACCENT_BORDER_CLASSES: Record<string, string> = {
  emerald: "border-l-emerald-500",
  amber: "border-l-amber-500",
  sky: "border-l-sky-500",
  violet: "border-l-violet-500",
  rose: "border-l-rose-500",
  zinc: "border-l-zinc-700",
};

export function tileAccentBorderClass(color: string | null): string {
  return TILE_ACCENT_BORDER_CLASSES[color ?? ""] ?? TILE_ACCENT_BORDER_CLASSES.zinc;
}
