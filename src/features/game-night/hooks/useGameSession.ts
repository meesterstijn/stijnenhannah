import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightGame,
  type GameNightGameSession,
  type GameNightPlayer,
} from "@/lib/supabase";

export type GameSessionWithGame = GameNightGameSession & {
  game: GameNightGame;
};

const OPEN_GAME_SESSION_KEY = (gameNightSessionId: string | undefined) =>
  ["game-night", "open-game-session", gameNightSessionId] as const;
const GAME_SESSION_PLAYERS_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "game-session-players", gameSessionId] as const;

// De meest recente spelsessie van deze Game Night, met het spel erbij
// gejoined. "Database als state machine" (opdracht sectie 34): het bord
// leidt zijn status volledig af uit deze rij — geen open sessie = nog geen
// spel gekozen, status active/paused = actieve speelmodus, status
// completed = net afgeronde spelsessie (toont de afrondingsstate).
export function useLatestGameSession(gameNightSessionId: string | undefined) {
  return useQuery({
    queryKey: OPEN_GAME_SESSION_KEY(gameNightSessionId),
    queryFn: async (): Promise<GameSessionWithGame | null> => {
      if (!gameNightSessionId) return null;
      const { data, error } = await supabase
        .from("game_night_game_sessions")
        .select("*, game:game_night_games(*)")
        .eq("game_night_session_id", gameNightSessionId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GameSessionWithGame | null;
    },
    enabled: !!gameNightSessionId,
    // Actieve klok/rondes lopen door — tik elke 5s bij zodat een tweede
    // client (of dezelfde na een tijdje) niet stil op verouderde data blijft.
    refetchInterval: 5_000,
  });
}

export function useGameSessionParticipants(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: GAME_SESSION_PLAYERS_KEY(gameSessionId),
    queryFn: async (): Promise<GameNightPlayer[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_game_session_players")
        .select("seat_order, player:game_night_players(*)")
        .eq("game_session_id", gameSessionId)
        .order("seat_order", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.player as unknown as GameNightPlayer)
        .filter((p): p is GameNightPlayer => p !== null);
    },
    enabled: !!gameSessionId,
  });
}

// Sectie 7: start_game_night_game_session — één RPC, controleert server-
// side aanwezigheid/min-max/al-actief-spel en maakt spelsessie + deelnemers
// (+ ronde 1 indien nodig) atomair aan.
export function useStartGameSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameNightSessionId: string;
      gameId: string;
      playerIds: string[];
    }): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_start_game_session",
        {
          p_game_night_session_id: input.gameNightSessionId,
          p_game_id: input.gameId,
          p_player_ids: input.playerIds,
        },
      );
      if (error) throw error;
      return data as GameNightGameSession;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({
        queryKey: OPEN_GAME_SESSION_KEY(session.game_night_session_id),
      });
      queryClient.invalidateQueries({
        queryKey: GAME_SESSION_PLAYERS_KEY(session.id),
      });
    },
  });
}

function invalidateGameSession(
  queryClient: ReturnType<typeof useQueryClient>,
  session: GameNightGameSession,
) {
  queryClient.invalidateQueries({
    queryKey: OPEN_GAME_SESSION_KEY(session.game_night_session_id),
  });
}

export function usePauseGameSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      gameSessionId: string,
    ): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_pause_game_session",
        { p_game_session_id: gameSessionId },
      );
      if (error) throw error;
      return data as GameNightGameSession;
    },
    onSuccess: (session) => invalidateGameSession(queryClient, session),
  });
}

export function useResumeGameSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      gameSessionId: string,
    ): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_resume_game_session",
        { p_game_session_id: gameSessionId },
      );
      if (error) throw error;
      return data as GameNightGameSession;
    },
    onSuccess: (session) => invalidateGameSession(queryClient, session),
  });
}

export type GameSessionWinner = { playerId: string; playerName: string };

// Winnaar(s) van een AFGERONDE spelsessie (sectie 25's "🏆 Hannah") —
// toekomstvast voor meerdere winnaars (gelijkspel/teams): geeft gewoon alle
// rijen met is_winner=true terug, de UI toont er nu één maar de query sluit
// er meerdere niet uit.
export function useGameSessionWinners(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: ["game-night", "game-session-winners", gameSessionId],
    queryFn: async (): Promise<GameSessionWinner[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_game_session_results")
        .select("player_id, player:game_night_players(name)")
        .eq("game_session_id", gameSessionId)
        .eq("is_winner", true);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        playerId: row.player_id,
        playerName:
          (row.player as unknown as { name: string } | null)?.name ??
          "Onbekend",
      }));
    },
    enabled: !!gameSessionId,
  });
}

export type SessionResultInput = {
  player_id: string;
  is_winner: boolean;
  score?: number | null;
  rank?: number | null;
};

export function useCompleteGameSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameSessionId: string;
      results: SessionResultInput[];
    }): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_complete_game_session",
        {
          p_game_session_id: input.gameSessionId,
          p_results: input.results,
        },
      );
      if (error) throw error;
      return data as GameNightGameSession;
    },
    onSuccess: (session) => {
      invalidateGameSession(queryClient, session);
      // "Kies voor ons"-recency (Game Night V4) moet een zojuist afgeronde
      // spelsessie meteen meewegen, ook binnen dezelfde avond — anders zou
      // een net gespeeld spel bij de volgende spelkeuze nog als "nooit
      // gespeeld" scoren tot de staleTime van useGameHistoryStats verloopt.
      queryClient.invalidateQueries({
        queryKey: ["game-night", "game-history-stats"],
      });
    },
  });
}
