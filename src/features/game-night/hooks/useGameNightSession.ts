import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightPlayer,
  type GameNightSession,
} from "@/lib/supabase";
import { generateGameNightName } from "@/features/game-night/lib/gameNightName";

const ACTIVE_SESSION_KEY = ["game-night", "active-session"] as const;
const SESSION_PLAYERS_KEY = (sessionId: string | undefined) =>
  ["game-night", "session-players", sessionId] as const;

// Bron van waarheid voor "hervatten" (sectie 17): een niet-afgeronde sessie
// bestaat altijd in Supabase, nooit alleen in React-state. De home-pagina
// roept dit bij elk bezoek aan om te bepalen of "VERDER MET GAME NIGHT"
// getoond moet worden — de meest recente actieve/gepauzeerde sessie wint
// als er (in theorie) meerdere zouden bestaan.
export function useActiveGameNightSession() {
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: async (): Promise<GameNightSession | null> => {
      const { data, error } = await supabase
        .from("game_night_sessions")
        .select("*")
        .neq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// De spelers die voor een specifieke Game Night geselecteerd zijn (sectie
// 5) — gebruikt zowel na het starten als bij het hervatten van een sessie
// om de namen te tonen.
export function useGameNightSessionPlayers(sessionId: string | undefined) {
  return useQuery({
    queryKey: SESSION_PLAYERS_KEY(sessionId),
    queryFn: async (): Promise<GameNightPlayer[]> => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from("game_night_session_players")
        .select("player:game_night_players(*)")
        .eq("session_id", sessionId);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.player as unknown as GameNightPlayer)
        .filter((player): player is GameNightPlayer => player !== null);
    },
    enabled: !!sessionId,
  });
}

// Sectie 21: maakt de sessie aan, koppelt de geselecteerde spelers en
// genereert de automatische naam — één atomaire actie vanuit de UI
// ("TAFEL IS COMPLEET"). Bij een mislukte tweede stap (attendance-insert)
// blijft er een sessie zonder spelers staan; dat is een acceptabele
// edge case in dit fundament, consistent met hoe de rest van de site
// meerstaps-writes behandelt (geen RPC/transactie-wrapper elders ook).
export function useStartGameNightSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      players: GameNightPlayer[],
    ): Promise<GameNightSession> => {
      const name = generateGameNightName(players.map((p) => p.name));

      const { data: session, error: sessionError } = await supabase
        .from("game_night_sessions")
        .insert({ name, status: "active" })
        .select("*")
        .single();
      if (sessionError) throw sessionError;

      const { error: playersError } = await supabase
        .from("game_night_session_players")
        .insert(
          players.map((player) => ({
            session_id: session.id,
            player_id: player.id,
          })),
        );
      if (playersError) throw playersError;

      return session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
      queryClient.invalidateQueries({
        queryKey: SESSION_PLAYERS_KEY(session.id),
      });
    },
  });
}
