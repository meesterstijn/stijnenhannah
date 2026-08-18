import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightGameSession,
  type GameNightWinEvent,
} from "@/lib/supabase";

const WIN_EVENTS_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "win-events", gameSessionId] as const;

// Game Night V2.2 — universele WIN-engine (sectie 5). Alle win-events van
// deze spelsessie, nieuwste eerst — zowel actief als ongedaan gemaakt (de
// UI filtert `undone_at` zelf waar nodig, bv. voor de live teller vs. een
// kort correctiemomentje in de actiefeed). Spelernaam/nickname wordt
// bewust NIET hier gejoined: de consument (WinPlayPanel) heeft de
// deelnemerslijst al geladen via useGameSessionParticipants — een extra
// join hier zou dezelfde spelerdata dubbel ophalen (geen N+1, geen query
// per speler).
export function useGameSessionWinEvents(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: WIN_EVENTS_KEY(gameSessionId),
    queryFn: async (): Promise<GameNightWinEvent[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_win_events")
        .select("*")
        .eq("game_session_id", gameSessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!gameSessionId,
  });
}

// Na elke WIN/undo mag de zware analytics-query (Hall of Fame/spelerprofiel/
// live titels) gerust "stale" gemarkeerd worden — hij is al 60s
// staleTime-gecachet (useGameNightAnalytics), dus dit is nooit een zware
// herhaalde herfetch per tik, alleen een markering "haal opnieuw op zodra
// iemand 'm weer nodig heeft".
function invalidateAnalytics(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    queryKey: ["game-night", "analytics-raw"],
  });
}

// Eén tik = één RPC-call = exact één nieuw event (sectie 3). Bewust GEEN
// server-side dubbel-tik-bescherming — twee bewuste tikken mogen twee
// events zijn; de UI beschermt alleen tegen één fysiek tik-event dat per
// ongeluk dubbel wordt verstuurd (pending-state op de knop, zie
// WinPlayPanel).
export function useRecordWin(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string): Promise<GameNightWinEvent> => {
      if (!gameSessionId) throw new Error("Geen actieve spelsessie");
      const { data, error } = await supabase.rpc("game_night_record_win", {
        p_game_session_id: gameSessionId,
        p_player_id: playerId,
      });
      if (error) throw error;
      return data as GameNightWinEvent;
    },
    onSuccess: () => {
      if (gameSessionId) {
        queryClient.invalidateQueries({
          queryKey: WIN_EVENTS_KEY(gameSessionId),
        });
      }
      invalidateAnalytics(queryClient);
    },
  });
}

// Event-specifiek (sectie 4): ontvangt het win-event-id, nooit "haal
// laatste WIN van speler X weg" — zo blijft de actiefeed betrouwbaar exact
// het getikte event corrigeren.
export function useUndoWinEvent(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (winEventId: string): Promise<GameNightWinEvent> => {
      const { data, error } = await supabase.rpc("game_night_undo_win_event", {
        p_win_event_id: winEventId,
      });
      if (error) throw error;
      return data as GameNightWinEvent;
    },
    onSuccess: () => {
      if (gameSessionId) {
        queryClient.invalidateQueries({
          queryKey: WIN_EVENTS_KEY(gameSessionId),
        });
      }
      invalidateAnalytics(queryClient);
    },
  });
}

// Sluit een win_events-spelsessie af — schrijft GEEN
// game_night_game_session_results (sectie 12: win-events blijven de
// volledige winstwaarheid, er ontstaat nooit een afgeleide "session
// winner"). Ongewijzigd t.o.v. useCompleteGameSession: dezelfde
// invalidatie-set (open spelsessie van de Game Night, "Kies voor ons"-
// recency), plus de nieuwe win-events-query van deze sessie zelf.
export function useCompleteWinSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      gameSessionId: string,
    ): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_complete_win_session",
        { p_game_session_id: gameSessionId },
      );
      if (error) throw error;
      return data as GameNightGameSession;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({
        queryKey: [
          "game-night",
          "open-game-session",
          session.game_night_session_id,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: WIN_EVENTS_KEY(session.id),
      });
      queryClient.invalidateQueries({
        queryKey: ["game-night", "game-history-stats"],
      });
      invalidateAnalytics(queryClient);
    },
  });
}
