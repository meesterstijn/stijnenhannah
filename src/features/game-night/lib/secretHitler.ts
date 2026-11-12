// Secret Hitler — spelmotor voor de Game Night-Arena.
//
// De host houdt het fysieke spel bij op het tafelscherm; de bron van
// waarheid is een append-only event-log per spelsessie
// (game_night_secret_hitler_events, zelfde patroon als win_events en de
// Mario Kart-punten: `undone_at` i.p.v. verwijderen). Deze module is puur:
// `buildSecretHitlerState` speelt de actieve events af en levert de hele
// spelstaat (beleidssporen, verkiezingsteller, stapel, wie president is,
// termijnlimieten, doden, onderzochten, bevestigd-geen-Hitler, claims,
// winnaar, rollen). Zo blijven ongedaan maken (laatste event markeren) en
// de telefoonweergave (zelfde events, zelfde motor) altijd consistent.
//
// Regels volgens de officiële spelregels (CC BY-NC-SA), zie
// docs/secret-hitler.md.

export type ShTeam = "liberal" | "fascist";
export type ShRole = "liberal" | "fascist" | "hitler";
export type ShPolicy = "L" | "F";
export type ShVote = "ja" | "nein";
export type ShPower = "investigate" | "peek" | "special_election" | "execute";
export type ShWinReason =
  | "liberal_policies"
  | "fascist_policies"
  | "hitler_elected"
  | "hitler_executed"
  | "declared";

export type ShPhase =
  | "setup"
  | "nominate"
  | "vote"
  | "hitler_check"
  | "legislate"
  | "chaos"
  | "power"
  | "game_over";

/** Aantal fascistische kaarten in de hand (president: 0-3, kanselier: 0-2). */
export type ShHandClaim = number;

export type ShEventPayload =
  | {
      type: "start";
      firstPresidentId: string;
      /** Zitvolgorde aan tafel (met de klok mee); standaard de spelersvolgorde. */
      seats?: string[];
    }
  | { type: "nominate"; chancellorId: string }
  | {
      type: "vote";
      passed: boolean;
      /** Per speler, mag onvolledig zijn (snelle invoer zonder details). */
      votes: Record<string, ShVote>;
    }
  | { type: "hitler_check"; isHitler: boolean }
  | {
      type: "enact";
      policy: ShPolicy;
      presidentClaim: ShHandClaim | null;
      chancellorClaim: ShHandClaim | null;
    }
  | { type: "veto" }
  | { type: "chaos"; policy: ShPolicy }
  | { type: "investigate"; targetId: string; claim: ShTeam | null }
  | { type: "peek"; claim: number | null }
  | { type: "special_election"; targetId: string }
  | { type: "execute"; targetId: string; wasHitler: boolean }
  | { type: "quote"; playerId: string | null; text: string }
  | { type: "declare_winner"; winner: ShTeam }
  | { type: "reveal"; roles: Record<string, ShRole> };

export type ShEventType = ShEventPayload["type"];

export type ShEvent = {
  id: string;
  created_at: string;
  undone_at?: string | null;
  payload: ShEventPayload;
};

export type ShClaimFlag =
  | "conflict"
  | "chancellor_impossible"
  | "president_impossible"
  | "chancellor_chose_fascist"
  | "president_discarded_liberal";

export type ShGovernment = {
  index: number;
  presidentId: string;
  chancellorId: string;
  specialElection: boolean;
  votes: Record<string, ShVote>;
  passed: boolean | null;
  hitlerCheck: boolean | null;
  policy: ShPolicy | null;
  vetoed: boolean;
  presidentClaim: ShHandClaim | null;
  chancellorClaim: ShHandClaim | null;
  flags: ShClaimFlag[];
  power: ShPowerUse | null;
  /** Fascistisch-spoorstand vóór deze regering (voor "danger zone"). */
  fascistPoliciesBefore: number;
  /** Aantal stemgerechtigden (levende spelers) bij deze verkiezing. */
  aliveCount: number;
};

