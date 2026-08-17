import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightGame,
  type GameResultMode,
} from "@/lib/supabase";

const GAMES_KEY = ["game-night", "games"] as const;

export function useGameNightGames() {
  return useQuery({
    queryKey: GAMES_KEY,
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

export type GameFlowConfig = {
  uses_rounds: boolean;
  track_round_results: boolean;
  has_session_winner: boolean;
  result_mode: GameResultMode;
};

// "Spelverloop"-instellingen (Spellenkast-correctie): schrijft rechtstreeks
// naar game_night_games, dus persistent en meteen van toepassing op elke
// NIEUWE spelsessie van dit spel. Lopende/historische spelsessies lezen hun
// eigen configuratiesnapshot (zie GameNightGameSession) en veranderen hier
// dus niet door — precies zoals de opdracht (sectie 29-31) vereist.
export function useUpdateGameFlowConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      config: GameFlowConfig;
    }): Promise<GameNightGame> => {
      const { data, error } = await supabase
        .from("game_night_games")
        .update(input.config)
        .eq("id", input.gameId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}
