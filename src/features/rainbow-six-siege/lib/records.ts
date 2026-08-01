import { computeMapStats } from "@/features/rainbow-six-siege/lib/afterActionReport";
import { computeScoreboard, rulePoints } from "@/features/rainbow-six-siege/lib/scoring";
import { getCompletedR6Games } from "@/features/rainbow-six-siege/lib/matches";
import type { R6LifetimeData } from "@/features/rainbow-six-siege/hooks/useR6LifetimeStats";
import type { R6Map, R6Operator } from "@/features/rainbow-six-siege/types";

export type R6Records = {
  highestSingleLan: { playerName: string; points: number; sessionName: string } | null;
  mostPointsSingleGame: { playerName: string; points: number; matchNumber: number; sessionName: string } | null;
  mostAcesSingleLan: { playerName: string; count: number; sessionName: string } | null;
  mostHeadshotsSingleLan: { playerName: string; count: number; sessionName: string } | null;
  mostClutchesSingleLan: { playerName: string; count: number; sessionName: string } | null;
  longestWinStreak: { playerName: string; streak: number } | null;
  mostRevivesSingleLan: { playerName: string; count: number; sessionName: string } | null;
  longestLan: { sessionName: string; minutes: number } | null;
  mostPlayedMap: { mapName: string; count: number } | null;
  mostUsedAttacker: { name: string; count: number } | null;
  mostUsedDefender: { name: string; count: number } | null;
};

/**
 * Records worden hier uit de ruwe data afgeleid, niet apart opgeslagen —
 * zelfde principe als het scorebord zelf (geen tweede bron van waarheid).
 * "Eén game"-records gebruiken alleen events (+ eventuele MVP-bonus op de
 * match), want dat is de enige databron die per individuele game (i.p.v.
 * per sessie) punten kent.
 */
