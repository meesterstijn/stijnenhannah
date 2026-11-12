import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightGameSession } from "@/lib/supabase";
import type {
  ShEvent,
  ShEventPayload,
} from "@/features/game-night/lib/secretHitler";
import type { ShSuspicion } from "@/features/game-night/lib/secretHitlerStory";

// Secret Hitler: event-log per spelsessie (zie de 20261112000000-migratie)
// en de geheime "wie is Hitler?"-verdenkingen van de telefoons.

type EventRow = {
  id: string;
  game_session_id: string;
  payload: ShEventPayload;
  created_at: string;
  undone_at: string | null;
};

const EVENTS_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "secret-hitler-events", gameSessionId] as const;
const SUSPICIONS_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "secret-hitler-suspicions", gameSessionId] as const;
const HISTORY_KEY = ["game-night", "secret-hitler-history"] as const;

function toEvent(row: EventRow): ShEvent {
  return {
    id: row.id,
    created_at: row.created_at,
    undone_at: row.undone_at,
    payload: row.payload,
  };
}

export function useSecretHitlerEvents(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: EVENTS_KEY(gameSessionId),
    queryFn: async (): Promise<ShEvent[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_secret_hitler_events")
        .select("*")
        .eq("game_session_id", gameSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as EventRow[]).map(toEvent);
    },
    enabled: !!gameSessionId,
    // Een tweede hostscherm (bv. tv + telefoon) blijft zo vanzelf bij.
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
  });
}

export function useRecordSecretHitlerEvent(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ShEventPayload): Promise<ShEvent> => {
      if (!gameSessionId) throw new Error("Geen actieve spelsessie");
      const { data, error } = await supabase.rpc(
        "game_night_secret_hitler_record",
        { p_game_session_id: gameSessionId, p_payload: payload },
      );
      if (error) throw error;
      return toEvent(data as EventRow);
    },
    onSuccess: (event) => {
      // Meteen in de cache, zodat het bord niet op de refetch hoeft te wachten.
      queryClient.setQueryData<ShEvent[]>(EVENTS_KEY(gameSessionId), (cur) =>
        cur && !cur.some((e) => e.id === event.id) ? [...cur, event] : cur,
      );
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY(gameSessionId) });
    },
  });
}

export function useUndoSecretHitlerEvent(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ShEvent> => {
      if (!gameSessionId) throw new Error("Geen actieve spelsessie");
      const { data, error } = await supabase.rpc(
        "game_night_secret_hitler_undo_last",
        { p_game_session_id: gameSessionId },
      );
      if (error) throw error;
      return toEvent(data as EventRow);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<ShEvent[]>(EVENTS_KEY(gameSessionId), (cur) =>
        cur?.map((e) => (e.id === event.id ? event : e)),
      );
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY(gameSessionId) });
    },
  });
}

export function useSecretHitlerSuspicions(
  gameSessionId: string | undefined,
  live = true,
) {
  return useQuery({
    queryKey: SUSPICIONS_KEY(gameSessionId),
    queryFn: async (): Promise<ShSuspicion[]> => {
      if (!gameSessionId) return [];
      const { data, error } = await supabase
        .from("game_night_secret_hitler_suspicions")
        .select("voter_player_id, suspect_player_id")
        .eq("game_session_id", gameSessionId);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        voterId: r.voter_player_id as string,
        suspectId: r.suspect_player_id as string,
      }));
    },
    enabled: !!gameSessionId,
    refetchInterval: live ? 5_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useFinishSecretHitler() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameSessionId: string;
      winnerIds: string[];
    }): Promise<GameNightGameSession> => {
      const { data, error } = await supabase.rpc(
        "game_night_secret_hitler_finish",
        {
          p_game_session_id: input.gameSessionId,
          p_winner_ids: input.winnerIds,
        },
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
        queryKey: ["game-night", "win-events", session.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["game-night", "game-history-stats"],
      });
      queryClient.invalidateQueries({
        queryKey: ["game-night", "analytics-raw"],
      });
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}

export type SecretHitlerHistoryGame = {
  gameSessionId: string;
  startedAt: string;
  status: string;
  seats: string[];
  events: ShEvent[];
};

// Alle gespeelde Secret Hitler-potjes (voor de statistieken op de
// spelpagina). Twee queries, geen query per potje.
export function useSecretHitlerHistory(gameId: string | undefined) {
  return useQuery({
    queryKey: [...HISTORY_KEY, gameId],
    queryFn: async (): Promise<SecretHitlerHistoryGame[]> => {
      if (!gameId) return [];
      const { data: sessions, error } = await supabase
        .from("game_night_game_sessions")
        .select(
          "id, started_at, status, players:game_night_game_session_players(player_id, seat_order)",
        )
        .eq("game_id", gameId)
        .order("started_at", { ascending: true });
      if (error) throw error;
      const ids = (sessions ?? []).map((s) => s.id as string);
      if (ids.length === 0) return [];
      const { data: rows, error: eventsError } = await supabase
        .from("game_night_secret_hitler_events")
        .select("*")
        .in("game_session_id", ids)
        .is("undone_at", null)
        .order("created_at", { ascending: true });
      if (eventsError) throw eventsError;
      const byGame = new Map<string, ShEvent[]>();
      for (const row of (rows ?? []) as EventRow[]) {
        const list = byGame.get(row.game_session_id) ?? [];
        list.push(toEvent(row));
        byGame.set(row.game_session_id, list);
      }
      return (sessions ?? [])
        .filter((s) => byGame.has(s.id as string))
        .map((s) => ({
          gameSessionId: s.id as string,
          startedAt: s.started_at as string,
          status: s.status as string,
          seats: [
            ...((s.players ?? []) as {
              player_id: string;
              seat_order: number | null;
            }[]),
          ]
            .sort((a, b) => (a.seat_order ?? 0) - (b.seat_order ?? 0))
            .map((p) => p.player_id),
          events: byGame.get(s.id as string) ?? [],
        }));
    },
    enabled: !!gameId,
    staleTime: 60_000,
  });
}

// ── Telefoon (gast) ────────────────────────────────────────────────────

export type GuestSecretHitler =
  | { active: false }
  | {
      active: true;
      game_session_id: string;
      status: "active" | "paused" | "completed";
      me: string;
      seats: string[];
      events: ShEvent[];
      my_suspect: string | null;
      suspicions: { voter_player_id: string; suspect_player_id: string }[];
    };

const GUEST_KEY = (guestToken: string | null, sessionId: string | undefined) =>
  ["game-night-guest-secret-hitler", guestToken, sessionId] as const;

export function useGuestSecretHitler(
  guestToken: string | null,
  sessionId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: GUEST_KEY(guestToken, sessionId),
    queryFn: async (): Promise<GuestSecretHitler> => {
      const { data, error } = await supabase.rpc(
        "game_night_guest_secret_hitler",
        { p_guest_token: guestToken, p_session_id: sessionId },
      );
      if (error) throw error;
      return data as GuestSecretHitler;
    },
    enabled: enabled && !!guestToken && !!sessionId,
    retry: false,
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
  });
}

export function useGuestSuspect(
  guestToken: string | null,
  sessionId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (suspectId: string | null) => {
      const { error } = await supabase.rpc(
        "game_night_guest_secret_hitler_suspect",
        {
          p_guest_token: guestToken,
          p_session_id: sessionId,
          p_suspect_id: suspectId,
        },
      );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: GUEST_KEY(guestToken, sessionId),
      }),
  });
}
