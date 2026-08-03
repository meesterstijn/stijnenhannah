import { useMemo, useState } from "react";
import { getPrimaryVariant } from "@/features/cocktail-bar/lib/cocktails";
import { deriveFlavourBadges, type FlavourBadgeCode } from "@/features/cocktail-bar/lib/flavourBadges";
import type { CocktailFull } from "@/features/cocktail-bar/types";

export type CocktailSortOption = "name" | "sweetest" | "strongest" | "newest";

// Eén vaste, bewust geordende basisdrank-categorie i.p.v. een dynamische
// lijst afgeleid uit de data — "Alcoholvrij" staat hier expliciet naast de
// spirits (net als in de oorspronkelijke opdracht), niet als los aan/uit-
// vinkje. Geen sterkte(ABV)-bucketfilter meer — die categorie is geschrapt.
export type CocktailBaseCategory = "vodka" | "rum" | "whisky" | "alcohol_free";

export type CocktailFiltersState = {
  search: string;
  baseCategory: CocktailBaseCategory | null;
  flavour: FlavourBadgeCode | null;
  favoritesOnly: boolean;
  sort: CocktailSortOption;
};

const DEFAULT_FILTERS: CocktailFiltersState = {
  search: "",
  baseCategory: null,
  flavour: null,
  favoritesOnly: false,
  sort: "name",
};

// Puur client-side filteren/sorteren — de dataset (huiselijke cocktailkaart,
// geen commerciële menukaart met honderden items) is klein genoeg dat een
// serverside query hier premature complexiteit zou zijn.
// `isFavorite` komt van useCocktailFavorites via de aanroeper — deze hook
// weet zelf niets van favorieten-opslag, puur filteren op een gegeven set.
export function useCocktailFilters(cocktails: CocktailFull[], isFavorite: (cocktailId: string) => boolean = () => false) {
  const [filters, setFilters] = useState<CocktailFiltersState>(DEFAULT_FILTERS);

  const filteredCocktails = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const result = cocktails.filter((cocktail) => {
      const primary = getPrimaryVariant(cocktail);
      if (search && !cocktail.name.toLowerCase().includes(search) && !cocktail.tagline.toLowerCase().includes(search)) {
        return false;
      }
      if (filters.favoritesOnly && !isFavorite(cocktail.id)) return false;
      if (filters.baseCategory === "alcohol_free") {
        if (!cocktail.variants.some((v) => v.variant_type === "alcohol_free")) return false;
      } else if (filters.baseCategory && primary?.spirit?.id !== filters.baseCategory) {
        return false;
      }
      if (filters.flavour) {
        const badges = deriveFlavourBadges(primary?.flavour_profile ?? null);
        if (!badges.some((b) => b.code === filters.flavour)) return false;
      }
      return true;
    });

    const scoreFor = (cocktail: CocktailFull, key: "sweet_score" | "strong_score") =>
      getPrimaryVariant(cocktail)?.flavour_profile?.[key] ?? 0;

    switch (filters.sort) {
      case "sweetest":
        return [...result].sort((a, b) => scoreFor(b, "sweet_score") - scoreFor(a, "sweet_score"));
      case "strongest":
        return [...result].sort((a, b) => scoreFor(b, "strong_score") - scoreFor(a, "strong_score"));
      case "newest":
        return [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
      case "name":
      default:
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [cocktails, filters, isFavorite]);

  return { filters, setFilters, filteredCocktails };
}
