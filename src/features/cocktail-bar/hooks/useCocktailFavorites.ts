import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { addFavorite, fetchFavoriteCocktailIds, removeFavorite } from "@/features/cocktail-bar/lib/favorites";

export function useCocktailFavorites() {
  const { session } = useAuth();
  const profileId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ["cocktail_bar", "favorites", profileId] as const;

  const { data: favoriteIds = [] } = useQuery({
    queryKey,
    queryFn: () => fetchFavoriteCocktailIds(profileId as string),
    enabled: !!profileId,
  });

  const favoriteSet = new Set(favoriteIds);

  // Optimistisch bijwerken: het hartje moet direct reageren, niet pas na de
  // netwerkrondtrip. Bij een mislukte mutatie herstelt onError de vorige
  // cache-waarde weer — geen aparte foutmelding-UI nodig voor iets zo klein.
  const toggle = useMutation({
    mutationFn: async (cocktailId: string) => {
      if (!profileId) return;
      if (favoriteSet.has(cocktailId)) {
        await removeFavorite(profileId, cocktailId);
      } else {
        await addFavorite(profileId, cocktailId);
      }
    },
    onMutate: async (cocktailId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey) ?? [];
      const next = previous.includes(cocktailId) ? previous.filter((id) => id !== cocktailId) : [...previous, cocktailId];
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_err, _cocktailId, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    isFavorite: (cocktailId: string) => favoriteSet.has(cocktailId),
    toggleFavorite: toggle.mutate,
  };
}
