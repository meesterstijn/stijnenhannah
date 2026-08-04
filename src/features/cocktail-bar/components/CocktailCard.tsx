import { Heart, Martini } from "lucide-react";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import { getPrimaryVariant } from "@/features/cocktail-bar/lib/cocktails";
import { useRevealOnScroll } from "@/features/cocktail-bar/hooks/useRevealOnScroll";
import { useScrollCenterProximity } from "@/features/cocktail-bar/hooks/useScrollCenterProximity";
import { CocktailFlavourBadge } from "@/features/cocktail-bar/components/CocktailFlavourBadge";
import type { CocktailFull } from "@/features/cocktail-bar/types";

// onSelect is optioneel: zolang er nog geen detailvenster is (fase 3) is de
// kaart puur decoratief, zonder klikstate/cursor-affordance te faken die nog
// niets doet. Zelfde voor isFavorite/onToggleFavorite: alleen het hartje
// tonen als de aanroeper favorieten daadwerkelijk beheert.
//
// scrollReveal is bewust opt-in en alleen door CocktailBarTablet.tsx gebruikt:
// op een touchscreen bestaat er geen hover, dus de group-hover-foto-beweging
// hieronder doet daar niets. Met scrollReveal beweegt/verduidelijkt de foto
// zich in plaats daarvan op basis van scrollpositie (hoe dichter bij het
// midden van het scherm, hoe zichtbaarder/groter) — de showcase-pagina (géén
// scrollReveal) blijft precies zoals 'ie was, puur CSS hover.
export function CocktailCard({
  cocktail,
  onSelect,
  isFavorite,
  onToggleFavorite,
  scrollReveal = false,
}: {
  cocktail: CocktailFull;
  onSelect?: (cocktail: CocktailFull) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (cocktailId: string) => void;
  scrollReveal?: boolean;
}) {
  const { ref, isVisible } = useRevealOnScroll<HTMLDivElement>();
  const { ref: proximityRef, proximity } =
    useScrollCenterProximity<HTMLDivElement>(scrollReveal);
  const primaryVariant = getPrimaryVariant(cocktail);
  const badges = deriveFlavourBadges(primaryVariant?.flavour_profile ?? null);
  const photoPath =
    primaryVariant?.photo_storage_path ?? cocktail.photo_storage_path;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const spiritLabel =
    primaryVariant?.variant_type === "alcohol_free"
      ? "Alcoholvrij"
      : (primaryVariant?.spirit?.name ?? null);
  const clickable = !!onSelect;

  const imageWrapperStyle = scrollReveal
    ? {
        opacity: 0.35 + proximity * 0.65,
        transform: `translate3d(0, ${(1 - proximity) * 18}px, 0) scale(${1 + proximity * 0.1})`,
      }
    : undefined;

  return (
    <div
      ref={ref}
      className={`cb-tile group flex flex-col transition-all duration-700 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${clickable ? "cursor-pointer" : ""}`}
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
      <div
        ref={scrollReveal ? proximityRef : undefined}
        className="relative flex h-48 w-full items-center justify-center p-4 sm:h-56"
        style={imageWrapperStyle}
      >
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(cocktail.id);
            }}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-[var(--cb-gold)] transition-colors hover:bg-[oklch(0.75_0.15_60_/_0.15)]"
            aria-label={
              isFavorite
                ? `${cocktail.name} uit favorieten verwijderen`
                : `${cocktail.name} toevoegen aan favorieten`
            }
            aria-pressed={!!isFavorite}
          >
            <Heart
              className="h-5 w-5"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}
        <div className="cb-product-glow absolute inset-6 rounded-full blur-2xl" />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={cocktail.name}
            loading="lazy"
            className="relative h-full w-full object-contain transition-transform duration-700 group-hover:-translate-y-3 group-hover:scale-110"
          />
        ) : (
          <Martini
            className="relative h-16 w-16 text-[var(--cb-gold)] opacity-50"
            strokeWidth={1.2}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <h3 className="cb-heading font-serif text-2xl">{cocktail.name}</h3>
        <p className="cb-muted text-sm">{cocktail.tagline}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {spiritLabel && <span className="cb-badge">{spiritLabel}</span>}
          {badges.map((b) => (
            <CocktailFlavourBadge key={b.code} badge={b} />
          ))}
        </div>
      </div>
    </div>
  );
}
