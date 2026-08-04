import { Martini } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import { CocktailFlavourBadge } from "@/features/cocktail-bar/components/CocktailFlavourBadge";
import { CocktailIngredientList } from "@/features/cocktail-bar/components/CocktailIngredientList";
import type {
  CocktailFull,
  CocktailOrder,
  CocktailVariantFull,
} from "@/features/cocktail-bar/types";

// cocktail/variant zijn undefined zolang de showcasedata nog laadt — in dat
// korte venster toont dit scherm alleen gastnaam + placeholder i.p.v. te
// crashen (zelfde afweging als CocktailBarQueueCard).
export function CocktailBigScreenBrewing({
  order,
  cocktail,
  variant,
}: {
  order: CocktailOrder;
  cocktail: CocktailFull | undefined;
  variant: CocktailVariantFull | undefined;
}) {
  const photoPath =
    variant?.photo_storage_path ?? cocktail?.photo_storage_path ?? null;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const badges = deriveFlavourBadges(variant?.flavour_profile ?? null);
  const spiritLabel =
    variant?.variant_type === "alcohol_free"
      ? "Alcoholvrij"
      : (variant?.spirit?.name ?? null);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 py-10 text-center">
      <p className="cb-bigscreen-enter cb-muted text-xl uppercase tracking-widest">
        Wordt nu bereid
      </p>
      <p className="cb-bigscreen-enter cb-bigscreen-enter-delay-1 cb-heading font-serif text-3xl sm:text-4xl">
        {order.guest_name}
      </p>

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

      <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-2 space-y-2">
        <h2 className="cb-heading font-serif text-4xl sm:text-5xl">
          {cocktail?.name ?? "Cocktail"}
        </h2>
        {cocktail?.tagline && (
          <p className="cb-muted mx-auto max-w-xl text-lg">
            {cocktail.tagline}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {spiritLabel && (
            <span className="cb-badge text-base">{spiritLabel}</span>
          )}
          {badges.map((b) => (
            <CocktailFlavourBadge key={b.code} badge={b} showScore />
          ))}
        </div>
      </div>

      {variant && variant.ingredients.length > 0 && (
        <div className="cb-bigscreen-enter cb-bigscreen-enter-delay-2 w-full max-w-md">
          <CocktailIngredientList ingredients={variant.ingredients} />
        </div>
      )}

      {order.note && (
        <p className="cb-bigscreen-enter cb-muted max-w-md text-base italic">
          &ldquo;{order.note}&rdquo;
        </p>
      )}
    </div>
  );
}
