import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type GameNightPlayer,
  type GameNightSessionPlayer,
} from "@/lib/supabase";

// Game Night V2.4 — de lobby/party-laag. Bouwt bewust voort op de bestaande
// game_night_session_players (attendance) i.p.v. een tweede tabel; een rij
// betekent nog steeds "hoort bij deze avond", `active_at_table` beslist
// alleen of iemand NU aan tafel zit (sectie 3-4).

const PARTY_SEATS_KEY = (sessionId: string | undefined) =>
  ["game-night", "party-seats", sessionId] as const;

export type PartySeat = GameNightSessionPlayer & { player: GameNightPlayer };

// Alleen de spelers die NU actief aan tafel zitten, op seat_index gesorteerd
// — dit is de "AAN TAFEL"-zone. Wie beschikbaar is om te slepen wordt in de
// component afgeleid door usePlayers() (alle actieve spelers) te
// verminderen met de player-id's hieronder — geen aparte query nodig.
export function useActivePartySeats(sessionId: string | undefined) {
  return useQuery({
    queryKey: PARTY_SEATS_KEY(sessionId),
    queryFn: async (): Promise<PartySeat[]> => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from("game_night_session_players")
        .select("*, player:game_night_players(*)")
        .eq("session_id", sessionId)
        .eq("active_at_table", true)
        .order("seat_index", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.player !== null)
        .map((row) => row as unknown as PartySeat);
    },
    enabled: !!sessionId,
  });
}

// Sectie 26: overal waar een spel gekozen/gestart wordt (Kies voor ons,
// Game Roulette, Spellenkast → GameParticipantSheet) moet voortaan de
// ACTIEVE tafel preselecteren, niet de volledige avond-attendance — een
// speler die uit de party gesleept is, mag niet automatisch meedoen aan
// het volgende spel. Dunne afgeleide van useActivePartySeats, drop-in
// vervanging overal waar voorheen useGameNightSessionPlayers stond.
export function useActivePartyPlayers(sessionId: string | undefined) {
  const { data: seats, ...rest } = useActivePartySeats(sessionId);
  return { data: seats?.map((s) => s.player) ?? [], ...rest };
}

// Sectie 19: realtime i.p.v. polling — één kanaal per Game Night,
// INSERT/UPDATE op game_night_session_players van deze sessie ververst de
// party-query. `enabled` is bedoeld om dit uit te zetten zodra de lobby toch
// niet zichtbaar is (bv. tijdens actief spel) — geen open abonnement voor
// niets. Zelfde patroon/idioom als useR6SessionRealtimeSync.
export function usePartyRealtimeSync(
  sessionId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId || !enabled) return;

    const channel = supabase
      .channel(`game-night-party-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_night_session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: PARTY_SEATS_KEY(sessionId),
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_night_session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: PARTY_SEATS_KEY(sessionId),
          }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, enabled, queryClient]);
}

function invalidateParty(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
) {
  queryClient.invalidateQueries({ queryKey: PARTY_SEATS_KEY(sessionId) });
}

export function useAddToParty(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string): Promise<GameNightSessionPlayer> => {
      if (!sessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc("game_night_add_to_party", {
        p_session_id: sessionId,
        p_player_id: playerId,
      });
      if (error) throw error;
      return data as GameNightSessionPlayer;
    },
    onSuccess: () => {
      if (sessionId) invalidateParty(queryClient, sessionId);
    },
  });
}

export function useRemoveFromParty(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string): Promise<GameNightSessionPlayer> => {
      if (!sessionId) throw new Error("Geen actieve Game Night");
      const { data, error } = await supabase.rpc(
        "game_night_remove_from_party",
        { p_session_id: sessionId, p_player_id: playerId },
      );
      if (error) throw error;
      return data as GameNightSessionPlayer;
    },
    onSuccess: () => {
      if (sessionId) invalidateParty(queryClient, sessionId);
    },
  });
}

export function useSetPartyOrder(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerIds: string[]): Promise<void> => {
      if (!sessionId) throw new Error("Geen actieve Game Night");
      const { error } = await supabase.rpc("game_night_set_party_order", {
        p_session_id: sessionId,
        p_player_ids: playerIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (sessionId) invalidateParty(queryClient, sessionId);
    },
  });
}
