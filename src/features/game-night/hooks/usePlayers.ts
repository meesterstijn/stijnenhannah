import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightPlayer } from "@/lib/supabase";

const PLAYERS_KEY = ["game-night", "players"] as const;

// Alleen actieve (niet-gearchiveerde) spelers — de partial index
// game_night_players_active_idx dekt precies deze query.
export function usePlayers() {
  return useQuery({
    queryKey: PLAYERS_KEY,
    queryFn: async (): Promise<GameNightPlayer[]> => {
      const { data, error } = await supabase
        .from("game_night_players")
        .select("*")
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type NewPlayerInput = {
  name: string;
  color?: string | null;
};

// Geen gastmodus (sectie 20): elke nieuwe speler wordt meteen permanent
// opgeslagen en is direct selecteerbaar voor de huidige Game Night.
export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPlayerInput): Promise<GameNightPlayer> => {
      const { data, error } = await supabase
        .from("game_night_players")
        .insert({ name: input.name.trim(), color: input.color ?? null })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}

// Archiveren i.p.v. hard-delete (sectie 26) — historie/resultaten van deze
// speler blijven intact, hij verdwijnt alleen uit de actieve selectielijst.
export function useArchivePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string): Promise<void> => {
      const { error } = await supabase
        .from("game_night_players")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYERS_KEY });
    },
  });
}
