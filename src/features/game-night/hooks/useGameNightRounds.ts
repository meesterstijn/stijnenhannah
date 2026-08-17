import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GameNightRound } from "@/lib/supabase";

const CURRENT_ROUND_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "current-round", gameSessionId] as const;
const ROUND_TALLY_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "round-tally", gameSessionId] as const;
const LAST_ENDED_ROUND_KEY = (gameSessionId: string | undefined) =>
  ["game-night", "last-ended-round", gameSessionId] as const;

// De actieve (nog niet afgeronde) ronde van een spelsessie — bestaat vanaf
// het starten van de spelsessie (ronde 1 wordt dan aangemaakt) tot de
// gebruiker 'm expliciet afrondt. Een volgende ronde ontstaat NIET meer
// automatisch (correctieronde "handmatige rondeflow") — zolang deze query
// null teruggeeft en er wel een laatst-afgeronde ronde bestaat, zit de UI
// bewust "tussen rondes" te wachten op VOLGENDE RONDE STARTEN.
export function useCurrentRound(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: CURRENT_ROUND_KEY(gameSessionId),
    queryFn: async (): Promise<GameNightRound | null> => {
      if (!gameSessionId) return null;
      const { data, error } = await supabase
        .from("game_night_rounds")
        .select("*")
        .eq("game_session_id", gameSessionId)
        .is("ended_at", null)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!gameSessionId,
  });
}

// De laatst AFGERONDE ronde — nodig voor "Laatste resultaat aanpassen"
// (sectie 19), dat corrigeert zonder een nieuwe ronde aan te maken.
export function useLastEndedRound(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: LAST_ENDED_ROUND_KEY(gameSessionId),
    queryFn: async (): Promise<GameNightRound | null> => {
      if (!gameSessionId) return null;
      const { data, error } = await supabase
        .from("game_night_rounds")
        .select("*")
        .eq("game_session_id", gameSessionId)
        .not("ended_at", "is", null)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!gameSessionId,
  });
}

// Winnaar van één specifieke ronde (voor "HANNAH WINT RONDE 1" tussen twee
// rondes) — apart van de tally, die de hele stand over alle rondes optelt.
export function useRoundWinner(roundId: string | undefined) {
  return useQuery({
    queryKey: ["game-night", "round-winner", roundId],
    queryFn: async (): Promise<{
      playerId: string;
      playerName: string;
    } | null> => {
      if (!roundId) return null;
      const { data, error } = await supabase
        .from("game_night_round_results")
        .select("player_id, player:game_night_players(name)")
        .eq("round_id", roundId)
        .eq("is_winner", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const player = data.player as unknown as { name: string } | null;
      return { playerId: data.player_id, playerName: player?.name ?? "?" };
    },
    enabled: !!roundId,
  });
}

export type RoundTallyEntry = { playerId: string; wins: number };

// Rondestand (sectie 18) — rechtstreeks berekend uit game_night_round_results,
// geen los bijgehouden teller. Twee eenvoudige queries (eerst de ronde-id's
// van deze spelsessie, dan de winnaarsrijen daarbinnen) i.p.v. een geneste
// PostgREST-filterexpressie op een embedded resource — minder foutgevoelig
// zonder live omgeving om tegen te testen. Het aantal rondes per spelsessie
// blijft klein genoeg (tientallen, geen duizenden) om dit client-side te
// aggregeren zonder aparte SQL-view/RPC.
export function useRoundTally(gameSessionId: string | undefined) {
  return useQuery({
    queryKey: ROUND_TALLY_KEY(gameSessionId),
    queryFn: async (): Promise<RoundTallyEntry[]> => {
      if (!gameSessionId) return [];

      const { data: rounds, error: roundsError } = await supabase
        .from("game_night_rounds")
        .select("id")
        .eq("game_session_id", gameSessionId);
      if (roundsError) throw roundsError;
      const roundIds = (rounds ?? []).map((r) => r.id);
      if (roundIds.length === 0) return [];

      const { data, error } = await supabase
        .from("game_night_round_results")
        .select("player_id")
        .in("round_id", roundIds)
        .eq("is_winner", true);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([playerId, wins]) => ({ playerId, wins }))
        .sort((a, b) => b.wins - a.wins);
    },
    enabled: !!gameSessionId,
  });
}

function invalidateRoundQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  gameSessionId: string,
) {
  queryClient.invalidateQueries({ queryKey: CURRENT_ROUND_KEY(gameSessionId) });
  queryClient.invalidateQueries({ queryKey: ROUND_TALLY_KEY(gameSessionId) });
  queryClient.invalidateQueries({
    queryKey: LAST_ENDED_ROUND_KEY(gameSessionId),
  });
  // Prefix-match: ongeacht welke specifieke ronde-id, elke "wie won deze
  // ronde"-query kan door deze mutatie stale zijn geworden (met name na
  // een correctie op de laatst afgeronde ronde).
  queryClient.invalidateQueries({ queryKey: ["game-night", "round-winner"] });
}

// Sluit de huidige ronde af en slaat het resultaat op (winnaar + de rest
// als niet-winnaar). Maakt sinds de correctieronde "handmatige rondeflow"
// GEEN volgende ronde meer aan — dat is nu een aparte, expliciete stap
// (useStartNextRound). De ronde blijft dus tot dit moment gewoon open in de
// database; een refresh tijdens het kiezen van een winnaar toont daardoor
// gewoon weer "ronde actief", nooit een inconsistente tussenstand.
export function useRecordRoundWinner(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      roundId: string;
      winnerPlayerId: string;
    }): Promise<GameNightRound> => {
      const { data, error } = await supabase.rpc(
        "game_night_record_round_winner",
        { p_round_id: input.roundId, p_winner_player_id: input.winnerPlayerId },
      );
      if (error) throw error;
      return data as GameNightRound;
    },
    onSuccess: () => {
      if (gameSessionId) invalidateRoundQueries(queryClient, gameSessionId);
    },
  });
}

export function useCorrectRoundResult(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      roundId: string;
      winnerPlayerId: string;
    }): Promise<void> => {
      const { error } = await supabase.rpc("game_night_correct_round_result", {
        p_round_id: input.roundId,
        p_winner_player_id: input.winnerPlayerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (gameSessionId) invalidateRoundQueries(queryClient, gameSessionId);
    },
  });
}

// Ronde afronden ZONDER resultaat (track_round_results=false) — geen
// winnaarsvraag, geen nepresultaat, sluit alleen de ronde af. Maakt
// sinds de correctieronde eveneens geen volgende ronde meer aan.
export function useEndRound(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roundId: string): Promise<GameNightRound> => {
      const { data, error } = await supabase.rpc("game_night_end_round", {
        p_round_id: roundId,
      });
      if (error) throw error;
      return data as GameNightRound;
    },
    onSuccess: () => {
      if (gameSessionId) invalidateRoundQueries(queryClient, gameSessionId);
    },
  });
}

// De enige plek waar (na ronde 1 bij het starten van de spelsessie) nog een
// nieuwe ronde ontstaat — uitsluitend op expliciete tik van de gebruiker
// ("Volgende ronde starten"), nooit automatisch. De RPC zelf beschermt
// tegen dubbel tikken/race conditions (rij-lock op de spelsessie + de
// bestaande unique constraint op game_session_id+round_number).
export function useStartNextRound(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GameNightRound> => {
      if (!gameSessionId) throw new Error("Geen actieve spelsessie");
      const { data, error } = await supabase.rpc(
        "game_night_start_next_round",
        { p_game_session_id: gameSessionId },
      );
      if (error) throw error;
      return data as GameNightRound;
    },
    onSuccess: () => {
      if (gameSessionId) invalidateRoundQueries(queryClient, gameSessionId);
    },
  });
}

// Een nog-actieve (niet afgeronde) ronde weggooien (sectie 24) — gebruikt
// wanneer de gebruiker de hele spelsessie afrondt terwijl de huidige ronde
// nog bezig is; voorkomt dat een halve ronde stilletjes als resultaat
// wordt opgeslagen.
export function useDiscardOpenRound(gameSessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roundId: string): Promise<void> => {
      const { error } = await supabase.rpc("game_night_discard_open_round", {
        p_round_id: roundId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (gameSessionId) invalidateRoundQueries(queryClient, gameSessionId);
    },
  });
}
