import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GameHistoryEntry } from "@/features/game-night/lib/rankGameNightGames";

// Historie voor de hele spellenkast (laatst gespeeld + aantal keer
// gespeeld per spel) in ÉÉN query, ongeacht hoeveel spellen er in de kast
// staan (sectie 29: geen N+1 per spel). Zelfde patroon als
// useTonightStats.ts: één brede select, aggregeren in een Map. Telt
// bewust alleen AFGERONDE spelsessies — een spel dat nu gepauzeerd/actief
// is telt pas mee als "gespeeld" zodra het is afgerond.
export function useGameHistoryStats() {
  return useQuery({
    queryKey: ["game-night", "game-history-stats"],
    queryFn: async (): Promise<Map<string, GameHistoryEntry>> => {
      const { data, error } = await supabase
        .from("game_night_game_sessions")
        .select("game_id, started_at")
        .eq("status", "completed");
      if (error) throw error;

      const stats = new Map<string, GameHistoryEntry>();
      for (const row of data ?? []) {
        const existing = stats.get(row.game_id);
        if (!existing) {
          stats.set(row.game_id, {
            lastPlayedAt: row.started_at,
            playCount: 1,
          });
          continue;
        }
        stats.set(row.game_id, {
          lastPlayedAt:
            !existing.lastPlayedAt || row.started_at > existing.lastPlayedAt
              ? row.started_at
              : existing.lastPlayedAt,
          playCount: existing.playCount + 1,
        });
      }
      return stats;
    },
    staleTime: 5 * 60 * 1000,
  });
}
