// Game Night V2.7B (sectie 13-19) — pure, frontend-only "competitive
// moment"-engine. Neemt uitsluitend AL BESTAANDE, echte data (actieve
// win_events van de huidige spelsessie + de bestaande canonical WinRecord-
// laag/rivalry-analytics uit gameNightStats.ts, sectie 40: "geen nieuwe
// definities voor wins/rivalry/attendance/titels") en leidt daar een
// eenmalig moment uit af, direct na een nieuwe WIN. Geen databasetabel,
// geen server-call — alles is uit de al-geladen state afleidbaar. Als de
// benodigde data niet betrouwbaar beschikbaar is, wordt dat momenttype
// simpelweg overgeslagen (nooit een gok/verzonnen tekst).
//
// Prioriteitsvolgorde bij een nieuwe WIN (hoogste eerst, stopt bij de
// eerste match — er verschijnt nooit meer dan één moment per WIN):
//   1. streak_broken — een eigen, persoonlijke reeks die net eindigde is
//      narratief het sterkst.
//   2. leader_change / tie — de stand is écht gewijzigd.
//   3. streak — een nieuwe hete reeks (>=3) vormt zich.
//   4. rivalry — bewust zeldzaam (zie triggerRivalryMoment hieronder).
//   5. milestone — lifetime-totaal (deze sessie meegerekend) kruist een
//      rond getal.
//   6. normal_win — meestal null ("niet elke WIN heeft een grap nodig");
//      een klein deterministisch (dus testbaar) deel van de gewone WINs
//      krijgt een lichte, speelse plaagzin uit een vaste templateset.

import type { GameNightPlayer, GameNightWinEvent } from "@/lib/supabase";
import {
  getGameRivalries,
  type AnalyticsData,
  type GameRivalry,
} from "@/features/game-night/lib/gameNightStats";

export type CompetitiveMomentType =
  | "leader_change"
  | "tie"
  | "streak"
  | "streak_broken"
  | "rivalry"
  | "milestone"
  | "normal_win";

export type CompetitiveMoment = {
  type: CompetitiveMomentType;
  headline: string;
  subtitle: string | null;
  playerIds: string[];
};

function displayName(player: GameNightPlayer | undefined): string {
  return player?.nickname?.trim() || player?.name || "Iemand";
}

// Alleen actieve events, chronologisch — undone events tellen nergens in
// deze module mee (sectie 16: "Undone events tellen niet.").
function activeChronological(events: GameNightWinEvent[]): GameNightWinEvent[] {
  return [...events]
    .filter((e) => e.undone_at == null)
    .sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

function countsFor(events: GameNightWinEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
  }
  return counts;
}

function topPlayerIds(counts: Map<string, number>): {
  ids: string[];
  max: number;
} {
  const max = Math.max(0, ...counts.values());
  if (max === 0) return { ids: [], max: 0 };
  return {
    ids: [...counts.entries()].filter(([, v]) => v === max).map(([id]) => id),
    max,
  };
}

// Streak van `playerId` die eindigt op (en met) `uptoIndex` (inclusief) in
// de chronologische actieve-eventlijst — telt terug zolang dezelfde speler
// het ONONDERBROKEN laatste event is (sectie 16: "opeenvolgende").
function streakEndingAt(
  chrono: GameNightWinEvent[],
  uptoIndex: number,
): { playerId: string; length: number } | null {
  if (uptoIndex < 0) return null;
  const playerId = chrono[uptoIndex].player_id;
  let length = 0;
  for (let i = uptoIndex; i >= 0 && chrono[i].player_id === playerId; i--) {
    length++;
  }
  return { playerId, length };
}

const STREAK_THRESHOLD = 3;
const MILESTONE_STEP = 5;

// Plaagzinnen (sectie 15) — bewust in code, niet in de database, en bewust
// generiek/positief-competitief (nooit vernederend/persoonlijk gevoelig).
// Deterministisch geselecteerd (op het totaal aantal actieve events tot nu
// toe) i.p.v. Math.random(), zodat dit exact zo getest kan worden als elke
// andere pure functie hier.
const TEASE_TEMPLATES: ((name: string, runnerUp: string | null) => string)[] = [
  (name) => `${name} had het blijkbaar te comfortabel.`,
  (_name, runnerUp) =>
    runnerUp
      ? `${runnerUp} heeft antwoorden nodig.`
      : "De rest heeft antwoorden nodig.",
  (name) => `${name} weigert dit zomaar weg te geven.`,
  () => "De voorsprong is verdwenen.",
];

