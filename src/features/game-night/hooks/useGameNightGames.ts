import { useQuery } from "@tanstack/react-query";
import { supabase, type GameNightGame } from "@/lib/supabase";

export function useGameNightGames() {
  return useQuery({
    queryKey: ["game-night", "games"],
    queryFn: async (): Promise<GameNightGame[]> => {
      // archived_at (toegevoegd in 20260912020000) verbergt een spel met
      // gespeelde geschiedenis uit de actieve spellenkast zonder de rij of
      // zijn resultaten te verwijderen (sectie 27) — nog geen UI om een
      // spel te archiveren, maar de query moet het gedrag al respecteren.
      const { data, error } = await supabase
        .from("game_night_games")
        .select("*")
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
