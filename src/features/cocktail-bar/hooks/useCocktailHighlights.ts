import { useQuery } from "@tanstack/react-query";
import { fetchHighlights } from "@/features/cocktail-bar/lib/highlights";

export const COCKTAIL_HIGHLIGHTS_QUERY_KEY = [
  "cocktail_bar",
  "highlights",
] as const;

export function useCocktailHighlights() {
  return useQuery({
    queryKey: COCKTAIL_HIGHLIGHTS_QUERY_KEY,
    queryFn: fetchHighlights,
  });
}