export type BuildCompetitiveMomentInput = {
  gameId: string;
  gameSessionId: string;
  /** Alle win_events van deze spelsessie (actief + ongedaan gemaakt), in willekeurige volgorde. */
  events: GameNightWinEvent[];
  /** Het event dat deze evaluatie triggert — moet in `events` voorkomen en actief zijn. */
  justRecordedEventId: string;
  participantsById: Map<string, GameNightPlayer>;
  /** Ontbreekt tijdens laden — rivalry/milestone worden dan overgeslagen (sectie 40). */
  analyticsData: AnalyticsData | undefined;
};

export function buildCompetitiveMoment(
  input: BuildCompetitiveMomentInput,
): CompetitiveMoment | null {
  const chrono = activeChronological(input.events);
  const index = chrono.findIndex((e) => e.id === input.justRecordedEventId);
  if (index === -1) return null; // ongedaan gemaakt vóór evaluatie, of onbekend event — niets tonen

  const justEvent = chrono[index];
  const playerId = justEvent.player_id;
  const player = input.participantsById.get(playerId);
  const name = displayName(player);

  const beforeCounts = countsFor(chrono.slice(0, index));
  const afterCounts = countsFor(chrono.slice(0, index + 1));
  const before = topPlayerIds(beforeCounts);
  const after = topPlayerIds(afterCounts);

  // ── 1. streak_broken ────────────────────────────────────────────────
  if (index > 0) {
    const prevStreak = streakEndingAt(chrono, index - 1);
    if (
      prevStreak &&
      prevStreak.playerId !== playerId &&
      prevStreak.length >= STREAK_THRESHOLD
    ) {
      const prevPlayer = input.participantsById.get(prevStreak.playerId);
      return {
        type: "streak_broken",
        headline: "STREAK GEBROKEN",
        subtitle: `${name} maakt een einde aan ${displayName(prevPlayer)}s reeks.`,
        playerIds: [playerId, prevStreak.playerId],
      };
    }
  }

  // ── 2. leader_change / tie — alleen als de stand ECHT wijzigde ──────
  const wasSoleLeaderBefore =
    before.ids.length === 1 && before.ids[0] === playerId;
  const isSoleLeaderAfter = after.ids.length === 1 && after.ids[0] === playerId;
  const isTiedAtTopAfter = after.ids.length > 1 && after.ids.includes(playerId);

  if (
    isTiedAtTopAfter &&
    !(before.ids.length > 1 && before.ids.includes(playerId))
  ) {
    return {
      type: "tie",
      headline: `${name.toUpperCase()} MAAKT GELIJK`,
      subtitle: null,
      playerIds: after.ids,
    };
  }

  if (isSoleLeaderAfter && !wasSoleLeaderBefore) {
    // Wiskundig kan een speler NOOIT in één enkele WIN van "duidelijk
    // achterstaand" naar "alleen aan de leiding" springen (elke WIN
    // verhoogt precies één telling met 1) — de enige twee bereikbare
    // paden zijn: dit is de allereerste WIN van de avond (before.ids is
    // leeg), of de speler stond al gelijk aan kop en trekt nu los. Beide
    // krijgen bewust een andere, wél echt onderscheidende kop.
    const brokeOwnTie = before.ids.length > 1 && before.ids.includes(playerId);
    return {
      type: "leader_change",
      headline: brokeOwnTie
        ? `${name.toUpperCase()} PAKT DE TROON`
        : `${name.toUpperCase()} NEEMT DE LEIDING`,
      subtitle: null,
      playerIds: brokeOwnTie
        ? [playerId, ...before.ids.filter((id) => id !== playerId)]
        : [playerId],
    };
  }

  // ── 3. streak — nieuwe hete reeks ────────────────────────────────────
  const streak = streakEndingAt(chrono, index);
  if (streak && streak.length >= STREAK_THRESHOLD) {
    return {
      type: "streak",
      headline: "HOT STREAK",
      subtitle: `${name.toUpperCase()} — ${streak.length} OP RIJ`,
      playerIds: [playerId],
    };
  }

  // ── 4. rivalry — bewust zeldzaam: alleen bij de TWEEDE sessie-WIN van
  // de speler, en alleen als er echte, drempel-gehaalde lifetime-rivalry-
  // data bestaat tegen de huidige nummer 2 (sectie 18: "gezonde
  // thresholds zodat het speciaal blijft"). ────────────────────────────
  const ownSessionWins = afterCounts.get(playerId) ?? 0;
  if (ownSessionWins === 2 && input.analyticsData) {
    const runnerUpId = [...afterCounts.entries()]
      .filter(([id]) => id !== playerId)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (runnerUpId) {
      const rivalries = getGameRivalries(input.analyticsData, input.gameId);
      const rivalry = rivalries.find(
        (r) =>
          (r.playerA.id === playerId && r.playerB.id === runnerUpId) ||
          (r.playerB.id === playerId && r.playerA.id === runnerUpId),
      );
      if (rivalry) {
        const moment = buildRivalryHeadline(rivalry, playerId);
        if (moment) return moment;
      }
    }
  }

  // ── 5. milestone — lifetime-totaal (deze sessie meegerekend) kruist
  // een veelvoud van MILESTONE_STEP. Telt bewust NIET simpelweg
  // collectPlayerGameMetrics().canonicalWins op — die kan een verouderde
  // cache zijn die tonight's win_events nog niet bevat (sectie 41:
  // performance, geen zware refetch per tik) — dus lifetime = historische
  // WinRecords van ANDERE sessies + de live telling van DEZE sessie. ────
  if (input.analyticsData) {
    const lifetimeBeforeTonight = input.analyticsData.winRecords.filter(
      (r) =>
        r.game_id === input.gameId &&
        r.player_id === playerId &&
        r.game_session_id !== input.gameSessionId,
    ).length;
    const total = lifetimeBeforeTonight + ownSessionWins;
    if (total > 0 && total % MILESTONE_STEP === 0) {
      return {
        type: "milestone",
        headline: "MIJLPAAL",
        subtitle: `${name} — ${total}e keer gewonnen`,
        playerIds: [playerId],
      };
    }
  }

  // ── 6. normal_win — meestal niets; 1 op de 3 "gewone" wins krijgt een
  // lichte, deterministisch gekozen plaagzin. ──────────────────────────
  if ((index + 1) % 3 === 0) {
    const runnerUpId = [...afterCounts.entries()]
      .filter(([id]) => id !== playerId)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const runnerUpName = runnerUpId
      ? displayName(input.participantsById.get(runnerUpId))
      : null;
    const template = TEASE_TEMPLATES[index % TEASE_TEMPLATES.length];
    return {
      type: "normal_win",
      headline: `${name.toUpperCase()} +1`,
      subtitle: template(name, runnerUpName),
      playerIds: [playerId],
    };
  }

  return null;
}

