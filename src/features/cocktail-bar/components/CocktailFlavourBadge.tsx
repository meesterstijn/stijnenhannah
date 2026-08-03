import type { FlavourBadge } from "@/features/cocktail-bar/lib/flavourBadges";

// Eén centrale plek voor hoe een smaakbadge eruitziet — CocktailCard en
// CocktailDetailDialog renderen 'm allebei via dit component i.p.v. losse
// <span className="cb-badge">-kopieën, zodat een toekomstige stijlwijziging
// (icoon per smaak, kleurcodering) maar op één plek moet.
export function CocktailFlavourBadge({ badge, showScore }: { badge: FlavourBadge; showScore?: boolean }) {
  return (
    <span className="cb-badge">
      {badge.label}
      {showScore && <span className="opacity-60">· {badge.score}/5</span>}
    </span>
  );
}
