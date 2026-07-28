import { useQuery } from "@tanstack/react-query";
import { fetchR6DataForSessions, fetchR6Sessions } from "@/features/rainbow-six-siege/lib/sessions";
import { fetchR6Challenges, fetchR6Operators, fetchR6ScoreRules } from "@/features/rainbow-six-siege/lib/reference";
import { fetchR6GameOperatorAssignmentsForMatches } from "@/features/rainbow-six-siege/lib/operatorWheel";
import { computeR6LifetimeStats } from "@/features/rainbow-six-siege/lib/lifetimeStats";
import { FALLBACK_SCORE_RULES } from "@/features/rainbow-six-siege/lib/scoring";
import type {
  R6Challenge,
  R6Event,
  R6GameOperatorAssignment,
  R6Match,
  R6MatchPlayer,
  R6Operator,
  R6ScoreRule,
  R6Session,
  R6SessionPlayer,
} from "@/features/rainbow-six-siege/types";

// Alle ruwe ingrediënten worden ook teruggegeven (niet alleen de
// vooraf-berekende `stats` over ALLE sessies) — zo kunnen de Scorebord- en
// Statistiekenpagina's zelf opnieuw filteren (bv. op één specifieke LAN of
// periode) en `computeR6LifetimeStats` daarna herbruiken op de gefilterde
// sessieselectie, zonder een tweede, afwijkende berekening te hoeven
// schrijven.
export type R6LifetimeData = {
  sessions: R6Session[];
  sessionPlayers: R6SessionPlayer[];
  matches: R6Match[];
  matchPlayers: R6MatchPlayer[];
  events: R6Event[];
  operatorAssignments: R6GameOperatorAssignment[];
  operators: R6Operator[];
  challenges: R6Challenge[];
  scoreRules: R6ScoreRule[];
  stats: ReturnType<typeof computeR6LifetimeStats>;
};

/**
 * Eén brede fetch + berekening voor zowel de Scorebordpagina als de
 * Statistiekenpagina — beide willen "over alle LAN-sessies heen" data, dus
 * geen aparte, mogelijk-afwijkende query per pagina. Alle ruwe (niet-
 * geaggregeerde) data wordt ook teruggegeven, zodat de Statistiekenpagina
 * daar zelf nog grafieken/records uit kan afleiden zonder alles opnieuw op
 * te vragen.
 */
export function useR6LifetimeStats() {
  return useQuery({
    queryKey: ["r6_lifetime_stats"],
    queryFn: async (): Promise<R6LifetimeData> => {
      const [sessions, challenges, scoreRules, operators] = await Promise.all([
        fetchR6Sessions(),
        fetchR6Challenges(),
        fetchR6ScoreRules().catch(() => []),
        fetchR6Operators(),
      ]);
      const activeRules = scoreRules.length > 0 ? scoreRules : FALLBACK_SCORE_RULES;
      const { matches, matchPlayers, sessionPlayers, events } = await fetchR6DataForSessions(sessions.map((s) => s.id));
      const operatorAssignments = await fetchR6GameOperatorAssignmentsForMatches(matches.map((m) => m.id));

      const stats = computeR6LifetimeStats(
        sessions,
        sessionPlayers,
        matches,
        matchPlayers,
        events,
        operatorAssignments,
        operators,
        challenges,
        activeRules,
      );

      return { sessions, sessionPlayers, matches, matchPlayers, events, operatorAssignments, operators, challenges, scoreRules: activeRules, stats };
    },
  });
}
