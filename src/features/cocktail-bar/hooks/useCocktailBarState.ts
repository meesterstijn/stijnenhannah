import { useQuery } from "@tanstack/react-query";
import { fetchBarState } from "@/features/cocktail-bar/lib/barState";

export const COCKTAIL_BAR_STATE_QUERY_KEY = ["cocktail_bar", "state"] as const;

export function useCocktailBarState() {
  return useQuery({
    queryKey: COCKTAIL_BAR_STATE_QUERY_KEY,
    queryFn: fetchBarState,
  });
}
