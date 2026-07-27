import type {
  R6MatchPlayerInput,
  R6MatchResult,
  R6NewMatchInput,
  R6UpdateMatchInput,
} from "@/features/rainbow-six-siege/types";

// Formulier-state houdt getallen als string (leeg = niet ingevuld) zodat een
// <Input type="number"> nooit gedwongen op "0" springt terwijl iemand nog
// aan het typen is. Geen `result`/`mvp` meer hier — dat zijn nu gezamenlijke
// velden op de match (zie R6MatchGeneralFormState), niet per speler.
export type R6MatchPlayerFormState = {
  playerId: string;
  operatorAttackerId: string;
  operatorDefenderId: string;
  operatorSingleId: string;
  kills: string;
  deaths: string;
  assists: string;
  revives: string;
  headshots: string;
  clutch: boolean;
  ace: boolean;
};

export function emptyR6MatchPlayerFormState(playerId: string): R6MatchPlayerFormState {
  return {
    playerId,
    operatorAttackerId: "",
    operatorDefenderId: "",
    operatorSingleId: "",
    kills: "",
    deaths: "",
    assists: "",
    revives: "",
    headshots: "",
    clutch: false,
    ace: false,
  };
}

function toNonNegativeInt(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildR6MatchPlayerInput(state: R6MatchPlayerFormState): R6MatchPlayerInput {
  return {
    player_id: state.playerId,
    operator_attacker_id: state.operatorAttackerId || null,
    operator_defender_id: state.operatorDefenderId || null,
    operator_single_id: state.operatorSingleId || null,
    kills: toNonNegativeInt(state.kills),
    deaths: toNonNegativeInt(state.deaths),
    assists: toNonNegativeInt(state.assists),
    revives: toNonNegativeInt(state.revives),
    headshots: toNonNegativeInt(state.headshots),
    clutch: state.clutch,
    ace: state.ace,
  };
}

export type R6MatchGeneralFormState = {
  mapId: string;
  result: R6MatchResult;
  challengeId: string;
  challengeCompleted: boolean;
  chaosRule: string;
  funniestMoment: string;
  notes: string;
  /** Hoogstens één officiële MVP per match — lege string = geen MVP. */
  mvpPlayerId: string;
  mvpReason: string;
  /** Override van de MVP-puntenwaarde (zie R6EndGameSheet) — dit formulier
   * heeft er geen eigen invoerveld voor, maar geeft een bestaande waarde
   * ongewijzigd door bij het opslaan, zodat een via "Gimma afronden" gezette
   * override niet stilzwijgend wordt teruggezet naar de globale mvp-regel
   * zodra iemand deze match later via dit formulier bewerkt. */
  mvpPoints: number | null;
};

export function buildR6NewMatchInput(
  sessionId: string,
  general: R6MatchGeneralFormState,
  players: R6MatchPlayerFormState[],
): R6NewMatchInput {
  return {
    session_id: sessionId,
    map_id: general.mapId || null,
    result: general.result,
    challenge_id: general.challengeId || null,
    challenge_completed: general.challengeId ? general.challengeCompleted : false,
    chaos_rule: general.chaosRule.trim() || null,
    funniest_moment: general.funniestMoment.trim() || null,
    notes: general.notes.trim() || null,
    mvp_player_id: general.mvpPlayerId || null,
    mvp_reason: general.mvpPlayerId ? general.mvpReason.trim() || null : null,
    mvp_points: general.mvpPlayerId ? general.mvpPoints : null,
    players: players.map(buildR6MatchPlayerInput),
  };
}

export function buildR6UpdateMatchInput(
  matchId: string,
  sessionId: string,
  general: R6MatchGeneralFormState,
  players: R6MatchPlayerFormState[],
): R6UpdateMatchInput {
  return { ...buildR6NewMatchInput(sessionId, general, players), match_id: matchId };
}