export type ShPowerUse =
  | { power: "investigate"; targetId: string; claim: ShTeam | null }
  | { power: "peek"; claim: number | null }
  | { power: "special_election"; targetId: string }
  | { power: "execute"; targetId: string; wasHitler: boolean };

export type ShQuote = {
  eventId: string;
  playerId: string | null;
  text: string;
  round: number;
};

export type ShState = {
  seats: string[];
  playerCount: number;
  phase: ShPhase;
  presidentId: string | null;
  nomineeId: string | null;
  /** Anker voor de normale presidentsrotatie (negeert speciale verkiezingen). */
  regularPresidentId: string | null;
  specialElectionNextId: string | null;
  currentIsSpecial: boolean;
  lastElectedPresidentId: string | null;
  lastElectedChancellorId: string | null;
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number;
  drawPile: number;
  discardPile: number;
  reshuffles: number;
  dead: string[];
  investigated: string[];
  confirmedNotHitler: string[];
  pendingPower: ShPower | null;
  winner: ShTeam | null;
  winReason: ShWinReason | null;
  /** Bij een winst via Hitler: wie (gekozen of geëxecuteerd). */
  hitlerId: string | null;
  roles: Record<string, ShRole> | null;
  governments: ShGovernment[];
  chaosPolicies: ShPolicy[];
  quotes: ShQuote[];
  /** Events die niet pasten bij de fase (genegeerd, voor debugging). */
  ignoredEventIds: string[];
};

export const SH_TOTAL_LIBERAL = 6;
export const SH_TOTAL_FASCIST = 11;
export const SH_DECK_SIZE = SH_TOTAL_LIBERAL + SH_TOTAL_FASCIST;
export const SH_LIBERAL_TRACK = 5;
export const SH_FASCIST_TRACK = 6;
export const SH_MIN_PLAYERS = 5;
export const SH_MAX_PLAYERS = 10;

const LIBERAL_COUNT: Record<number, number> = {
  5: 3,
  6: 4,
  7: 4,
  8: 5,
  9: 5,
  10: 6,
};

/** Aantal liberalen / fascisten (excl. Hitler) per spelersaantal. */
export function roleDistribution(playerCount: number): {
  liberals: number;
  fascists: number;
} {
  const n = Math.min(SH_MAX_PLAYERS, Math.max(SH_MIN_PLAYERS, playerCount));
  const liberals = LIBERAL_COUNT[n];
  return { liberals, fascists: n - liberals - 1 };
}

/** Kent Hitler de andere fascisten? Alleen bij 5-6 spelers. */
export function hitlerKnowsFascists(playerCount: number): boolean {
  return playerCount <= 6;
}

/**
 * Presidentiële machten op het fascistische spoor (index 0 = eerste
 * fascistische wet). Het zesde vakje is de fascistische overwinning.
 */
export function fascistTrackPowers(playerCount: number): (ShPower | null)[] {
  if (playerCount <= 6) return [null, null, "peek", "execute", "execute"];
  if (playerCount <= 8)
    return [null, "investigate", "special_election", "execute", "execute"];
  return [
    "investigate",
    "investigate",
    "special_election",
    "execute",
    "execute",
  ];
}

export function teamOf(role: ShRole): ShTeam {
  return role === "liberal" ? "liberal" : "fascist";
}

export function vetoUnlocked(state: ShState): boolean {
  return state.fascistPolicies >= 5;
}

/** Na 3 fascistische wetten wint fascisme als Hitler kanselier wordt. */
export function hitlerDangerZone(state: ShState): boolean {
  return state.fascistPolicies >= 3;
}

export function isAlive(state: ShState, playerId: string): boolean {
  return state.seats.includes(playerId) && !state.dead.includes(playerId);
}

export function alivePlayers(state: ShState): string[] {
  return state.seats.filter((id) => !state.dead.includes(id));
}

