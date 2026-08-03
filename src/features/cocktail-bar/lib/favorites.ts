import { supabase } from "@/lib/supabase";

// profileId komt van de aanroeper (session.user.id via useAuth), niet hier
// zelf opgehaald — zelfde patroon als created_by elders in de app
// (Tuinieren.tsx, Notities.tsx, Todo.tsx: session?.user.id wordt bij de
// aanroep meegegeven, niet in de lib-functie zelf opnieuw bevraagd).
export async function fetchFavoriteCocktailIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase.from("cocktail_favorites").select("cocktail_id").eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []).map((row) => row.cocktail_id as string);
}

export async function addFavorite(profileId: string, cocktailId: string): Promise<void> {
  const { error } = await supabase.from("cocktail_favorites").insert({ profile_id: profileId, cocktail_id: cocktailId });
  if (error) throw error;
}

export async function removeFavorite(profileId: string, cocktailId: string): Promise<void> {
  const { error } = await supabase.from("cocktail_favorites").delete().eq("profile_id", profileId).eq("cocktail_id", cocktailId);
  if (error) throw error;
}
