import type { CocktailFlavourProfile } from "@/features/cocktail-bar/types";

export type FlavourBadgeCode = "sweet" | "sour" | "bitter" | "fresh" | "strong";

export type FlavourBadge = {
  code: FlavourBadgeCode;
  label: string;
  score: number;
};

const FLAVOUR_LABELS: Record<FlavourBadgeCode, string> = {
  sweet: "Zoet",
  sour: "Zuur",
  bitter: "Bitter",
  fresh: "Fris",
  strong: "Sterk",
};

// Drempel voor "toon deze badge" — score >= 4 op een schaal van 0-5. Dit is
// de ENIGE plek in de hele Cocktail Bar-feature die smaakscores omzet naar
// tonbare labels; niets elders (kaarten, filters, detailvenster, dashboard-
// gemiddelden) mag zelf opnieuw "Zoet"/"Fris"/"Sterk" als tekst bepalen of
// opslaan — dat zou precies de dubbele-smaaklabels zijn die het datamodel
// bewust vermijdt door alleen 0-5 scores op te slaan.
const BADGE_THRESHOLD = 4;

export function deriveFlavourBadges(profile: Pick<
  CocktailFlavourProfile,
  "sweet_score" | "sour_score" | "bitter_score" | "fresh_score" | "strong_score"
> | null): FlavourBadge[] {
  if (!profile) return [];
  const scores: { code: FlavourBadgeCode; score: number }[] = [
    { code: "sweet", score: profile.sweet_score },
    { code: "sour", score: profile.sour_score },
    { code: "bitter", score: profile.bitter_score },
    { code: "fresh", score: profile.fresh_score },
    { code: "strong", score: profile.strong_score },
  ];
  return scores
    .filter((s) => s.score >= BADGE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ code: s.code, label: FLAVOUR_LABELS[s.code], score: s.score }));
}

export function flavourBadgeLabel(code: FlavourBadgeCode): string {
  return FLAVOUR_LABELS[code];
}
