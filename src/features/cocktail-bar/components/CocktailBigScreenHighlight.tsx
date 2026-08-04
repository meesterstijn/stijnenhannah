import { Martini } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import { getPrimaryVariant } from "@/features/cocktail-bar/lib/cocktails";
import { CocktailFlavourBadge } from "@/features/cocktail-bar/components/CocktailFlavourBadge";
import { CocktailFlavourProfileChart } from "@/features/cocktail-bar/components/CocktailFlavourProfileChart";
import { CocktailIngredientList } from "@/features/cocktail-bar/components/CocktailIngredientList";
import type {
  CocktailFull,
  CocktailHighlight,
} from "@/features/cocktail-bar/types";

// Toont MINDER dan de presenter-view van de owner
// (CocktailHighlightPresenterView) — alleen een korte introductieregel uit
// het verhaal, nooit de volledige tekst (die leest de owner zelf voor bij de
// gast, zie plan §5). Geen aparte alcoholisch/alcoholvrij-keuze hier: net als
// op de kaarten toont dit de representatieve variant (getPrimaryVariant).
export function CocktailBigScreenHighlight({
  highlight,
  cocktail,
}: {
  highlight: CocktailHighlight;
  cocktail: CocktailFull | null;
}) {
  const variant = cocktail ? getPrimaryVariant(cocktail) : null;
  const photoPath =
    variant?.photo_storage_path ?? cocktail?.photo_storage_path ?? null;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const badges = deriveFlavourBadges(variant?.flavour_profile ?? null);
  const introLine = highlight.story.split(/\n/)[0].split(/(?<=[.!?])\s+/)[0];

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 py-10 text-center">
      <p className="cb-bigscreen-enter cb-muted text-xl uppercase tracking-widest">
        {highlight.guest_name}
      </p>
      <h1 className="cb-bigscreen-enter cb-bigscreen-enter-delay-1 cb-heading font-serif text-4xl sm:text-6xl">
        {highlight.title}
      </h1>
      {highlight.subtitle && (
        <p className="cb-bigscreen-enter cb-bigscreen-enter-delay-1 cb-muted text-lg italic">
          {highlight.subtitle}
        </p>
      )}

      <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-1 relative flex h-56 w-56 shrink-0 items-center justify-center sm:h-64 sm:w-64">
        <div className="cb-product-glow absolute inset-4 rounded-full blur-3xl" />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={cocktail?.name ?? ""}
            className="relative h-full w-full object-contain"
          />
        ) : (
          <Martini
            className="relative h-24 w-24 text-[var(--cb-gold)] opacity-50"
            strokeWidth={1.2}
          />
        )}
      </div>

      {cocktail && (
        <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-2 space-y-2">
          <h2 className="cb-heading font-serif text-3xl sm:text-4xl">
            {cocktail.name}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {badges.map((b) => (
              <CocktailFlavourBadge key={b.code} badge={b} showScore />
            ))}
          </div>
        </div>
      )}

      {variant && (
        <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-2 w-full max-w-sm">
          <CocktailFlavourProfileChart profile={variant.flavour_profile} />
        </div>
      )}

      {variant && variant.ingredients.length > 0 && (
        <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-2 w-full max-w-md">
          <CocktailIngredientList ingredients={variant.ingredients} />
        </div>
      )}

      {introLine && (
        <p className="cb-bigscreen-enter cb-muted max-w-xl text-lg italic">
          {introLine}
        </p>
      )}
    </div>
  );
}
