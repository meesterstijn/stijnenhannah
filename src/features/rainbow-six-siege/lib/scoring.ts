import type { R6Challenge, R6Event, R6Match, R6MatchPlayer, R6Player, R6ScoreboardEntry, R6ScoreRule } from "@/features/rainbow-six-siege/types";

// ── Bron van waarheid voor puntenwaarden ─────────────────────────────────
// Sinds fase 2.2 is dat de `r6_score_rules`-tabel in Supabase (via
// useR6ScoreRules), NIET meer een hardcoded object hier. Deze module bevat
// alleen nog de BEREKENING — computeScoreboard krijgt de actieve regels als
// parameter mee en leest nergens meer een eigen ingebakken puntenwaarde.
//
// FALLBACK_SCORE_RULES hieronder is UITSLUITEND een noodvangnet voor als de
// r6_score_rules-tabel tijdelijk niet geladen kan worden (netwerkfout, lege
// tabel) — useR6ScoreRules() schakelt hier expliciet en zichtbaar naar over
// (usingFallback: true) zodat dit nooit stilzwijgend afwijkende puntwaarden
// oplevert. De waarden hier MOETEN exact gelijk blijven aan de seed in
// supabase/migrations/20260807000000_r6_score_rules.sql +
// 20260808000000_r6_quick_action_rules.sql.
export const FALLBACK_SCORE_RULES: R6ScoreRule[] = [
  { id: "fallback-mvp", code: "mvp", name: "MVP", description: null, category: "direct", points: 2, icon: "🏅", color: "amber", is_quick_action: true, is_active: true, sort_order: 1 },
  { id: "fallback-clutch", code: "clutch", name: "Clutch", description: null, category: "direct", points: 3, icon: "⚔️", color: "violet", is_quick_action: true, is_active: true, sort_order: 2 },
  { id: "fallback-ace", code: "ace", name: "Ace", description: null, category: "direct", points: 5, icon: "💥", color: "amber", is_quick_action: true, is_active: true, sort_order: 3 },
  { id: "fallback-most_kills", code: "most_kills", name: "Meeste kills", description: null, category: "end_bonus", points: 1, icon: null, color: null, is_quick_action: false, is_active: true, sort_order: 4 },
  { id: "fallback-most_headshots", code: "most_headshots", name: "Meeste headshots", description: null, category: "end_bonus", points: 1, icon: null, color: null, is_quick_action: false, is_active: true, sort_order: 5 },
  { id: "fallback-most_assists", code: "most_assists", name: "Meeste assists", description: null, category: "end_bonus", points: 1, icon: null, color: null, is_quick_action: false, is_active: true, sort_order: 6 },
  { id: "fallback-most_revives", code: "most_revives", name: "Meeste revives", description: null, category: "end_bonus", points: 2, icon: null, color: null, is_quick_action: false, is_active: true, sort_order: 7 },
  { id: "fallback-kill", code: "kill", name: "Kill", description: null, category: "direct", points: 1, icon: "🔫", color: "emerald", is_quick_action: true, is_active: true, sort_order: 10 },
  { id: "fallback-headshot", code: "headshot", name: "Headshot", description: null, category: "direct", points: 1, icon: "🎯", color: "amber", is_quick_action: true, is_active: true, sort_order: 11 },
  { id: "fallback-assist", code: "assist", name: "Assist", description: null, category: "direct", points: 1, icon: "🤝", color: "sky", is_quick_action: true, is_active: true, sort_order: 12 },
  { id: "fallback-revive", code: "revive", name: "Revive", description: null, category: "direct", points: 2, icon: "💉", color: "emerald", is_quick_action: true, is_active: true, sort_order: 13 },
  { id: "fallback-death", code: "death", name: "Death", description: null, category: "direct", points: 0, icon: "💀", color: "zinc", is_quick_action: true, is_active: true, sort_order: 14 },
  { id: "fallback-clutch_1v2", code: "clutch_1v2", name: "1v2", description: null, category: "direct", points: 3, icon: "⚔️", color: "violet", is_quick_action: true, is_active: true, sort_order: 15 },
  { id: "fallback-clutch_1v3", code: "clutch_1v3", name: "1v3", description: null, category: "direct", points: 5, icon: "🔥", color: "violet", is_quick_action: true, is_active: true, sort_order: 16 },
  { id: "fallback-challenge_bonus", code: "challenge_bonus", name: "Challenge", description: null, category: "direct", points: 2, icon: "✅", color: "sky", is_quick_action: true, is_active: true, sort_order: 17 },
];

