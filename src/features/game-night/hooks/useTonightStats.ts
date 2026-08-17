import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type TonightTopWinner = {
  playerId: string;
  playerName: string;
  wins: number;
};

export type TonightStats = {
  gamesPlayed: number;
  totalActiveMinutes: number;
  totalRounds: number;
  topWinners: TonightTopWinner[];
};

// Het "VANAVOND"-blok (sectie 11) — uitsluitend afgeleid uit echte,
// afgeronde spelsessies van deze Game Night. Geen mockdata (sectie 42): als
// er nog niets afgerond is, geeft dit gewoon `gamesPlayed: 0` en een lege
// winnaarslijst terug, en toont de UI dan minder i.p.v. iets te verzinnen.
// Telt bewust alleen sessie-eindresultaten (game_night_game_session_results),
// niet losse rondewinsten — dat houdt "vanavond gewonnen" op het niveau van
// hele potjes, consistent met hoe de opdracht het voorbeeld formuleert
// ("Hannah · 2 zeges").
export function useTonightStats(gameNightSessionId: string | undefined) {
  return useQuery({
    queryKey: ["game-night", "tonight-stats", gameNightSessionId],
    queryFn: async (): Promise<TonightStats> => {
      if (!gameNightSessionId) {
        return {
          gamesPlayed: 0,
          totalActiveMinutes: 0,
          totalRounds: 0,
          topWinners: [],
        };
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from("game_night_game_sessions")
        .select("id, started_at, ended_at, total_paused_seconds")
        .eq("game_night_session_id", gameNightSessionId)
        .eq("status", "completed");
      if (sessionsError) throw sessionsError;

      const gamesPlayed = sessions?.length ?? 0;
      let totalSeconds = 0;
      for (const s of sessions ?? []) {
        if (!s.ended_at) continue;
        const elapsed =
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
            1000 -
          s.total_paused_seconds;
        totalSeconds += Math.max(0, elapsed);
      }

      const sessionIds = (sessions ?? []).map((s) => s.id);
      let topWinners: TonightTopWinner[] = [];
      let totalRounds = 0;

      if (sessionIds.length > 0) {
        const { count, error: roundsError } = await supabase
          .from("game_night_rounds")
          .select("id", { count: "exact", head: true })
          .in("game_session_id", sessionIds);
        if (roundsError) throw roundsError;
        totalRounds = count ?? 0;
      }

      if (sessionIds.length > 0) {
        const { data: results, error: resultsError } = await supabase
          .from("game_night_game_session_results")
          .select("player_id, player:game_night_players(name)")
          .in("game_session_id", sessionIds)
          .eq("is_winner", true);
        if (resultsError) throw resultsError;

        const counts = new Map<string, { name: string; wins: number }>();
        for (const row of results ?? []) {
          const player = row.player as unknown as { name: string } | null;
          const existing = counts.get(row.player_id);
          counts.set(row.player_id, {
            name: player?.name ?? "Onbekend",
            wins: (existing?.wins ?? 0) + 1,
          });
        }
        topWinners = [...counts.entries()]
          .map(([playerId, v]) => ({
            playerId,
            playerName: v.name,
            wins: v.wins,
          }))
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 3);
      }

      return {
        gamesPlayed,
        totalActiveMinutes: Math.round(totalSeconds / 60),
        totalRounds,
        topWinners,
      };
    },
    enabled: !!gameNightSessionId,
  });
}
