import { computeScoreboard } from "@/features/rainbow-six-siege/lib/scoring";
import { getCompletedR6Games } from "@/features/rainbow-six-siege/lib/matches";
import type {
  R6Challenge,
  R6Event,
  R6GameOperatorAssignment,
  R6Match,
  R6MatchPlayer,
  R6Operator,
  R6Player,
  R6ScoreRule,
  R6Session,
  R6SessionPlayer,
} from "@/features/rainbow-six-siege/types";

export type R6PlayerLifetimeTotals = {
  kills: number;
  deaths: number;
  assists: number;
  revives: number;
  headshots: number;
  wins: number;
  losses: number;
  draws: number;
  mvps: number;
  clutches: number;
  clutch1v2: number;
  clutch1v3: number;
  aces: number;
  challengesCompleted: number;
};

export type R6TopOperator = { id: string; name: string; count: number };

export type R6PlayerLifetimeStats = {
  player: R6Player;
  totalPoints: number;
  lanCount: number;
  gameCount: number;
  avgPointsPerLan: number;
  winCount: number;
  lastPlayedAt: string | null;
  totals: R6PlayerLifetimeTotals;
  gameWinRate: number;
  mostUsedAttacker: R6TopOperator | null;
  mostUsedDefender: R6TopOperator | null;
};

function emptyTotals(): R6PlayerLifetimeTotals {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    revives: 0,
    headshots: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    mvps: 0,
    clutches: 0,
    clutch1v2: 0,
    clutch1v3: 0,
    aces: 0,
    challengesCompleted: 0,
  };
}

type Acc = {
  player: R6Player;
  totalPoints: number;
  lanCount: number;
  gameCount: number;
  winCount: number;
  lastPlayedAt: string | null;
  totals: R6PlayerLifetimeTotals;
  attackerCounts: Map<string, number>;
  defenderCounts: Map<string, number>;
};

function topOperator(counts: Map<string, number>, operatorsById: Map<string, R6Operator>): R6TopOperator | null {
  let best: { id: string; count: number } | null = null;
  for (const [id, count] of counts) {
    if (!best || count > best.count) best = { id, count };
  }
  if (!best) return null;
  return { id: best.id, name: operatorsById.get(best.id)?.name ?? "Onbekend", count: best.count };
}

/**
 * Levenslange (over alle LAN-sessies heen) aggregatie per speler — hergebruikt
 * computeScoreboard per sessie (zodat er nergens een tweede, afwijkende
 * puntenberekening ontstaat) en telt de resultaten daarna simpelweg bij
 * elkaar op. Gebruikt zowel matchPlayers als events (via computeScoreboard),
 * dus geen dubbele telling tussen oude matchdata en live-eventdata.
 */
