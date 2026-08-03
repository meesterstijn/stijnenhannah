import { useQuery } from "@tanstack/react-query";
import { fetchCocktailFull } from "@/features/cocktail-bar/lib/cocktails";

export function useCocktailDetail(cocktailId: string | null) {
  return useQuery({
    queryKey: ["cocktail_bar", "cocktail", cocktailId],
    queryFn: () => fetchCocktailFull(cocktailId as string),
    enabled: !!cocktailId,
  });
}
