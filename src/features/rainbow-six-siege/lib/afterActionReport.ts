import type { R6Map, R6Match, R6MatchPlayer, R6Operator, R6ScoreboardEntry } from "@/features/rainbow-six-siege/types";

// Centraal configureerbare ondergrens: een map moet minstens dit vaak
// gespeeld zijn binnen de sessie voordat hij als "beste"/"slechtste map"
// wordt aangemerkt — voorkomt dat één toevallige overwinning op een map die
// maar één keer gespeeld is meteen "beste map" wordt.
export const MIN_MATCHES_FOR_MAP_RANKING = 3;

export type R6MapStat = {
  mapId: string;
  mapName: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0-1
};

export type R6OperatorHighlight = {
  operatorId: string;
  operatorName: string;
  count: number;
};

export type R6PlayerOperatorSummary = {
  playerId: string;
  playerName: string;
  mostPlayedAttacker: R6OperatorHighlight | null;
  mostPlayedDefender: R6OperatorHighlight | null;
};

export type R6ChallengeSummary = {
  challengeId: string;
  challengeName: string;
  timesPlayed: number;
  timesCompleted: number;
};

export type R6ChaosSummary = {
  label: string;
  timesUsed: number;
};

export type R6FunnyMoment = {
  matchNumber: number;
  playedAt: string;
  text: string;
};

/** Telt win/loss/draw en berekent winrate per map — "unknown"-resultaten
 * tellen mee als gespeeld maar niet als win/loss/draw. */
export function computeMapStats(matches: R6Match[], maps: Map<string, R6Map>): R6MapStat[] {
  const byMap = new Map<string, { wins: number; losses: number; draws: number; played: number }>();
  for (const match of matches) {
    if (!match.map_id) continue;
    const entry = byMap.get(match.map_id) ?? { wins: 0, losses: 0, draws: 0, played: 0 };
    entry.played += 1;
    if (match.result === "win") entry.wins += 1;
    else if (match.result === "loss") entry.losses += 1;
    else if (match.result === "draw") entry.draws += 1;
    byMap.set(match.map_id, entry);
  }

  return Array.from(byMap.entries()).map(([mapId, stat]) => {
    const decided = stat.wins + stat.losses + stat.draws;
    return {
      mapId,
      mapName: maps.get(mapId)?.name ?? mapId,
      played: stat.played,
      wins: stat.wins,
      losses: stat.losses,
      draws: stat.draws,
      winRate: decided > 0 ? stat.wins / decided : 0,
    };
  });
}

