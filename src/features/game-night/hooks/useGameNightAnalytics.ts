import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  createAnalyticsData,
  type AnalyticsData,
  type GameNightAnalyticsRaw,
} from "@/features/game-night/lib/gameNightStats";

const ANALYTICS_KEY = ["game-night", "analytics-raw"] as const;

// Eén bundel ruwe data voor Geschiedenis/Spelerprofielen/Hall of
// Fame/homepage-kampioen (Game Night V5, sectie 30-31): nu 10 queries (V2.1
// voegt game_night_win_events toe), ÉÉN keer parallel opgehaald, ongeacht
// hoeveel spelers/spellen/Game Nights er bestaan — geen enkele component
// doet hierna zelf nog een Supabase-call per speler/spel (geen N+1). Zowel
// spelers als spellen worden hier VOLLEDIG opgehaald (dus ook gearchiveerd,
// sectie 33/34) — in tegenstelling tot usePlayers()/useGameNightGames(),
// die bewust alleen de actieve rijen tonen voor de spelkeuze-flows.
async function fetchAnalyticsRaw(): Promise<GameNightAnalyticsRaw> {
  const [
    sessionsRes,
    sessionPlayersRes,
    playersRes,
    gamesRes,
    gameSessionsRes,
    gameSessionPlayersRes,
    roundsRes,
    roundResultsRes,
    sessionResultsRes,
    winEventsRes,
  ] = await Promise.all([
    supabase
      .from("game_night_sessions")
      .select("*")
      .order("started_at", { ascending: false }),
    supabase.from("game_night_session_players").select("*"),
    supabase
      .from("game_night_players")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("game_night_games").select("*"),
    supabase.from("game_night_game_sessions").select("*"),
    supabase.from("game_night_game_session_players").select("*"),
    supabase.from("game_night_rounds").select("*"),
    supabase.from("game_night_round_results").select("*"),
    supabase.from("game_night_game_session_results").select("*"),
    supabase.from("game_night_win_events").select("*"),
  ]);

  for (const res of [
    sessionsRes,
    sessionPlayersRes,
    playersRes,
    gamesRes,
    gameSessionsRes,
    gameSessionPlayersRes,
    roundsRes,
    roundResultsRes,
    sessionResultsRes,
    winEventsRes,
  ]) {
    if (res.error) throw res.error;
  }

  return {
    sessions: sessionsRes.data ?? [],
    sessionPlayers: sessionPlayersRes.data ?? [],
    players: playersRes.data ?? [],
    games: gamesRes.data ?? [],
    gameSessions: gameSessionsRes.data ?? [],
    gameSessionPlayers: gameSessionPlayersRes.data ?? [],
    rounds: roundsRes.data ?? [],
    roundResults: roundResultsRes.data ?? [],
    sessionResults: sessionResultsRes.data ?? [],
    winEvents: winEventsRes.data ?? [],
  };
}

export function useGameNightAnalyticsRaw() {
  return useQuery({
    queryKey: ANALYTICS_KEY,
    queryFn: fetchAnalyticsRaw,
    staleTime: 60 * 1000,
  });
}

// De index (Maps/lookups) wordt met useMemo maar één keer per dataset-
// wijziging gebouwd, niet bij elke render van elke component die 'm
// gebruikt.
export function useGameNightAnalytics(): {
  data: AnalyticsData | undefined;
  isLoading: boolean;
} {
  const { data: raw, isLoading } = useGameNightAnalyticsRaw();
  const data = useMemo(
    () => (raw ? createAnalyticsData(raw) : undefined),
    [raw],
  );
  return { data, isLoading };
}