/** Waarom deze speler geen kanselier mag worden (null = verkiesbaar). */
export function chancellorIneligibility(
  state: ShState,
  playerId: string,
): "president" | "dead" | "last_chancellor" | "last_president" | null {
  if (state.dead.includes(playerId)) return "dead";
  if (playerId === state.presidentId) return "president";
  if (playerId === state.lastElectedChancellorId) return "last_chancellor";
  // Met nog maar vijf levende spelers geldt alleen de vorige kanselier.
  if (
    playerId === state.lastElectedPresidentId &&
    alivePlayers(state).length > 5
  )
    return "last_president";
  return null;
}

export function eligibleChancellors(state: ShState): string[] {
  return state.seats.filter((id) => chancellorIneligibility(state, id) == null);
}

/** Geldige doelwitten voor de huidige presidentiële macht. */
export function powerTargets(state: ShState): string[] {
  const others = alivePlayers(state).filter((id) => id !== state.presidentId);
  if (state.pendingPower === "investigate") {
    return others.filter((id) => !state.investigated.includes(id));
  }
  return others;
}

/** Welke F-aantallen kan een president met `drawn` F doorgeven? */
export function passableFascistCounts(drawn: number): number[] {
  const min = Math.max(0, drawn - 1);
  const max = Math.min(2, drawn);
  const out: number[] = [];
  for (let n = min; n <= max; n++) out.push(n);
  return out;
}

export function analyzeClaims(
  policy: ShPolicy,
  presidentClaim: ShHandClaim | null,
  chancellorClaim: ShHandClaim | null,
): ShClaimFlag[] {
  const flags: ShClaimFlag[] = [];
  if (
    presidentClaim != null &&
    ((policy === "L" && presidentClaim === 3) ||
      (policy === "F" && presidentClaim === 0))
  ) {
    flags.push("president_impossible");
  }
  if (
    chancellorClaim != null &&
    ((policy === "F" && chancellorClaim === 0) ||
      (policy === "L" && chancellorClaim === 2))
  ) {
    flags.push("chancellor_impossible");
  }
  if (
    presidentClaim != null &&
    chancellorClaim != null &&
    !passableFascistCounts(presidentClaim).includes(chancellorClaim)
  ) {
    flags.push("conflict");
  }
  if (flags.length === 0) {
    if (chancellorClaim === 1 && policy === "F") {
      flags.push("chancellor_chose_fascist");
    }
    if (presidentClaim != null && presidentClaim < 3 && chancellorClaim === 2) {
      flags.push("president_discarded_liberal");
    }
  }
  return flags;
}