export function computeR6LifetimeStats(
  sessions: R6Session[],
  sessionPlayers: R6SessionPlayer[],
  matches: R6Match[],
  matchPlayers: R6MatchPlayer[],
  events: R6Event[],
  operatorAssignments: R6GameOperatorAssignment[],
  operators: R6Operator[],
  challenges: R6Challenge[],
  scoreRules: R6ScoreRule[],
): R6PlayerLifetimeStats[] {
  const operatorsById = new Map(operators.map((o) => [o.id, o]));
  const accByPlayer = new Map<string, Acc>();
  // Voor de operatorstatistieken-loop verderop: een operator-toewijzing op
  // een game die nooit is afgerond mag niet meetellen als "gebruikt" —
  // zie isR6GameCompleted.
  const completedMatchIds = new Set(getCompletedR6Games(matches).map((m) => m.id));

  function getAcc(player: R6Player): Acc {
    let acc = accByPlayer.get(player.id);
    if (!acc) {
      acc = {
        player,
        totalPoints: 0,
        lanCount: 0,
        gameCount: 0,
        winCount: 0,
        lastPlayedAt: null,
        totals: emptyTotals(),
        attackerCounts: new Map(),
        defenderCounts: new Map(),
      };
      accByPlayer.set(player.id, acc);
    }
    return acc;
  }

  for (const session of sessions) {
    const roster = sessionPlayers.filter((sp) => sp.session_id === session.id).map((sp) => sp.player);
    if (roster.length === 0) continue;

    const sessionMatches = matches.filter((m) => m.session_id === session.id);
    const sessionMatchIds = new Set(sessionMatches.map((m) => m.id));
    const sessionMatchPlayers = matchPlayers.filter((mp) => sessionMatchIds.has(mp.match_id));
    const sessionEvents = events.filter((e) => e.session_id === session.id);

    const scoreboard = computeScoreboard(roster, sessionMatches, sessionMatchPlayers, challenges, scoreRules, sessionEvents);

    // LAN-winnaar: strikte, unieke koploper (net als de sessie-brede
    // eindbonussen elders) — bij een gelijke stand of 0 punten wint niemand.
    let leaderId: string | null = null;
    let leaderPoints = 0;
    let tied = false;
    for (const entry of scoreboard) {
      if (entry.totalPoints <= 0) continue;
      if (entry.totalPoints > leaderPoints) {
        leaderPoints = entry.totalPoints;
        leaderId = entry.player.id;
        tied = false;
      } else if (entry.totalPoints === leaderPoints) {
        tied = true;
      }
    }

    for (const entry of scoreboard) {
      const acc = getAcc(entry.player);
      acc.totalPoints += entry.totalPoints;
      acc.lanCount += 1;
      acc.gameCount += getCompletedR6Games(sessionMatches).length;
      if (leaderId === entry.player.id && !tied) acc.winCount += 1;
      const lastDate = session.ended_at ?? session.started_at;
      if (!acc.lastPlayedAt || lastDate > acc.lastPlayedAt) acc.lastPlayedAt = lastDate;

      acc.totals.kills += entry.totals.kills;
      acc.totals.deaths += entry.totals.deaths;
      acc.totals.assists += entry.totals.assists;
      acc.totals.revives += entry.totals.revives;
      acc.totals.headshots += entry.totals.headshots;
      acc.totals.wins += entry.totals.wins;
      acc.totals.losses += entry.totals.losses;
      acc.totals.draws += entry.totals.draws;
      acc.totals.mvps += entry.totals.mvps;
      acc.totals.clutches += entry.totals.clutches;
      acc.totals.clutch1v2 += entry.totals.clutch1v2;
      acc.totals.clutch1v3 += entry.totals.clutch1v3;
      acc.totals.aces += entry.totals.aces;
      acc.totals.challengesCompleted += entry.totals.challengesCompleted;
    }
  }

  for (const assignment of operatorAssignments) {
    if (!completedMatchIds.has(assignment.match_id)) continue;
    const acc = accByPlayer.get(assignment.player_id);
    if (!acc) continue;
    if (assignment.attacker_operator_id) {
      acc.attackerCounts.set(assignment.attacker_operator_id, (acc.attackerCounts.get(assignment.attacker_operator_id) ?? 0) + 1);
    }
    if (assignment.defender_operator_id) {
      acc.defenderCounts.set(assignment.defender_operator_id, (acc.defenderCounts.get(assignment.defender_operator_id) ?? 0) + 1);
    }
  }

  return Array.from(accByPlayer.values())
    .map((acc) => {
      const decided = acc.totals.wins + acc.totals.losses + acc.totals.draws;
      return {
        player: acc.player,
        totalPoints: acc.totalPoints,
        lanCount: acc.lanCount,
        gameCount: acc.gameCount,
        avgPointsPerLan: acc.lanCount > 0 ? acc.totalPoints / acc.lanCount : 0,
        winCount: acc.winCount,
        lastPlayedAt: acc.lastPlayedAt,
        totals: acc.totals,
        gameWinRate: decided > 0 ? (acc.totals.wins / decided) * 100 : 0,
        mostUsedAttacker: topOperator(acc.attackerCounts, operatorsById),
        mostUsedDefender: topOperator(acc.defenderCounts, operatorsById),
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
