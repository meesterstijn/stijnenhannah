import { useQuery } from "@tanstack/react-query";
import { fetchPublishedCocktailsFull } from "@/features/cocktail-bar/lib/cocktails";

export const COCKTAIL_SHOWCASE_QUERY_KEY = ["cocktail_bar", "cocktails", "published_full"] as const;

export function useCocktailShowcase() {
  return useQuery({
    queryKey: COCKTAIL_SHOWCASE_QUERY_KEY,
    queryFn: fetchPublishedCocktailsFull,
  });
}