export function isLieFlag(flag: ShClaimFlag): boolean {
  return (
    flag === "conflict" ||
    flag === "chancellor_impossible" ||
    flag === "president_impossible"
  );
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Nog niet aangenomen wetten (trekstapel + aflegstapel samen). */
export function unplayedPolicies(state: ShState): {
  liberal: number;
  fascist: number;
} {
  return {
    liberal: SH_TOTAL_LIBERAL - state.liberalPolicies,
    fascist: SH_TOTAL_FASCIST - state.fascistPolicies,
  };
}

/**
 * Ruwe kansen voor de volgende trekking van drie, berekend over alle nog
 * niet aangenomen wetten (exact direct na het schudden, daarna een
 * schatting: we weten niet wat er is afgelegd).
 */
export function drawOdds(state: ShState): {
  threeFascist: number;
  atLeastOneLiberal: number;
} {
  const { liberal, fascist } = unplayedPolicies(state);
  const total = liberal + fascist;
  const all = choose(total, 3);
  if (all === 0) return { threeFascist: 0, atLeastOneLiberal: 0 };
  const fff = choose(fascist, 3) / all;
  return { threeFascist: fff, atLeastOneLiberal: 1 - fff };
}

export function emptySecretHitlerState(seats: string[]): ShState {
  return {
    seats: [...seats],
    playerCount: seats.length,
    phase: "setup",
    presidentId: null,
    nomineeId: null,
    regularPresidentId: null,
    specialElectionNextId: null,
    currentIsSpecial: false,
    lastElectedPresidentId: null,
    lastElectedChancellorId: null,
    liberalPolicies: 0,
    fascistPolicies: 0,
    electionTracker: 0,
    drawPile: SH_DECK_SIZE,
    discardPile: 0,
    reshuffles: 0,
    dead: [],
    investigated: [],
    confirmedNotHitler: [],
    pendingPower: null,
    winner: null,
    winReason: null,
    hitlerId: null,
    roles: null,
    governments: [],
    chaosPolicies: [],
    quotes: [],
    ignoredEventIds: [],
  };
}

function nextAliveAfter(state: ShState, playerId: string | null): string {
  const n = state.seats.length;
  const start = playerId ? state.seats.indexOf(playerId) : -1;
  for (let step = 1; step <= n; step++) {
    const candidate = state.seats[(start + step + n) % n];
    if (!state.dead.includes(candidate)) return candidate;
  }
  return state.seats[0];
}

function advancePresident(s: ShState) {
  s.nomineeId = null;
  s.pendingPower = null;
  if (s.specialElectionNextId && isAlive(s, s.specialElectionNextId)) {
    s.presidentId = s.specialElectionNextId;
    s.specialElectionNextId = null;
    s.currentIsSpecial = true;
  } else {
    s.specialElectionNextId = null;
    s.regularPresidentId = nextAliveAfter(s, s.regularPresidentId);
    s.presidentId = s.regularPresidentId;
    s.currentIsSpecial = false;
  }
  s.phase = "nominate";
}

function reshuffleIfNeeded(s: ShState) {
  if (s.drawPile < 3) {
    s.drawPile = SH_DECK_SIZE - s.liberalPolicies - s.fascistPolicies;
    s.discardPile = 0;
    s.reshuffles += 1;
  }
}

function placePolicy(s: ShState, policy: ShPolicy) {
  if (policy === "L") s.liberalPolicies += 1;
  else s.fascistPolicies += 1;
  s.electionTracker = 0;
  if (s.liberalPolicies >= SH_LIBERAL_TRACK) {
    endGame(s, "liberal", "liberal_policies");
  } else if (s.fascistPolicies >= SH_FASCIST_TRACK) {
    endGame(s, "fascist", "fascist_policies");
  }
}

function isGameOver(s: ShState): boolean {
  return s.phase === "game_over";
}

function endGame(s: ShState, winner: ShTeam, reason: ShWinReason) {
  s.winner = winner;
  s.winReason = reason;
  s.phase = "game_over";
  s.nomineeId = null;
  s.pendingPower = null;
}

function failElection(s: ShState) {
  s.electionTracker += 1;
  if (s.electionTracker >= 3) {
    s.phase = "chaos";
    s.nomineeId = null;
  } else {
    advancePresident(s);
  }
}

function currentGovernment(s: ShState): ShGovernment | undefined {
  return s.governments[s.governments.length - 1];
}

function finishPowerAndAdvance(s: ShState, use: ShPowerUse) {
  const gov = currentGovernment(s);
  if (gov) gov.power = use;
  if (s.phase !== "game_over") advancePresident(s);
}

/** Past één event toe; geeft false terug als het niet bij de fase past. */
function applyEvent(s: ShState, event: ShEvent): boolean {
  const p = event.payload;

  // Altijd toegestaan, ongeacht de fase.
  if (p.type === "quote") {
    s.quotes.push({
      eventId: event.id,
      playerId: p.playerId,
      text: p.text,
      round: s.governments.length,
    });
    return true;
  }
  if (p.type === "reveal") {
    s.roles = { ...p.roles };
    if (!s.hitlerId) {
      s.hitlerId =
        Object.entries(p.roles).find(([, r]) => r === "hitler")?.[0] ?? null;
    }
    return true;
  }
  if (p.type === "declare_winner") {
    if (s.phase === "game_over" && s.winReason !== "declared") return false;
    endGame(s, p.winner, "declared");
    return true;
  }

  switch (s.phase) {
    case "setup": {
      if (p.type !== "start" || !s.seats.includes(p.firstPresidentId))
        return false;
      if (
        p.seats &&
        p.seats.length === s.seats.length &&
        new Set(p.seats).size === p.seats.length &&
        p.seats.every((id) => s.seats.includes(id))
      ) {
        s.seats = [...p.seats];
      }
      s.regularPresidentId = p.firstPresidentId;
      s.presidentId = p.firstPresidentId;
      s.currentIsSpecial = false;
      s.phase = "nominate";
      return true;
    }
    case "nominate": {
      if (p.type !== "nominate") return false;
      if (chancellorIneligibility(s, p.chancellorId) != null) return false;
      if (!s.seats.includes(p.chancellorId)) return false;
      s.nomineeId = p.chancellorId;
      s.governments.push({
        index: s.governments.length,
        presidentId: s.presidentId!,
        chancellorId: p.chancellorId,
        specialElection: s.currentIsSpecial,
        votes: {},
        passed: null,
        hitlerCheck: null,
        policy: null,
        vetoed: false,
        presidentClaim: null,
        chancellorClaim: null,
        flags: [],
        power: null,
        fascistPoliciesBefore: s.fascistPolicies,
        aliveCount: alivePlayers(s).length,
      });
      s.phase = "vote";
      return true;
    }
    case "vote": {
      if (p.type !== "vote") return false;
      const gov = currentGovernment(s);
      if (!gov) return false;
      const votes: Record<string, ShVote> = {};
      for (const [id, v] of Object.entries(p.votes)) {
        if (isAlive(s, id) && (v === "ja" || v === "nein")) votes[id] = v;
      }
      gov.votes = votes;
      gov.passed = p.passed;
      if (!p.passed) {
        failElection(s);
        return true;
      }
      s.lastElectedPresidentId = gov.presidentId;
      s.lastElectedChancellorId = gov.chancellorId;
      s.phase = hitlerDangerZone(s) ? "hitler_check" : "legislate";
      return true;
    }
    case "hitler_check": {
      if (p.type !== "hitler_check") return false;
      const gov = currentGovernment(s);
      if (!gov) return false;
      gov.hitlerCheck = p.isHitler;
      if (p.isHitler) {
        s.hitlerId = gov.chancellorId;
        endGame(s, "fascist", "hitler_elected");
      } else {
        if (!s.confirmedNotHitler.includes(gov.chancellorId))
          s.confirmedNotHitler.push(gov.chancellorId);
        s.phase = "legislate";
      }
      return true;
    }
    case "legislate": {
      const gov = currentGovernment(s);
      if (!gov) return false;
      if (p.type === "veto") {
        if (!vetoUnlocked(s)) return false;
        gov.vetoed = true;
        s.drawPile -= 3;
        s.discardPile += 3;
        reshuffleIfNeeded(s);
        failElection(s);
        return true;
      }
      if (p.type !== "enact") return false;
      gov.policy = p.policy;
      gov.presidentClaim = p.presidentClaim;
      gov.chancellorClaim = p.chancellorClaim;
      gov.flags = analyzeClaims(p.policy, p.presidentClaim, p.chancellorClaim);
      s.drawPile -= 3;
      s.discardPile += 2;
      placePolicy(s, p.policy);
      reshuffleIfNeeded(s);
      // placePolicy kan de fase op game_over zetten.
      if (isGameOver(s)) return true;
      const power =
        p.policy === "F"
          ? (fascistTrackPowers(s.playerCount)[s.fascistPolicies - 1] ?? null)
          : null;
      if (power) {
        s.pendingPower = power;
        s.phase = "power";
      } else {
        advancePresident(s);
      }
      return true;
    }
    case "chaos": {
      if (p.type !== "chaos") return false;
      s.chaosPolicies.push(p.policy);
      s.drawPile -= 1;
      // Chaos: geen macht, termijnlimieten vervallen.
      s.lastElectedPresidentId = null;
      s.lastElectedChancellorId = null;
      placePolicy(s, p.policy);
      reshuffleIfNeeded(s);
      if (!isGameOver(s)) advancePresident(s);
      return true;
    }
    case "power": {
      const targets = powerTargets(s);
      if (p.type === "investigate" && s.pendingPower === "investigate") {
        if (!targets.includes(p.targetId)) return false;
        s.investigated.push(p.targetId);
        finishPowerAndAdvance(s, {
          power: "investigate",
          targetId: p.targetId,
          claim: p.claim,
        });
        return true;
      }
      if (p.type === "peek" && s.pendingPower === "peek") {
        finishPowerAndAdvance(s, { power: "peek", claim: p.claim });
        return true;
      }
      if (
        p.type === "special_election" &&
        s.pendingPower === "special_election"
      ) {
        if (!targets.includes(p.targetId)) return false;
        s.specialElectionNextId = p.targetId;
        finishPowerAndAdvance(s, {
          power: "special_election",
          targetId: p.targetId,
        });
        return true;
      }
      if (p.type === "execute" && s.pendingPower === "execute") {
        if (!targets.includes(p.targetId)) return false;
        s.dead.push(p.targetId);
        if (p.wasHitler) {
          s.hitlerId = p.targetId;
          endGame(s, "liberal", "hitler_executed");
        } else if (!s.confirmedNotHitler.includes(p.targetId)) {
          s.confirmedNotHitler.push(p.targetId);
        }
        finishPowerAndAdvance(s, {
          power: "execute",
          targetId: p.targetId,
          wasHitler: p.wasHitler,
        });
        return true;
      }
      return false;
    }
    case "game_over":
      return false;
  }
}

/** Speelt alle niet-ongedaan-gemaakte events af (in volgorde). */
export function buildSecretHitlerState(
  seats: string[],
  events: ShEvent[],
): ShState {
  const s = emptySecretHitlerState(seats);
  const active = events
    .filter((e) => e.undone_at == null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const event of active) {
    if (!applyEvent(s, event)) s.ignoredEventIds.push(event.id);
  }
  return s;
}

/** Klopt deze rolverdeling met het spelersaantal? (null = ja) */
export function validateRoles(
  seats: string[],
  roles: Record<string, ShRole | undefined>,
): string | null {
  const { liberals, fascists } = roleDistribution(seats.length);
  let l = 0;
  let f = 0;
  let h = 0;
  for (const id of seats) {
    const r = roles[id];
    if (r === "liberal") l++;
    else if (r === "fascist") f++;
    else if (r === "hitler") h++;
    else return "Geef iedereen een rol.";
  }
  if (h !== 1) return "Er is precies één Hitler.";
  if (l !== liberals || f !== fascists)
    return `Bij ${seats.length} spelers: ${liberals} liberalen, ${fascists} ${fascists === 1 ? "fascist" : "fascisten"} en Hitler.`;
  return null;
}

/** Spelers die in het winnende team zaten (voor de WIN-registratie). */
export function winningPlayers(state: ShState): string[] {
  if (!state.winner || !state.roles) return [];
  return state.seats.filter((id) => {
    const role = state.roles?.[id];
    return role != null && teamOf(role) === state.winner;
  });
}

/**
 * Rollen die al vaststaan door het spelverloop (Hitler gekozen of
 * geëxecuteerd), als startpunt voor het onthulscherm.
 */
export function knownRoles(state: ShState): Record<string, ShRole> {
  const out: Record<string, ShRole> = {};
  if (state.hitlerId) out[state.hitlerId] = "hitler";
  return out;
}