/** Challengepunten blijven bewust op r6_challenges.bonus_points (per-challenge
 * instelbaar) — geen tweede bron van waarheid in r6_score_rules. */
export const CHALLENGE_COMPLETED_FALLBACK_POINTS = 2;

function rulePoints(rules: R6ScoreRule[], code: string): number {
  const rule = rules.find((r) => r.code === code && r.is_active);
  return rule?.points ?? 0;
}

function emptyTotals() {
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
    aces: 0,
    challengesCompleted: 0,
  };
}

function emptyBonuses(): R6ScoreboardEntry["bonuses"] {
  return { mostKills: false, mostHeadshots: false, mostAssists: false, mostRevives: false };
}

// Welk totals-veld een event-tik ophoogt — puur voor weergave/eindbonussen,
// niet voor de directe punten zelf (die komen 1-op-1 uit
// event.points_awarded, de bevroren momentopname op het moment van tikken).
const EVENT_TOTALS_KEY: Record<string, keyof ReturnType<typeof emptyTotals> | undefined> = {
  kill: "kills",
  headshot: "headshots",
  assist: "assists",
  revive: "revives",
  death: "deaths",
  clutch: "clutches",
  clutch_1v2: "clutches",
  clutch_1v3: "clutches",
  ace: "aces",
  mvp: "mvps",
  challenge_bonus: "challengesCompleted",
};

/**
 * Berekent het volledige scorebord van een sessie uit de ruwe match-,
 * match-player- én event-rijen — er wordt nergens een totaalscore
 * opgeslagen, alles wordt hieruit afgeleid (voorkomt dubbele opslag /
 * drift met de brondata). `scoreRules` moet de actief-geladen (of
 * expliciet fallback-)regels zijn — zie useR6ScoreRules. Werkt identiek
 * voor een live sessie (dan zijn bonusPoints "voorlopig") en een
 * afgeronde sessie (dan zijn ze "definitief") — dat label bepaalt de UI,
 * niet deze berekening.
 *
 * `events` is de nieuwe, primaire databron voor het live-tik-dashboard;
 * `matchPlayers` blijft de bestaande databron voor rondes die (nog) via
 * het klassieke matchformulier zijn ingevoerd/bewerkt (Geschiedenis-tab).
 * Beide worden hier bij elkaar opgeteld, zodat een sessie die beide
 * gebruikt (bv. oude rondes via het formulier, nieuwe via het live
 * dashboard) één correct, samengevoegd totaal krijgt.
 */