function buildRivalryHeadline(
  rivalry: GameRivalry,
  playerId: string,
): CompetitiveMoment | null {
  const isA = rivalry.playerA.id === playerId;
  const self = isA ? rivalry.playerA : rivalry.playerB;
  const opponent = isA ? rivalry.playerB : rivalry.playerA;
  const selfWins = isA ? rivalry.winsA : rivalry.winsB;
  const opponentWins = isA ? rivalry.winsB : rivalry.winsA;
  if (selfWins === 0 && opponentWins === 0) return null; // geen canonieke geschiedenis tussen deze twee
  return {
    type: "rivalry",
    headline: `⚔ ${self.name.toUpperCase()} VS ${opponent.name.toUpperCase()}`,
    subtitle: `lifetime ${selfWins}–${opponentWins}`,
    playerIds: [self.id, opponent.id],
  };
}

// Sectie 19 — eenmalige intro bij het OPENEN van Live Play (geen per-WIN-
// moment). Alleen tonen als er écht een vorige sessie van dit spel bestaat
// met een eenduidige winnaar (canonieke WinRecords, bron-onafhankelijk).
export type PreviousWinnerIntro = {
  headline: string;
  subtitle: string;
  playerId: string;
};

export function buildPreviousWinnerIntro(
  data: AnalyticsData,
  gameId: string,
  currentGameSessionId: string,
): PreviousWinnerIntro | null {
  const pastSessions = data.gameSessions
    .filter((gs) => gs.game_id === gameId && gs.id !== currentGameSessionId)
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
  const previous = pastSessions[0];
  if (!previous) return null;

  const winCounts = countsFor(
    data.winRecords
      .filter((r) => r.game_session_id === previous.id)
      .map((r) => ({
        id: r.game_session_id,
        game_session_id: r.game_session_id,
        player_id: r.player_id,
        created_at: r.occurred_at,
        undone_at: null,
      })),
  );
  const top = topPlayerIds(winCounts);
  if (top.ids.length !== 1) return null; // geen eenduidige winnaar (gelijkspel of geen resultaat) -> geen gok

  const winner = data.index.playersById.get(top.ids[0]);
  if (!winner) return null;

  return {
    headline: "TE VERSLAAN",
    subtitle: `${displayName(winner)} won dit spel de vorige keer.`,
    playerId: winner.id,
  };
}