export function findBestAndWorstMap(mapStats: R6MapStat[]): { best: R6MapStat | null; worst: R6MapStat | null } {
  const eligible = mapStats.filter((m) => m.played >= MIN_MATCHES_FOR_MAP_RANKING);
  if (eligible.length === 0) return { best: null, worst: null };
  const sorted = [...eligible].sort((a, b) => b.winRate - a.winRate);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function mostPlayedMap(mapStats: R6MapStat[]): R6MapStat | null {
  if (mapStats.length === 0) return null;
  return [...mapStats].sort((a, b) => b.played - a.played)[0];
}

/** Meest gespeelde attacker/defender per speler. operator_single_id wordt
 * meegeteld op de zijde die de operator zelf heeft (opgezocht via
 * `operators`), zodat "maar één zijde gespeeld"-registraties ook meetellen. */
export function computePlayerOperatorSummaries(
  players: { id: string; name: string }[],
  matchPlayers: R6MatchPlayer[],
  operators: Map<string, R6Operator>,
): R6PlayerOperatorSummary[] {
  return players.map((player) => {
    const attackerCounts = new Map<string, number>();
    const defenderCounts = new Map<string, number>();

    for (const row of matchPlayers) {
      if (row.player_id !== player.id) continue;
      if (row.operator_attacker_id) {
        attackerCounts.set(row.operator_attacker_id, (attackerCounts.get(row.operator_attacker_id) ?? 0) + 1);
      }
      if (row.operator_defender_id) {
        defenderCounts.set(row.operator_defender_id, (defenderCounts.get(row.operator_defender_id) ?? 0) + 1);
      }
      if (row.operator_single_id) {
        const side = operators.get(row.operator_single_id)?.side;
        const counts = side === "defender" ? defenderCounts : attackerCounts;
        counts.set(row.operator_single_id, (counts.get(row.operator_single_id) ?? 0) + 1);
      }
    }

    function topEntry(counts: Map<string, number>): R6OperatorHighlight | null {
      let best: R6OperatorHighlight | null = null;
      for (const [operatorId, count] of counts) {
        if (!best || count > best.count) {
          best = { operatorId, operatorName: operators.get(operatorId)?.name ?? operatorId, count };
        }
      }
      return best;
    }

    return {
      playerId: player.id,
      playerName: player.name,
      mostPlayedAttacker: topEntry(attackerCounts),
      mostPlayedDefender: topEntry(defenderCounts),
    };
  });
}

export function computeChallengeSummaries(matches: R6Match[], challenges: Map<string, { name: string }>): R6ChallengeSummary[] {
  const byChallenge = new Map<string, { played: number; completed: number }>();
  for (const match of matches) {
    if (!match.challenge_id) continue;
    const entry = byChallenge.get(match.challenge_id) ?? { played: 0, completed: 0 };
    entry.played += 1;
    if (match.challenge_completed) entry.completed += 1;
    byChallenge.set(match.challenge_id, entry);
  }
  return Array.from(byChallenge.entries()).map(([challengeId, stat]) => ({
    challengeId,
    challengeName: challenges.get(challengeId)?.name ?? challengeId,
    timesPlayed: stat.played,
    timesCompleted: stat.completed,
  }));
}

export function computeChaosSummaries(matches: R6Match[]): R6ChaosSummary[] {
  const byLabel = new Map<string, number>();
  for (const match of matches) {
    if (!match.chaos_rule) continue;
    byLabel.set(match.chaos_rule, (byLabel.get(match.chaos_rule) ?? 0) + 1);
  }
  return Array.from(byLabel.entries()).map(([label, timesUsed]) => ({ label, timesUsed }));
}

export function collectFunnyMoments(matches: R6Match[]): R6FunnyMoment[] {
  return matches
    .filter((m) => !!m.funniest_moment)
    .sort((a, b) => a.match_number - b.match_number)
    .map((m) => ({ matchNumber: m.match_number, playedAt: m.played_at, text: m.funniest_moment! }));
}

export type R6HighlightEntry = { label: string; playerName: string; value: number };

/** "Hoogtepunten": per stat de speler met de hoogste waarde (voor weergave,
 * niet voor puntentelling — die regel (bij een gelijke stand geen bonus)
 * geldt alleen voor scoring.ts; hier tonen we gewoon de koploper, ook bij
 * een gelijke stand, puur informatief). */
export function computeHighlights(entries: R6ScoreboardEntry[]): R6HighlightEntry[] {
  const stats: { label: string; pick: (e: R6ScoreboardEntry) => number }[] = [
    { label: "Meeste kills", pick: (e) => e.totals.kills },
    { label: "Meeste headshots", pick: (e) => e.totals.headshots },
    { label: "Meeste assists", pick: (e) => e.totals.assists },
    { label: "Meeste revives", pick: (e) => e.totals.revives },
    { label: "Meeste MVP's", pick: (e) => e.totals.mvps },
    { label: "Meeste clutches", pick: (e) => e.totals.clutches },
    { label: "Meeste aces", pick: (e) => e.totals.aces },
  ];

  const highlights: R6HighlightEntry[] = [];
  for (const stat of stats) {
    let best: R6ScoreboardEntry | null = null;
    let bestValue = 0;
    for (const entry of entries) {
      const value = stat.pick(entry);
      if (value > bestValue) {
        bestValue = value;
        best = entry;
      }
    }
    if (best) highlights.push({ label: stat.label, playerName: best.player.name, value: bestValue });
  }
  return highlights;
}

/**
 * Deterministische, lokaal opgebouwde tekstsamenvatting — geen externe
 * AI-API, geen verzonnen feiten: elke zin gebruikt alleen wat daadwerkelijk
 * berekend is, en zinnen worden overgeslagen als de onderliggende data
 * ontbreekt (bv. geen enkele map met genoeg matches voor "beste map").
 */
export function buildSummaryText(input: {
  scoreboard: R6ScoreboardEntry[];
  bestMap: R6MapStat | null;
  highlights: R6HighlightEntry[];
}): string {
  const sentences: string[] = [];
  const { scoreboard, bestMap, highlights } = input;

  const winner = scoreboard[0];
  const runnerUp = scoreboard[1];
  if (winner) {
    const isSharedWin = runnerUp && runnerUp.totalPoints === winner.totalPoints;
    if (isSharedWin) {
      sentences.push(`${winner.player.name} en ${runnerUp.player.name} eindigden gedeeld op de eerste plaats met ${winner.totalPoints} punten.`);
    } else {
      const winnerHighlights = highlights.filter((h) => h.playerName === winner.player.name).map((h) => h.label.toLowerCase());
      const highlightText = winnerHighlights.length > 0 ? ` dankzij ${winnerHighlights.slice(0, 2).join(" en ")}` : "";
      sentences.push(`${winner.player.name} pakte de eindwinst met ${winner.totalPoints} punten${highlightText}.`);
    }
  }

  if (bestMap) {
    sentences.push(
      `${bestMap.mapName} was met ${bestMap.wins} overwinning${bestMap.wins === 1 ? "" : "en"} uit ${bestMap.played} de succesvolste map van de avond.`,
    );
  }

  if (sentences.length === 0) {
    return "Nog niet genoeg gegevens voor een samenvatting van deze LAN.";
  }
  return sentences.join(" ");
}