export function computeScoreboard(
  players: R6Player[],
  matches: R6Match[],
  matchPlayers: R6MatchPlayer[],
  challenges: R6Challenge[],
  scoreRules: R6ScoreRule[],
  events: R6Event[] = [],
): R6ScoreboardEntry[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const challengeById = new Map(challenges.map((c) => [c.id, c]));

  const totalsByPlayer = new Map<string, ReturnType<typeof emptyTotals>>();
  const directPointsByPlayer = new Map<string, number>();
  for (const player of players) {
    totalsByPlayer.set(player.id, emptyTotals());
    directPointsByPlayer.set(player.id, 0);
  }

  const addDirect = (playerId: string, amount: number) => {
    directPointsByPlayer.set(playerId, (directPointsByPlayer.get(playerId) ?? 0) + amount);
  };

  for (const row of matchPlayers) {
    const totals = totalsByPlayer.get(row.player_id);
    if (!totals) continue; // speler niet (meer) in het sessie-overzicht

    const match = matchById.get(row.match_id);

    totals.kills += row.kills;
    totals.deaths += row.deaths;
    totals.assists += row.assists;
    totals.revives += row.revives;
    totals.headshots += row.headshots;
    if (match?.result === "win") totals.wins += 1;
    else if (match?.result === "loss") totals.losses += 1;
    else if (match?.result === "draw") totals.draws += 1;
    if (row.clutch) totals.clutches += 1;
    if (row.ace) totals.aces += 1;

    // Bewust geen punten voor match.result — zie toelichting in scoring.ts.
    if (row.clutch) addDirect(row.player_id, rulePoints(scoreRules, "clutch"));
    if (row.ace) addDirect(row.player_id, rulePoints(scoreRules, "ace"));

    if (match?.challenge_completed && match.challenge_id) {
      totals.challengesCompleted += 1;
      const challenge = challengeById.get(match.challenge_id);
      addDirect(row.player_id, challenge?.bonus_points ?? CHALLENGE_COMPLETED_FALLBACK_POINTS);
    }
  }

  // MVP is sinds fase 2.2 een match-level veld (hoogstens één per match),
  // dus apart per match toegekend i.p.v. per match_player-rij. (Blijft
  // relevant voor rondes die via het klassieke matchformulier zijn
  // ingevuld; het live dashboard kent MVP toe via een 'mvp'-event.)
  // `match.mvp_points` is een optionele, per-match override (zie
  // R6EndGameSheet) — null betekent "gebruik de actuele, globale mvp-regel",
  // net als voorheen.
  for (const match of matches) {
    if (!match.mvp_player_id) continue;
    const totals = totalsByPlayer.get(match.mvp_player_id);
    if (!totals) continue;
    totals.mvps += 1;
    addDirect(match.mvp_player_id, match.mvp_points ?? rulePoints(scoreRules, "mvp"));
  }

  // Live-tik-gebeurtenissen: directe punten komen 1-op-1 uit de bevroren
  // points_awarded van elk event, niet uit een nieuwe opzoeking van de
  // huidige regel — zo verandert het aanpassen van een puntenwaarde nooit
  // met terugwerkende kracht al getikte gebeurtenissen.
  for (const event of events) {
    const totals = totalsByPlayer.get(event.player_id);
    if (!totals) continue;
    addDirect(event.player_id, event.points_awarded);
    const key = EVENT_TOTALS_KEY[event.score_rule_code];
    if (key) totals[key] += 1;
  }

  // "Meeste X van de sessie"-eindbonussen: alleen toegekend aan een
  // strikte, unieke koploper — bij een gelijke stand krijgt niemand hem.
  const bonusesByPlayer = new Map<string, R6ScoreboardEntry["bonuses"]>();
  const bonusPointsByPlayer = new Map<string, number>();
  for (const player of players) {
    bonusesByPlayer.set(player.id, emptyBonuses());
    bonusPointsByPlayer.set(player.id, 0);
  }

  function awardLeaderBonus(stat: "kills" | "headshots" | "assists" | "revives", bonusKey: keyof R6ScoreboardEntry["bonuses"], code: string) {
    const points = rulePoints(scoreRules, code);
    let leaderId: string | null = null;
    let leaderValue = 0;
    let tied = false;
    for (const [playerId, totals] of totalsByPlayer) {
      const value = totals[stat];
      if (value <= 0) continue;
      if (value > leaderValue) {
        leaderValue = value;
        leaderId = playerId;
        tied = false;
      } else if (value === leaderValue) {
        tied = true;
      }
    }
    if (leaderId && !tied) {
      bonusesByPlayer.get(leaderId)![bonusKey] = true;
      bonusPointsByPlayer.set(leaderId, (bonusPointsByPlayer.get(leaderId) ?? 0) + points);
    }
  }

  awardLeaderBonus("kills", "mostKills", "most_kills");
  awardLeaderBonus("headshots", "mostHeadshots", "most_headshots");
  awardLeaderBonus("assists", "mostAssists", "most_assists");
  awardLeaderBonus("revives", "mostRevives", "most_revives");

  const entries: R6ScoreboardEntry[] = players.map((player) => {
    const directPoints = directPointsByPlayer.get(player.id) ?? 0;
    const bonusPoints = bonusPointsByPlayer.get(player.id) ?? 0;
    return {
      player,
      directPoints,
      bonusPoints,
      totalPoints: directPoints + bonusPoints,
      totals: totalsByPlayer.get(player.id) ?? emptyTotals(),
      bonuses: bonusesByPlayer.get(player.id) ?? emptyBonuses(),
    };
  });

  return entries.sort((a, b) => b.totalPoints - a.totalPoints);
}