export function computeR6Records(data: R6LifetimeData, maps: Map<string, R6Map>, operators: Map<string, R6Operator>): R6Records {
  // Records over "games" (i.p.v. over hele LAN's/spelers-totalen, die al via
  // computeScoreboard/entry.totalPoints lopen) mogen een nooit-afgeronde
  // game nooit meetellen — zie isR6GameCompleted.
  const completedMatches = getCompletedR6Games(data.matches);
  const completedMatchIds = new Set(completedMatches.map((m) => m.id));

  let highestSingleLan: R6Records["highestSingleLan"] = null;
  let mostAcesSingleLan: R6Records["mostAcesSingleLan"] = null;
  let mostHeadshotsSingleLan: R6Records["mostHeadshotsSingleLan"] = null;
  let mostClutchesSingleLan: R6Records["mostClutchesSingleLan"] = null;
  let mostRevivesSingleLan: R6Records["mostRevivesSingleLan"] = null;
  let longestLan: R6Records["longestLan"] = null;

  const streakByPlayer = new Map<string, { name: string; current: number; best: number }>();
  const sortedSessions = [...data.sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));

  for (const session of sortedSessions) {
    const roster = data.sessionPlayers.filter((sp) => sp.session_id === session.id).map((sp) => sp.player);
    if (roster.length === 0) continue;
    const sessionMatches = data.matches.filter((m) => m.session_id === session.id);
    const sessionMatchIds = new Set(sessionMatches.map((m) => m.id));
    const sessionMatchPlayers = data.matchPlayers.filter((mp) => sessionMatchIds.has(mp.match_id));
    const sessionEvents = data.events.filter((e) => e.session_id === session.id);
    const scoreboard = computeScoreboard(roster, sessionMatches, sessionMatchPlayers, data.challenges, data.scoreRules, sessionEvents);

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
      if (!highestSingleLan || entry.totalPoints > highestSingleLan.points) {
        highestSingleLan = { playerName: entry.player.name, points: entry.totalPoints, sessionName: session.name };
      }
      if (!mostAcesSingleLan || entry.totals.aces > mostAcesSingleLan.count) {
        mostAcesSingleLan = { playerName: entry.player.name, count: entry.totals.aces, sessionName: session.name };
      }
      if (!mostHeadshotsSingleLan || entry.totals.headshots > mostHeadshotsSingleLan.count) {
        mostHeadshotsSingleLan = { playerName: entry.player.name, count: entry.totals.headshots, sessionName: session.name };
      }
      if (!mostClutchesSingleLan || entry.totals.clutches > mostClutchesSingleLan.count) {
        mostClutchesSingleLan = { playerName: entry.player.name, count: entry.totals.clutches, sessionName: session.name };
      }
      if (!mostRevivesSingleLan || entry.totals.revives > mostRevivesSingleLan.count) {
        mostRevivesSingleLan = { playerName: entry.player.name, count: entry.totals.revives, sessionName: session.name };
      }

      const streak = streakByPlayer.get(entry.player.id) ?? { name: entry.player.name, current: 0, best: 0 };
      if (leaderId === entry.player.id && !tied) {
        streak.current += 1;
        streak.best = Math.max(streak.best, streak.current);
      } else {
        streak.current = 0;
      }
      streakByPlayer.set(entry.player.id, streak);
    }

    const durationMinutes = Math.round((new Date(session.ended_at ?? Date.now()).getTime() - new Date(session.started_at).getTime()) / 60000);
    if (!longestLan || durationMinutes > longestLan.minutes) {
      longestLan = { sessionName: session.name, minutes: durationMinutes };
    }
  }

  let mostPointsSingleGame: R6Records["mostPointsSingleGame"] = null;
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const playerNameById = new Map(data.sessionPlayers.map((sp) => [sp.player_id, sp.player.name]));
  for (const match of completedMatches) {
    const pointsByPlayer = new Map<string, number>();
    for (const event of data.events) {
      if (event.match_id !== match.id) continue;
      pointsByPlayer.set(event.player_id, (pointsByPlayer.get(event.player_id) ?? 0) + event.points_awarded);
    }
    if (match.mvp_player_id) {
      const mvpPoints = match.mvp_points ?? rulePoints(data.scoreRules, "mvp");
      pointsByPlayer.set(match.mvp_player_id, (pointsByPlayer.get(match.mvp_player_id) ?? 0) + mvpPoints);
    }
    for (const [playerId, points] of pointsByPlayer) {
      if (!mostPointsSingleGame || points > mostPointsSingleGame.points) {
        mostPointsSingleGame = {
          playerName: playerNameById.get(playerId) ?? "Onbekend",
          points,
          matchNumber: match.match_number,
          sessionName: sessionById.get(match.session_id)?.name ?? "Onbekende LAN",
        };
      }
    }
  }

  let longestWinStreak: R6Records["longestWinStreak"] = null;
  for (const streak of streakByPlayer.values()) {
    if (!longestWinStreak || streak.best > longestWinStreak.streak) {
      longestWinStreak = { playerName: streak.name, streak: streak.best };
    }
  }

  const mapStats = computeMapStats(completedMatches, maps);
  const mostPlayedMapStat = mapStats.length > 0 ? [...mapStats].sort((a, b) => b.played - a.played)[0] : null;
  const mostPlayedMap = mostPlayedMapStat ? { mapName: mostPlayedMapStat.mapName, count: mostPlayedMapStat.played } : null;

  const attackerCounts = new Map<string, number>();
  const defenderCounts = new Map<string, number>();
  for (const assignment of data.operatorAssignments) {
    if (!completedMatchIds.has(assignment.match_id)) continue;
    if (assignment.attacker_operator_id) {
      attackerCounts.set(assignment.attacker_operator_id, (attackerCounts.get(assignment.attacker_operator_id) ?? 0) + 1);
    }
    if (assignment.defender_operator_id) {
      defenderCounts.set(assignment.defender_operator_id, (defenderCounts.get(assignment.defender_operator_id) ?? 0) + 1);
    }
  }
  function topEntry(counts: Map<string, number>): { name: string; count: number } | null {
    let best: { id: string; count: number } | null = null;
    for (const [id, count] of counts) if (!best || count > best.count) best = { id, count };
    return best ? { name: operators.get(best.id)?.name ?? "Onbekend", count: best.count } : null;
  }

  return {
    highestSingleLan,
    mostPointsSingleGame,
    mostAcesSingleLan,
    mostHeadshotsSingleLan,
    mostClutchesSingleLan,
    longestWinStreak,
    mostRevivesSingleLan,
    longestLan,
    mostPlayedMap,
    mostUsedAttacker: topEntry(attackerCounts),
    mostUsedDefender: topEntry(defenderCounts),
  };
}
