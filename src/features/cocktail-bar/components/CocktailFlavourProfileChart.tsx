import { flavourBadgeLabel, type FlavourBadgeCode } from "@/features/cocktail-bar/lib/flavourBadges";
import type { CocktailFlavourProfile } from "@/features/cocktail-bar/types";

const AXES: { code: FlavourBadgeCode; scoreKey: keyof CocktailFlavourProfile }[] = [
  { code: "sweet", scoreKey: "sweet_score" },
  { code: "sour", scoreKey: "sour_score" },
  { code: "bitter", scoreKey: "bitter_score" },
  { code: "fresh", scoreKey: "fresh_score" },
  { code: "strong", scoreKey: "strong_score" },
];

// Labels komen uit flavourBadgeLabel() — dezelfde functie die ook de badges
// op de kaarten benoemt — zodat er nergens een tweede "Zoet"/"Fris"/"Sterk"-
// tekstbron ontstaat. Puur CSS-balkjes, geen chart-bibliotheek nodig voor 5
// simpele 0-5-waarden.
export function CocktailFlavourProfileChart({ profile }: { profile: CocktailFlavourProfile | null }) {
  if (!profile) return null;

  return (
    <div className="space-y-2">
      {AXES.map((axis) => {
        const score = profile[axis.scoreKey] as number;
        return (
          <div key={axis.code} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs cb-muted">{flavourBadgeLabel(axis.code)}</span>
            <div className="h-1.5 flex-1 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--cb-amber)] transition-[width] duration-700"
                style={{ width: `${(score / 5) * 100}%` }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-xs cb-muted">{score}</span>
          </div>
        );
      })}
    </div>
  );
}
