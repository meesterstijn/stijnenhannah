import { Martini } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import { getPrimaryVariant } from "@/features/cocktail-bar/lib/cocktails";
import { useRevealOnScroll } from "@/features/cocktail-bar/hooks/useRevealOnScroll";
import type { CocktailFull } from "@/features/cocktail-bar/types";

// onSelect is optioneel: zolang er nog geen detailvenster is (fase 3) is de
// kaart puur decoratief, zonder klikstate/cursor-affordance te faken die nog
// niets doet.
export function CocktailCard({
  cocktail,
  onSelect,
}: {
  cocktail: CocktailFull;
  onSelect?: (cocktail: CocktailFull) => void;
}) {
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>();
  const primaryVariant = getPrimaryVariant(cocktail);
  const badges = deriveFlavourBadges(primaryVariant?.flavour_profile ?? null);
  const photoPath = primaryVariant?.photo_storage_path ?? cocktail.photo_storage_path;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const spiritLabel =
    primaryVariant?.variant_type === "alcohol_free" ? "Alcoholvrij" : primaryVariant?.spirit?.name ?? null;
  const clickable = !!onSelect;

  return (
    <div
      ref={ref}
      className={`cb-tile group flex flex-col transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${clickable ? "cursor-pointer hover:-translate-y-1" : ""}`}
      onClick={() => onSelect?.(cocktail)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(cocktail);
              }
            }
          : undefined
      }
      aria-label={clickable ? `${cocktail.name} — bekijk details` : undefined}
    >
      {/* Vrijstaande productfoto (transparante PNG) op een zachte gloed i.p.v.
          een bijgesneden fotokader — de foto "zweeft" op het donkere vak. */}
      <div className="relative flex h-48 w-full items-center justify-center p-4 sm:h-56">
        <div className="cb-product-glow absolute inset-6 rounded-full blur-2xl" />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={cocktail.name}
            loading="lazy"
            className="relative h-full w-full object-contain transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <Martini className="relative h-16 w-16 text-[var(--cb-gold)] opacity-50" strokeWidth={1.2} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <h3 className="cb-heading font-serif text-2xl">{cocktail.name}</h3>
        <p className="cb-muted text-sm">{cocktail.tagline}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {spiritLabel && <span className="cb-badge">{spiritLabel}</span>}
          {badges.map((b) => (
            <span key={b.code} className="cb-badge">
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
