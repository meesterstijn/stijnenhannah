import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightMarioKartPointEvent } from "@/lib/supabase";

// Mario Kart-puntenklassement: een append-only event-log per Game Night
// (zie de 20260925000000-migratie voor waarom — kort samengevat: een
// mutable totaal kan niet terugdraaien zonder zelf al een geschiedenis bij
// te houden, dus die geschiedenis is nu de bron van waarheid). Begint dus
// vanzelf weer bij nul zodra een nieuwe game_night_sessions-rij ontstaat —
// geen aparte reset-actie nodig. Los van useGameNightAnalytics/
// gameNightStats.ts, want dit is geen win/verlies-telling maar een vrij
// door de owner toegekend puntentotaal.

const MARIO_KART_POINTS_KEY = (gameNightSessionId: string | undefined) =>
  ["game-night", "mario-kart-points", gameNightSessionId] as const;

export function useMarioKartPointEvents(gameNightSessionId: string | undefined) {
  return useQuery({
    queryKey: MARIO_KART_POINTS_KEY(gameNightSessionId),
    queryFn: async (): Promise<GameNightMarioKartPointEvent[]> => {
      if (!gameNightSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_mario_kart_point_events")
        .select("*")
        .eq("game_night_session_id", gameNightSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!gameNightSessionId,
  });
}

// `delta` is een nieuwe event-rij (mag negatief zijn, voor een correctie) —
// de RPC schrijft 'm atomisch server-side, zodat twee snel na elkaar
// ingevoerde races elkaar nooit overschrijven.
export function useAwardMarioKartPoints(gameNightSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      playerId: string;
      delta: number;
    }): Promise<GameNightMarioKartPointEvent> => {
      if (!gameNightSessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc(
        "game_night_award_mario_kart_points",
        {
          p_game_night_session_id: gameNightSessionId,
          p_player_id: input.playerId,
          p_delta: input.delta,
        },
      );
      if (error) throw error;
      return data as GameNightMarioKartPointEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MARIO_KART_POINTS_KEY(gameNightSessionId),
      });
    },
  });
}

// Eén gedeelde "ongedaan maken"-knop (geen per-speler-knop): draait de
// MEEST RECENTE nog-actieve toekenning van deze Game Night terug, ongeacht
// welke speler die kreeg — nogmaals klikken draait de erna meest recente
// terug, enzovoort (een echte undo-stack, want elke undo markeert alleen
// die ene rij en laat de rest ongemoeid).
export function useUndoLastMarioKartPointEvent(
  gameNightSessionId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GameNightMarioKartPointEvent> => {
      if (!gameNightSessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc(
        "game_night_undo_last_mario_kart_point_event",
        { p_game_night_session_id: gameNightSessionId },
      );
      if (error) throw error;
      return data as GameNightMarioKartPointEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MARIO_KART_POINTS_KEY(gameNightSessionId),
      });
    },
  });
}
