import { useQuery } from "@tanstack/react-query";
import { fetchR6DataForSessions, fetchR6Sessions } from "@/features/rainbow-six-siege/lib/sessions";
import { fetchR6Challenges, fetchR6ScoreRules } from "@/features/rainbow-six-siege/lib/reference";
import { computeScoreboard, FALLBACK_SCORE_RULES } from "@/features/rainbow-six-siege/lib/scoring";
import { countCompletedR6Games } from "@/features/rainbow-six-siege/lib/matches";
import type { R6Session, R6ScoreboardEntry } from "@/features/rainbow-six-siege/types";

export type R6SessionSummary = {
  session: R6Session;
  matchCount: number;
  scoreboard: R6ScoreboardEntry[];
};

/**
 * Alle afgeronde LAN's + hun scorebord-samenvatting (matchcount, ranglijst)
 * in een vaste, kleine set queries — niet N+1 per kaart in de historielijst.
 */
export function useR6History() {
  return useQuery({
    queryKey: ["r6_history"],
    queryFn: async (): Promise<R6SessionSummary[]> => {
      const [sessions, challenges, scoreRules] = await Promise.all([
        fetchR6Sessions(),
        fetchR6Challenges(),
        // Zelfde noodvangnet als useR6ScoreRules: bij een fout of lege
        // tabel terugvallen op FALLBACK_SCORE_RULES i.p.v. laten falen.
        fetchR6ScoreRules().catch(() => []),
      ]);
      const activeRules = scoreRules.length > 0 ? scoreRules : FALLBACK_SCORE_RULES;
      const ended = sessions.filter((s) => s.status === "completed");
      const { matches, matchPlayers, sessionPlayers, events } = await fetchR6DataForSessions(ended.map((s) => s.id));

      return ended.map((session) => {
        const players = sessionPlayers.filter((sp) => sp.session_id === session.id).map((sp) => sp.player);
        const sessionMatches = matches.filter((m) => m.session_id === session.id);
        const sessionMatchIds = new Set(sessionMatches.map((m) => m.id));
        const sessionMatchPlayers = matchPlayers.filter((mp) => sessionMatchIds.has(mp.match_id));
        const sessionEvents = events.filter((e) => e.session_id === session.id);

        return {
          session,
          matchCount: countCompletedR6Games(sessionMatches),
          scoreboard: computeScoreboard(players, sessionMatches, sessionMatchPlayers, challenges, activeRules, sessionEvents),
        };
      });
    },
  });
}