// Sectie 31 — maximaal 3 echte, afleidbare recap-momenten. Geen "nieuwe
// persoonlijke beste reeks"-claim (dat vereist een betrouwbare ALL-TIME
// vergelijking die longestWinStreak() niet kan leveren voor win_events-
// sessies — die functie leest uitsluitend legacy sessionResults) — in
// plaats daarvan een eerlijk, wél volledig afleidbaar feit: de langste
// reeks van VANAVOND, zonder ongeverifieerde recordclaim.
export function buildRecapHighlights(
  data: AnalyticsData | undefined,
  gameId: string,
  gameSessionId: string,
  sessionEvents: GameNightWinEvent[],
  participantsById: Map<string, GameNightPlayer>,
): string[] {
  const highlights: string[] = [];
  const active = activeChronological(sessionEvents);
  if (active.length === 0) return highlights;

  const counts = countsFor(active);
  const top = topPlayerIds(counts);
  if (top.ids.length === 1 && top.max >= 2) {
    const winner = participantsById.get(top.ids[0]);
    highlights.push(`${displayName(winner)} pakt vandaag ${top.max} WINs.`);
  }

  let bestStreak = { playerId: "", length: 0 };
  let runId = "";
  let runLen = 0;
  for (const e of active) {
    if (e.player_id === runId) {
      runLen++;
    } else {
      runId = e.player_id;
      runLen = 1;
    }
    if (runLen > bestStreak.length)
      bestStreak = { playerId: runId, length: runLen };
  }
  if (bestStreak.length >= STREAK_THRESHOLD) {
    highlights.push(
      `Langste reeks vanavond: ${displayName(participantsById.get(bestStreak.playerId))} ${bestStreak.length} op rij.`,
    );
  }

  if (data) {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const [aId] = sorted[0];
      const [bId] = sorted[1];
      const rivalry = getGameRivalries(data, gameId).find(
        (r) =>
          (r.playerA.id === aId && r.playerB.id === bId) ||
          (r.playerB.id === aId && r.playerA.id === bId),
      );
      if (rivalry) {
        const lifetimeBefore = (playerId: string) =>
          data.winRecords.filter(
            (r) =>
              r.game_id === gameId &&
              r.player_id === playerId &&
              r.game_session_id !== gameSessionId,
          ).length;
        const aTotal = lifetimeBefore(aId) + (counts.get(aId) ?? 0);
        const bTotal = lifetimeBefore(bId) + (counts.get(bId) ?? 0);
        const aIsPlayerA = rivalry.playerA.id === aId;
        highlights.push(
          `${displayName(rivalry.playerA)} en ${displayName(rivalry.playerB)} staan lifetime nu ${aIsPlayerA ? aTotal : bTotal}–${aIsPlayerA ? bTotal : aTotal}.`,
        );
      }
    }
  }

  return highlights.slice(0, 3);
}

// Game Night V2.7C — GameNightV2NightRecap (afsluiting van de VOLLEDIGE
// avond, niet van één spel — zie buildRecapHighlights hierboven voor dat
// laatste). Beide puur afgeleid uit de canonieke WinRecord-laag, exact
// dezelfde bron als de rest van deze module (sectie 40: geen nieuwe
// definities).
export type NightMvp = { player: GameNightPlayer; wins: number };

export function buildNightMvp(
  data: AnalyticsData,
  gameSessionIds: string[],
): NightMvp | null {
  const sessionIds = new Set(gameSessionIds);
  const counts = new Map<string, number>();
  for (const r of data.winRecords) {
    if (!sessionIds.has(r.game_session_id)) continue;
    counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1);
  }
  const top = topPlayerIds(counts);
  if (top.ids.length !== 1 || top.max === 0) return null;
  const player = data.index.playersById.get(top.ids[0]);
  if (!player) return null;
  return { player, wins: top.max };
}

// Bewust GEEN AnalyticsData-parameter nodig: de aanroeper (al met
// buildGameNightDetail opgehaald) geeft precies de velden mee die nodig
// zijn — puurder en makkelijker te testen dan opnieuw door de hele
// AnalyticsData te graven.
export function buildNightRecapHighlights(
  gameSessions: { gameName: string; durationSeconds: number | null }[],
  attendeesCount: number,
): string[] {
  const highlights: string[] = [];

  const withDuration = gameSessions.filter(
    (g): g is { gameName: string; durationSeconds: number } =>
      g.durationSeconds != null && g.durationSeconds > 0,
  );
  // Alleen een "langste spel"-claim als er daadwerkelijk iets te vergelijken
  // valt — bij precies 1 spel met een duur is "langste" een zinloze claim.
  if (withDuration.length > 1) {
    const longest = withDuration.reduce((a, b) =>
      b.durationSeconds > a.durationSeconds ? b : a,
    );
    highlights.push(`${longest.gameName} was het langste spel van de avond.`);
  }

  if (attendeesCount > 0) {
    highlights.push(
      `${attendeesCount} ${attendeesCount === 1 ? "speler schoof" : "spelers schoven"} aan.`,
    );
  }

  return highlights.slice(0, 3);
}
