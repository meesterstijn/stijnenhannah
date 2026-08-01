import { assertR6GameCountConsistency, isR6GameCompleted } from "@/features/rainbow-six-siege/lib/matches";
import type {
  R6Challenge,
  R6Event,
  R6Match,
  R6MatchPlayer,
  R6Player,
  R6ScoreboardEntry,
  R6ScoreRule,
  R6UndoableAction,
} from "@/features/rainbow-six-siege/types";

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

/** Geëxporteerd voor hergebruik buiten computeScoreboard — bv. de
 * Statistiekenpagina die per-game (niet per-sessie) punten moet aflezen
 * voor het "meeste punten in één game"-record. */
// Bewust GEEN is_active-filter: dat vlaggetje bepaalt alleen of een tegel
// nog getoond wordt in de live tik-grid (zie de quickActions-filter in
// RainbowSixSiegeSession.tsx/RainbowSixSiegeController.tsx, die `is_active`
// wél expliciet meeneemt). Een tegel op "inactief" zetten in Actietegels
// beheren is bedoeld als "verbergen zonder geschiedenis te verliezen" — als
// deze functie ook zou filteren op is_active, zou het uitzetten van bv. de
// MVP-tegel de mvp/clutch/ace-terugvalwaarde hier stilzwijgend op 0 zetten,
// óók voor toekomstige match.mvp_points-toekenningen via "Game afronden".
export function rulePoints(rules: R6ScoreRule[], code: string): number {
  const rule = rules.find((r) => r.code === code);
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
    clutch1v2: 0,
    clutch1v3: 0,
    aces: 0,
    challengesCompleted: 0,
  };
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
 * expliciet fallback-)regels zijn — zie useR6ScoreRules. Punten komen
 * uitsluitend uit direct getikte acties (actietegels) en de MVP-toekenning
 * bij het afsluiten van een game — er zijn bewust geen sessie-brede
 * "meeste X"-eindbonussen meer (die telden bij de allereerste tik van een
 * stat al mee, omdat een speler dan al "unieke koploper" was t.o.v. ieders
 * beginstand van 0).
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

  // Dev-only sanity check (geen invloed op het teruggegeven scorebord):
  // voor elke speler moet het aantal afgeronde games waar die speler een
  // match_player-rij voor heeft exact gelijk zijn aan zijn eigen
  // wins+losses+draws hierboven — twee onafhankelijk afgeleide tellingen
  // die nooit uit elkaar mogen lopen. Zie assertR6GameCountConsistency.
  if (import.meta.env.DEV) {
    for (const player of players) {
      const totals = totalsByPlayer.get(player.id);
      if (!totals) continue;
      const playerCompletedGamesCount = matchPlayers.filter((row) => {
        if (row.player_id !== player.id) return false;
        const match = matchById.get(row.match_id);
        return !!match && isR6GameCompleted(match);
      }).length;
      assertR6GameCountConsistency(playerCompletedGamesCount, totals.wins, totals.losses, totals.draws, `speler ${player.name}`);
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
    // Los van de gecombineerde `clutches` hierboven ook de 1v2/1v3-splitsing
    // bijhouden — alleen af te leiden uit deze twee specifieke event-codes,
    // het klassieke matchformulier kent enkel een generieke clutch-boolean.
    if (event.score_rule_code === "clutch_1v2") totals.clutch1v2 += 1;
    else if (event.score_rule_code === "clutch_1v3") totals.clutch1v3 += 1;
  }

  const entries: R6ScoreboardEntry[] = players.map((player) => {
    const directPoints = directPointsByPlayer.get(player.id) ?? 0;
    return {
      player,
      directPoints,
      totalPoints: directPoints,
      totals: totalsByPlayer.get(player.id) ?? emptyTotals(),
    };
  });

  return entries.sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Synthetische, alleen-voor-weergave R6Event-rijen voor de "Laatste
 * acties"-feed (R6RecentEventsFeed) — een MVP-toekenning bij "Gimma
 * afronden" is géén tik-gebeurtenis, die zit vast op de match zelf
 * (match.mvp_player_id/mvp_points, zie de matches-loop hierboven), maar
 * moet wel zichtbaar zijn tussen de live tikken. `id` krijgt een
 * `mvp-`-prefix zodat de feed 'm herkent en geen "ongedaan maken"-knop
 * toont (die zou een r6_events-rij proberen te verwijderen die niet
 * bestaat). `created_at` komt bewust van `match.updated_at`, niet
 * `played_at`: dat laatste is het moment waarop de match/ronde BEGON, ver
 * vóór alle tikken en de uiteindelijke MVP-keuze aan het eind.
 *
 * Puur weergave — NOOIT meegeven aan computeScoreboard, dat zou de
 * mvp-punten dubbel tellen (eenmaal via matches, eenmaal via deze
 * synthetische events).
 */
export function buildMvpFeedEvents(matches: R6Match[], scoreRules: R6ScoreRule[]): R6Event[] {
  return matches
    .filter((match) => match.mvp_player_id)
    .map((match) => ({
      id: `mvp-${match.id}`,
      session_id: match.session_id,
      match_id: match.id,
      player_id: match.mvp_player_id!,
      score_rule_code: "mvp",
      points_awarded: match.mvp_points ?? rulePoints(scoreRules, "mvp"),
      created_at: match.updated_at,
    }));
}

/**
 * De ENE centrale plek waar een "Laatste acties"-feed vandaan hoort te
 * komen — combineert echte r6_events met de synthetische MVP-feeditems
 * (buildMvpFeedEvents hierboven) tot één chronologisch gesorteerde lijst
 * (nieuwste eerst). Big Screen (RainbowSixSiegeBigScreenContent) en het
 * Live Dashboard (RainbowSixSiegeSession -> R6LiveDashboard ->
 * R6RecentEventsFeed) roepen beide uitsluitend deze functie aan, zodat de
 * combineer-/sorteerlogica niet dubbel geïmplementeerd wordt en niet kan
 * gaan afwijken tussen de twee schermen.
 *
 * Tweede sortering op `id` bij een (zeldzame) exact gelijke timestamp
 * tussen twee items, voor een deterministische volgorde — belangrijker dan
 * de exacte tiebreak-regel zelf is dat 'm maar op één plek staat.
 *
 * Puur weergave, zie buildMvpFeedEvents: nooit aan computeScoreboard
 * geven, dat zou de mvp-punten dubbel tellen.
 */
export function buildR6Feed(events: R6Event[], matches: R6Match[], scoreRules: R6ScoreRule[]): R6Event[] {
  return [...events, ...buildMvpFeedEvents(matches, scoreRules)].sort((a, b) => {
    const byTime = b.created_at.localeCompare(a.created_at);
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
  });
}

// Stabiele id voor de tiebreak hieronder — voor "mvp" is er geen los `id`-
// veld (alleen matchId), maar `mvp-${matchId}` is toch al de gevestigde vorm
// (zie buildMvpFeedEvents) en dus net zo stabiel/uniek als een event-id.
function undoableActionSortId(action: R6UndoableAction): string {
  return action.kind === "mvp" ? `mvp-${action.matchId}` : action.id;
}

function byRecency(a: R6UndoableAction, b: R6UndoableAction): number {
  const byTime = b.createdAt.localeCompare(a.createdAt);
  return byTime !== 0 ? byTime : undoableActionSortId(b).localeCompare(undoableActionSortId(a));
}

/**
 * De ENE centrale plek die bepaalt welke puntenactie de "Laatste actie
 * ongedaan maken"-knop (Tablet Controller) en het undo-bare MVP-feeditem
 * (R6RecentEventsFeed) daadwerkelijk terugdraaien — ongeacht of die actie
 * een echte r6_event-rij is of een MVP-toekenning op r6_matches. Hergebruikt
 * buildMvpFeedEvents voor de MVP-kandidaat (zelfde `mvp-`-id, zelfde
 * created_at-bron als de "Laatste acties"-feed) i.p.v. die normalisatie
 * dubbel te implementeren.
 *
 * Gamegrens-regel (bewust NIET zomaar "het nieuwste item van de hele
 * sessie" — dat zou een oude MVP-toekenning onbeperkt undo-baar houden,
 * ook nadat er allang een nieuwe game bezig is):
 *  1. Is er in de actieve game (hoogste match_number) al een eigen
 *     puntenactie (tik of MVP)? Dan mag ALLEEN daaruit gekozen worden.
 *  2. Heeft de actieve game nog niets van zichzelf (het typische moment
 *     vlak na "Gimma afronden": de nieuwe game is al automatisch gestart,
 *     maar er is nog niet getikt)? Dan mag de undo nog één keer terugvallen
 *     op de meest recente puntenactie van de daaraan voorafgaande game —
 *     zodat een zojuist toegekende MVP nog terug te draaien is, ook al is
 *     die game zelf niet meer "actief".
 *  3. Zodra de actieve game zijn eigen eerste actie krijgt, vervalt die
 *     terugval-mogelijkheid vanzelf (regel 1 wint dan weer) — een oudere
 *     MVP wordt dus nooit stilzwijgend bereikbaar zodra een nieuwe game
 *     daadwerkelijk begonnen is.
 *
 * Optimistische (nog niet server-bevestigde) events worden hier bewust
 * genegeerd, zelfde reden als in de oude useR6UndoLastEvent: hun id is een
 * lokale placeholder, geen geldige database-uuid.
 */
export function determineR6LastUndoableAction(
  events: R6Event[],
  matches: R6Match[],
  scoreRules: R6ScoreRule[],
): R6UndoableAction | null {
  if (matches.length === 0) return null;

  const sortedMatches = [...matches].sort((a, b) => b.match_number - a.match_number);
  const activeMatch = sortedMatches[0];
  const previousMatch = sortedMatches[1] ?? null;
  const mvpFeedByMatchId = new Map(buildMvpFeedEvents(matches, scoreRules).map((e) => [e.match_id, e]));

  function actionsForMatch(match: R6Match): R6UndoableAction[] {
    const matchEvents: R6UndoableAction[] = events
      .filter((e) => e.match_id === match.id && !e.id.startsWith("optimistic-"))
      .map((e) => ({
        kind: "event",
        id: e.id,
        matchId: match.id,
        createdAt: e.created_at,
        playerId: e.player_id,
        label: scoreRules.find((r) => r.code === e.score_rule_code)?.name ?? e.score_rule_code,
        points: e.points_awarded,
      }));

    const mvpFeedEvent = mvpFeedByMatchId.get(match.id);
    const mvpAction: R6UndoableAction[] = mvpFeedEvent
      ? [
          {
            kind: "mvp",
            matchId: match.id,
            createdAt: mvpFeedEvent.created_at,
            playerId: mvpFeedEvent.player_id,
            label: "MVP",
            points: mvpFeedEvent.points_awarded,
          },
        ]
      : [];

    return [...matchEvents, ...mvpAction];
  }

  const activeMatchActions = actionsForMatch(activeMatch);
  const candidates = activeMatchActions.length > 0 ? activeMatchActions : previousMatch ? actionsForMatch(previousMatch) : [];

  if (candidates.length === 0) return null;
  return [...candidates].sort(byRecency)[0];
}
