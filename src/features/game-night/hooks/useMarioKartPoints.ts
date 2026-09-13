import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightMarioKartPoints } from "@/lib/supabase";

// Mario Kart-puntenklassement: één rij per (Game Night, speler), begint dus
// vanzelf weer bij nul zodra een nieuwe game_night_sessions-rij ontstaat —
// geen aparte reset-actie nodig. Los van useGameNightAnalytics/
// gameNightStats.ts, want dit is geen win/verlies-telling maar een vrij
// door de owner toegekend puntentotaal (zie de migratie voor de reden).

const MARIO_KART_POINTS_KEY = (gameNightSessionId: string | undefined) =>
  ["game-night", "mario-kart-points", gameNightSessionId] as const;

export function useMarioKartPoints(gameNightSessionId: string | undefined) {
  return useQuery({
    queryKey: MARIO_KART_POINTS_KEY(gameNightSessionId),
    queryFn: async (): Promise<GameNightMarioKartPoints[]> => {
      if (!gameNightSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_mario_kart_points")
        .select("*")
        .eq("game_night_session_id", gameNightSessionId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!gameNightSessionId,
  });
}

// `delta` telt op bij het bestaande totaal van deze speler (mag negatief
// zijn, voor een correctie) — de RPC doet dit atomisch server-side, zodat
// twee snel na elkaar ingevoerde races elkaar nooit overschrijven.
export function useAddMarioKartPoints(gameNightSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      playerId: string;
      delta: number;
    }): Promise<GameNightMarioKartPoints> => {
      if (!gameNightSessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc(
        "game_night_add_mario_kart_points",
        {
          p_game_night_session_id: gameNightSessionId,
          p_player_id: input.playerId,
          p_delta: input.delta,
        },
      );
      if (error) throw error;
      return data as GameNightMarioKartPoints;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MARIO_KART_POINTS_KEY(gameNightSessionId),
      });
    },
  });
}
