import type {
  R6Event,
  R6GameOperatorAssignment,
  R6Match,
  R6MatchPlayer,
  R6SessionChaosEffect,
} from "@/features/rainbow-six-siege/types";

/**
 * De ENE plek die bepaalt of een game "gespeeld" telt. Een game telt pas
 * mee zodra er een definitief gezamenlijk resultaat is vastgelegd — het
 * bestaan van een r6_matches-rij alleen is onvoldoende, want startR6Round
 * maakt na iedere afgeronde game automatisch een lege "volgende game" aan
 * (result: "unknown", zie de DB-default) zodat er tijdens het live spelen
 * altijd meteen een actieve match klaarstaat om op te tikken. Als de LAN
 * wordt beëindigd terwijl die laatste game nooit is afgerond, mag hij dus
 * nergens meetellen in geschiedenis/statistieken — ook niet via
 * matches.length of de hoogste match_number, die allebei die lege game
 * gewoon meetellen.
 *
 * Gebruik dit overal waar "aantal gespeelde games" nodig is, in plaats van
 * losse array.length- of match_number-logica opnieuw uit te vinden.
 */
export function isR6GameCompleted(match: R6Match): boolean {
  return match.result === "win" || match.result === "loss" || match.result === "draw";
}

export function getCompletedR6Games(matches: R6Match[]): R6Match[] {
  return matches.filter(isR6GameCompleted);
}

export function countCompletedR6Games(matches: R6Match[]): number {
  return getCompletedR6Games(matches).length;
}

/**
 * True als een niet-afgeronde match volledig leeg is — geen enkel spoor
 * van gebruik, dus veilig om stilzwijgend op te ruimen bij het beëindigen
 * van een LAN (zie shouldDeleteEmptyR6MatchOnSessionEnd). Een match met
 * ÓÓK maar één van deze dingen (een tik, een MVP, een gekozen map, een
 * operator-toewijzing, een chaos-effect, een notitie) telt NIET als leeg —
 * die moet blijven staan, alleen buiten de gespeelde-games-statistieken.
 */
export function isR6MatchEmpty(
  match: R6Match,
  related: {
    events: R6Event[];
    matchPlayers: R6MatchPlayer[];
    operatorAssignments: R6GameOperatorAssignment[];
    sessionChaosEffects: R6SessionChaosEffect[];
  },
): boolean {
  if (isR6GameCompleted(match)) return false;
  if (match.map_id) return false;
  if (match.mvp_player_id) return false;
  if (match.notes) return false;
  if (match.funniest_moment) return false;
  if (match.chaos_rule) return false;
  if (match.challenge_id) return false;
  if (related.events.some((e) => e.match_id === match.id)) return false;
  if (related.matchPlayers.some((mp) => mp.match_id === match.id)) return false;
  if (related.operatorAssignments.some((a) => a.match_id === match.id)) return false;
  if (related.sessionChaosEffects.some((c) => c.match_id === match.id)) return false;
  return true;
}

/** Het spiegelbeeld van isR6MatchEmpty: niet afgerond, maar ook niet leeg —
 * er staat al iets in dat niet stilzwijgend verwijderd mag worden. Gebruikt
 * om de waarschuwing bij "LAN beëindigen" te tonen. */
export function isR6MatchIncompleteWithData(
  match: R6Match,
  related: Parameters<typeof isR6MatchEmpty>[1],
): boolean {
  return !isR6GameCompleted(match) && !isR6MatchEmpty(match, related);
}

/**
 * Dev-only sanity check: voor een gegeven speler moet het aantal afgeronde
 * games waar die speler een match_player-rij voor heeft altijd exact gelijk
 * zijn aan zijn eigen wins+losses+draws — dat zijn twee onafhankelijk
 * afgeleide tellingen (de ene uit r6_matches.result, de andere via
 * computeScoreboard's matchPlayers-loop) die nooit uit elkaar mogen lopen.
 * Bewust NIET vergeleken tegen het totale aantal gespeelde games van de
 * hele sessie: een speler die pas halverwege de LAN meedeed heeft geen
 * match_player-rij voor de games daarvóór, dus dat zou hier ten onrechte
 * als mismatch afgaan.
 */
export function assertR6GameCountConsistency(
  playerCompletedGamesCount: number,
  wins: number,
  losses: number,
  draws: number,
  context: string,
): void {
  if (!import.meta.env.DEV) return;
  const total = wins + losses + draws;
  if (playerCompletedGamesCount !== total) {
    console.error(
      `R6 game count mismatch (${context}): afgeronde games met match_player-rij=${playerCompletedGamesCount}, maar wins+losses+draws=${total} (wins=${wins}, losses=${losses}, draws=${draws})`,
    );
  }
}
