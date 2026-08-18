import type {
  GameNightGame,
  GameNightGameSession,
  GameNightGameSessionPlayer,
  GameNightGameSessionResult,
  GameNightPlayer,
  GameNightRound,
  GameNightRoundResult,
  GameNightSession,
  GameNightSessionPlayer,
  GameNightWinEvent,
} from "@/lib/supabase";

// Pure analytics-laag (Game Night V5, sectie 30): database rows → pure
// aggregatie → UI. Geen enkele functie hier doet een Supabase-call — de
// ruwe data komt uit useGameNightAnalytics.ts (9 queries, één keer, geen
// N+1) en wordt hier client-side omgezet naar geschiedenis/profiel/Hall of
// Fame-weergaven. Alle definities die de opdracht expliciet vastlegt
// (sectie 2/3/13/16/35/37/38/39) staan hieronder als naam + commentaar,
// zodat ze op precies één plek staan en nergens stilzwijgend anders
// geïnterpreteerd worden.

export type GameNightAnalyticsRaw = {
  sessions: GameNightSession[];
  sessionPlayers: GameNightSessionPlayer[];
  players: GameNightPlayer[]; // ALLE spelers, ook gearchiveerd (sectie 33)
  games: GameNightGame[]; // ALLE spellen, ook gearchiveerd (sectie 34)
  gameSessions: GameNightGameSession[];
  gameSessionPlayers: GameNightGameSessionPlayer[];
  rounds: GameNightRound[];
  roundResults: GameNightRoundResult[];
  sessionResults: GameNightGameSessionResult[];
  // Game Night V2.1 — ruwe win-events, nog ongebruikt door bestaande UI.
  // Alleen normalizeWinRecords() en de daarvan afgeleide winRecords/index
  // hieronder lezen dit veld; alle bestaande statistiekfuncties negeren het.
  winEvents: GameNightWinEvent[];
};

export type AnalyticsIndex = {
  playersById: Map<string, GameNightPlayer>;
  gamesById: Map<string, GameNightGame>;
  gameSessionsById: Map<string, GameNightGameSession>;
  gameSessionsByGameNight: Map<string, GameNightGameSession[]>;
  gameSessionPlayersByGameSession: Map<string, GameNightGameSessionPlayer[]>;
  sessionPlayersByGameNight: Map<string, GameNightSessionPlayer[]>;
  roundsByGameSession: Map<string, GameNightRound[]>;
  roundResultsByRound: Map<string, GameNightRoundResult[]>;
  sessionResultsByGameSession: Map<string, GameNightGameSessionResult[]>;
  // Game Night V2.1 — index over de ruwe win-events (mirror van
  // roundResultsByRound hierboven), plus de al-genormaliseerde WinRecords
  // (zie normalizeWinRecords) per spelsessie en per speler, zodat
  // toekomstige consumenten (V2.2+) er net zo goedkoop bij kunnen als bij
  // elke andere index hier.
  winEventsByGameSession: Map<string, GameNightWinEvent[]>;
  winRecordsByGameSession: Map<string, WinRecord[]>;
  winRecordsByPlayer: Map<string, WinRecord[]>;
};

export type AnalyticsData = GameNightAnalyticsRaw & {
  index: AnalyticsIndex;
  // Game Night V2.1 — de canonieke, dubbeltelling-vrije lijst van "wie won
  // iets, en waar kwam dat vandaan" over ALLE spelsessies heen (legacy +
  // win_events, nooit beide voor dezelfde sessie). Zie normalizeWinRecords().
  winRecords: WinRecord[];
};

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

// ═══════════════════════════════════════════════════════════════════════
// Canonieke win-laag (Game Night V2.1) — de enige plek waar "legacy
// round_result" en "nieuw win_event" samenkomen tot één generiek concept.
// ═══════════════════════════════════════════════════════════════════════
//
// WinRecord is bewust NIEUW en apart van roundsWon/getGameRoundLeaderboard/
// GeneralRecords.mostRoundWins/GameRivalry.roundWinsA-B verderop in dit
// bestand — die functies behouden hun eigen, specifieke, historisch
// stabiele betekenis ("won een DISCRETE ronde van een rondespel") en lezen
// nog altijd uitsluitend game_night_rounds/game_night_round_results. WinRecord
// is het generieke "wie won iets"-concept: de canonieke bron voor alles wat
// conceptueel vraagt "wie wint dit spel het vaakst?" (Game Night V2.2,
// sectie 17-20) — spel-specifieke titels (Skullcrusher e.d.), lifetime
// win-totalen en de canonieke kant van rivaliteiten (zie
// collectPlayerGameMetrics/getGameRivalries verderop).
//
// Drie mogelijke bronnen per spelsessie, NOOIT gemengd binnen één sessie:
// - 'win_event'     — win_source='win_events': actieve game_night_win_events.
// - 'round'         — legacy + uses_rounds (snapshot): historische
//                      ronde-winnaars, exact zoals vóór V2.2.
// - 'session_result' — legacy + niet uses_rounds: geregistreerde
//                      sessiewinnaar(s) uit game_night_game_session_results
//                      (bv. Catan). Dit dekt het gat dat V2.1 bewust nog
//                      open liet (sectie 20 van deze opdracht): een legacy
//                      niet-rondespel had voorheen GEEN WinRecords.
export type WinRecord = {
  game_session_id: string;
  game_id: string;
  player_id: string;
  occurred_at: string;
  source: "round" | "session_result" | "win_event";
};

// Pure functie: ontvangt de relevante ruwe rijen, levert WinRecord[]. Nooit
// meer dan één bron voor dezelfde spelsessie — de bevroren snapshot
// `game_session.win_source` (20260912120000) plus, voor legacy sessies, de
// eveneens bevroren `uses_rounds`-snapshot (20260912070000) bepalen samen
// exclusief welke bron geldt. Zelfs corrupte/gemengde fixturedata (een
// sessie met round_results ÉN session_results ÉN win_events tegelijk) kan
// dus nooit dubbel tellen: er wordt hoe dan ook van precies één kant gelezen.
//
// Onbekende/toekomstige waarden van win_source vallen bewust terug op het
// legacy-pad — "bestaande game sessions moeten veilig als legacy worden
// beschouwd" geldt hier defensief voor alles wat niet letterlijk
// 'win_events' is, niet alleen voor een expliciet ontbrekende waarde.
export function normalizeWinRecords(
  gameSessions: GameNightGameSession[],
  rounds: GameNightRound[],
  roundResults: GameNightRoundResult[],
  sessionResults: GameNightGameSessionResult[],
  winEvents: GameNightWinEvent[],
): WinRecord[] {
  const roundsByGameSession = new Map<string, GameNightRound[]>();
  for (const round of rounds) {
    pushTo(roundsByGameSession, round.game_session_id, round);
  }

  const roundResultsByRound = new Map<string, GameNightRoundResult[]>();
  for (const result of roundResults) {
    pushTo(roundResultsByRound, result.round_id, result);
  }

  const sessionResultsByGameSession = new Map<
    string,
    GameNightGameSessionResult[]
  >();
  for (const result of sessionResults) {
    pushTo(sessionResultsByGameSession, result.game_session_id, result);
  }

  const winEventsByGameSession = new Map<string, GameNightWinEvent[]>();
  for (const event of winEvents) {
    pushTo(winEventsByGameSession, event.game_session_id, event);
  }

  const records: WinRecord[] = [];

  for (const gameSession of gameSessions) {
    if (gameSession.win_source === "win_events") {
      const events = winEventsByGameSession.get(gameSession.id) ?? [];
      for (const event of events) {
        if (event.undone_at != null) continue; // ongedaan gemaakt: telt niet mee
        records.push({
          game_session_id: gameSession.id,
          game_id: gameSession.game_id,
          player_id: event.player_id,
          occurred_at: event.created_at,
          source: "win_event",
        });
      }
      continue;
    }

    // Legacy: rondespel (snapshot) → ronde-winnaars, exact het V2.1-pad.
    if (gameSession.uses_rounds) {
      const sessionRounds = roundsByGameSession.get(gameSession.id) ?? [];
      for (const round of sessionRounds) {
        const results = roundResultsByRound.get(round.id) ?? [];
        for (const result of results) {
          if (!result.is_winner) continue;
          records.push({
            game_session_id: gameSession.id,
            game_id: gameSession.game_id,
            player_id: result.player_id,
            occurred_at: result.created_at,
            source: "round",
          });
        }
      }
      continue;
    }

    // Legacy: geen rondespel → geregistreerde sessiewinnaar(s) (bv. Catan).
    const results = sessionResultsByGameSession.get(gameSession.id) ?? [];
    for (const result of results) {
      if (!result.is_winner) continue;
      records.push({
        game_session_id: gameSession.id,
        game_id: gameSession.game_id,
        player_id: result.player_id,
        occurred_at: result.created_at,
        source: "session_result",
      });
    }
  }

  return records;
}

// Eerste, minimale consument van WinRecord — een generieke "wie won hoe
// vaak dit spel"-telling over legacy én win_events heen (precies het
// Skullcrusher-scenario uit de opdracht: historische rondewinsten +
// toekomstige win-events tellen samen op tot één lifetime-totaal). Bewust
// GEEN volwaardig leaderboard-type (winratePct/denominator) — welk aantal
// speelbeurten als noemer moet gelden voor een gemengd legacy/win_events-
// verleden is nog een open ontwerpvraag (V2.2+), dus hier alleen de tellng
// zelf, klaar om door een latere leaderboard/award-functie hergebruikt te
// worden.
export function getGameWinCounts(
  data: AnalyticsData,
  gameId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of data.winRecords) {
    if (record.game_id !== gameId) continue;
    counts.set(record.player_id, (counts.get(record.player_id) ?? 0) + 1);
  }
  return counts;
}

// Bouwt alle lookup-structuren één keer (sectie 31: geen herhaalde lineaire
// scans per component). `createAnalyticsData` is de enige plek die dit
// aanroept — alle overige functies in dit bestand nemen `AnalyticsData` aan.
export function createAnalyticsData(raw: GameNightAnalyticsRaw): AnalyticsData {
  const index: AnalyticsIndex = {
    playersById: new Map(raw.players.map((p) => [p.id, p])),
    gamesById: new Map(raw.games.map((g) => [g.id, g])),
    gameSessionsById: new Map(raw.gameSessions.map((gs) => [gs.id, gs])),
    gameSessionsByGameNight: new Map(),
    gameSessionPlayersByGameSession: new Map(),
    sessionPlayersByGameNight: new Map(),
    roundsByGameSession: new Map(),
    roundResultsByRound: new Map(),
    sessionResultsByGameSession: new Map(),
    winEventsByGameSession: new Map(),
    winRecordsByGameSession: new Map(),
    winRecordsByPlayer: new Map(),
  };

  for (const gs of raw.gameSessions) {
    pushTo(index.gameSessionsByGameNight, gs.game_night_session_id, gs);
  }
  for (const gsp of raw.gameSessionPlayers) {
    pushTo(index.gameSessionPlayersByGameSession, gsp.game_session_id, gsp);
  }
  for (const sp of raw.sessionPlayers) {
    pushTo(index.sessionPlayersByGameNight, sp.session_id, sp);
  }
  for (const r of raw.rounds) {
    pushTo(index.roundsByGameSession, r.game_session_id, r);
  }
  for (const rr of raw.roundResults) {
    pushTo(index.roundResultsByRound, rr.round_id, rr);
  }
  for (const sr of raw.sessionResults) {
    pushTo(index.sessionResultsByGameSession, sr.game_session_id, sr);
  }
  for (const we of raw.winEvents) {
    pushTo(index.winEventsByGameSession, we.game_session_id, we);
  }

  const winRecords = normalizeWinRecords(
    raw.gameSessions,
    raw.rounds,
    raw.roundResults,
    raw.sessionResults,
    raw.winEvents,
  );
  for (const record of winRecords) {
    pushTo(index.winRecordsByGameSession, record.game_session_id, record);
    pushTo(index.winRecordsByPlayer, record.player_id, record);
  }

  return { ...raw, index, winRecords };
}

// ── Duur (sectie 16/55) ────────────────────────────────────────────────
// Actieve speelduur = (ended_at - started_at) - total_paused_seconds. Null
// zolang de spelsessie nog niet is afgerond (geen live timer, sectie 59) —
// nooit een schatting tonen voor een lopend spel.
export function gameSessionActiveDurationSeconds(
  gs: GameNightGameSession,
): number | null {
  if (!gs.ended_at) return null;
  const rawSeconds =
    (new Date(gs.ended_at).getTime() - new Date(gs.started_at).getTime()) /
    1000;
  return Math.max(0, rawSeconds - gs.total_paused_seconds);
}

// ── Resultaat-aanwezigheid (sectie 9/35/36) ──────────────────────────────
// Een spelsessie "heeft een geregistreerd resultaat" zodra er ÜBERHAUPT een
// rij in game_night_game_session_results voor 'm bestaat. De bestaande UI
// (CompleteGameSessionPanel) schrijft ofwel NUL rijen (afgesloten zonder
// winnaar) ofwel ÉÉN rij per deelnemer (winnaar/score-modus) — nooit een
// gedeeltelijke set. Dat maakt dit een betrouwbare boolean: als hij true is,
// heeft elke deelnemer van die sessie ook echt een resultaatrij.
export function hasRegisteredResult(
  data: AnalyticsData,
  gameSessionId: string,
): boolean {
  return (
    (data.index.sessionResultsByGameSession.get(gameSessionId)?.length ?? 0) > 0
  );
}

function playerNameCollator(a: GameNightPlayer, b: GameNightPlayer) {
  return a.name.localeCompare(b.name, "nl");
}

// ── Geschiedenis: Game Night-samenvattingen (sectie 4) ───────────────────
export type GameNightSummary = {
  session: GameNightSession;
  attendees: GameNightPlayer[];
  gamesPlayed: GameNightGame[]; // distinct, in speelvolgorde
  gameSessionCount: number;
  roundCount: number; // alleen afgeronde rondes
  totalActiveSeconds: number; // som over afgeronde spelsessies
  isActive: boolean; // status !== 'completed' (sectie 5: "BEZIG")
};

export function buildGameNightSummaries(
  data: AnalyticsData,
): GameNightSummary[] {
  return [...data.sessions]
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )
    .map((session) => buildGameNightSummaryFor(data, session));
}

function buildGameNightSummaryFor(
  data: AnalyticsData,
  session: GameNightSession,
): GameNightSummary {
  const attendeeIds =
    data.index.sessionPlayersByGameNight.get(session.id) ?? [];
  const attendees = attendeeIds
    .map((sp) => data.index.playersById.get(sp.player_id))
    .filter((p): p is GameNightPlayer => !!p)
    .sort(playerNameCollator);

  const gameSessions = (
    data.index.gameSessionsByGameNight.get(session.id) ?? []
  ).sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  const seenGameIds = new Set<string>();
  const gamesPlayed: GameNightGame[] = [];
  let roundCount = 0;
  let totalActiveSeconds = 0;

  for (const gs of gameSessions) {
    const game = data.index.gamesById.get(gs.game_id);
    if (game && !seenGameIds.has(game.id)) {
      seenGameIds.add(game.id);
      gamesPlayed.push(game);
    }
    const rounds = data.index.roundsByGameSession.get(gs.id) ?? [];
    roundCount += rounds.filter((r) => r.ended_at).length;
    const duration = gameSessionActiveDurationSeconds(gs);
    if (duration != null) totalActiveSeconds += duration;
  }

  return {
    session,
    attendees,
    gamesPlayed,
    gameSessionCount: gameSessions.length,
    roundCount,
    totalActiveSeconds,
    isActive: session.status !== "completed",
  };
}

// ── Game Night-detail (sectie 6/7/8/9/40) ────────────────────────────────
export type GameNightRoundDetail = {
  round: GameNightRound;
  winner: GameNightPlayer | null; // null = geen resultaat opgeslagen voor deze ronde
};

export type GameNightGameSessionDetail = {
  gameSession: GameNightGameSession;
  game: GameNightGame;
  participants: GameNightPlayer[];
  durationSeconds: number | null;
  rounds: GameNightRoundDetail[]; // alleen afgeronde rondes, op volgorde
  hasResult: boolean;
  results: {
    player: GameNightPlayer;
    isWinner: boolean;
    score: number | null;
    rank: number | null;
  }[]; // leeg als !hasResult
};

export type GameNightDetail = {
  session: GameNightSession;
  attendees: GameNightPlayer[];
  gameSessions: GameNightGameSessionDetail[]; // chronologisch, oudste eerst
  totals: {
    gamesPlayed: number;
    roundCount: number;
    totalActiveSeconds: number;
  };
  sessionWinsByPlayer: { player: GameNightPlayer; wins: number }[];
  roundWinsByPlayer: { player: GameNightPlayer; wins: number }[];
};

export function buildGameNightDetail(
  data: AnalyticsData,
  gameNightSessionId: string,
): GameNightDetail | null {
  const session = data.sessions.find((s) => s.id === gameNightSessionId);
  if (!session) return null;

  const summary = buildGameNightSummaryFor(data, session);

  const gameSessions = (
    data.index.gameSessionsByGameNight.get(session.id) ?? []
  ).sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  const sessionWinCounts = new Map<string, number>();
  const roundWinCounts = new Map<string, number>();

  const gameSessionDetails: GameNightGameSessionDetail[] = gameSessions
    .map((gs) => {
      const game = data.index.gamesById.get(gs.game_id);
      if (!game) return null;

      const participants = (
        data.index.gameSessionPlayersByGameSession.get(gs.id) ?? []
      )
        .map((gsp) => data.index.playersById.get(gsp.player_id))
        .filter((p): p is GameNightPlayer => !!p);

      const roundsRaw = (data.index.roundsByGameSession.get(gs.id) ?? [])
        .filter((r) => r.ended_at)
        .sort((a, b) => a.round_number - b.round_number);

      const rounds: GameNightRoundDetail[] = roundsRaw.map((round) => {
        const results = data.index.roundResultsByRound.get(round.id) ?? [];
        const winnerResult = results.find((r) => r.is_winner);
        const winner = winnerResult
          ? (data.index.playersById.get(winnerResult.player_id) ?? null)
          : null;
        if (winner) {
          roundWinCounts.set(
            winner.id,
            (roundWinCounts.get(winner.id) ?? 0) + 1,
          );
        }
        return { round, winner };
      });

      const resultRows =
        data.index.sessionResultsByGameSession.get(gs.id) ?? [];
      const hasResult = resultRows.length > 0;
      const results = resultRows
        .map((r) => {
          const player = data.index.playersById.get(r.player_id);
          if (!player) return null;
          if (r.is_winner) {
            sessionWinCounts.set(
              player.id,
              (sessionWinCounts.get(player.id) ?? 0) + 1,
            );
          }
          return {
            player,
            isWinner: r.is_winner,
            score: r.score,
            rank: r.rank,
          };
        })
        .filter((r): r is NonNullable<typeof r> => !!r)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      return {
        gameSession: gs,
        game,
        participants,
        durationSeconds: gameSessionActiveDurationSeconds(gs),
        rounds,
        hasResult,
        results,
      };
    })
    .filter((d): d is GameNightGameSessionDetail => !!d);

  const toLeaderList = (counts: Map<string, number>) =>
    [...counts.entries()]
      .map(([playerId, wins]) => {
        const player = data.index.playersById.get(playerId);
        return player ? { player, wins } : null;
      })
      .filter((e): e is { player: GameNightPlayer; wins: number } => !!e)
      .sort(
        (a, b) =>
          b.wins - a.wins || a.player.name.localeCompare(b.player.name, "nl"),
      );

  return {
    session,
    attendees: summary.attendees,
    gameSessions: gameSessionDetails,
    totals: {
      gamesPlayed: summary.gameSessionCount,
      roundCount: summary.roundCount,
      totalActiveSeconds: summary.totalActiveSeconds,
    },
    sessionWinsByPlayer: toLeaderList(sessionWinCounts),
    roundWinsByPlayer: toLeaderList(roundWinCounts),
  };
}

// ── Spelerprofiel (sectie 11-16) ─────────────────────────────────────────
export type PlayerGameStats = {
  game: GameNightGame;
  sessionsPlayed: number;
  roundsPlayed: number; // 0 voor een niet-rondespel
  roundsWon: number;
  sessionsWithResult: number; // noemer voor winrate (sectie 13)
  sessionWins: number;
  sessionWinratePct: number | null; // null als sessionsWithResult === 0
  // Game Night V2.2 (sectie 21) — canonieke WINs voor dit ene spel, welke
  // bron dan ook (legacy rondes/sessieresultaten of nieuwe win-events).
  // Los van roundsWon/sessionWins hierboven, die hun eigen specifieke
  // betekenis behouden.
  canonicalWins: number;
};

export type PlayerStats = {
  player: GameNightPlayer;
  gameNightsAttended: number; // game_night_session_players (sectie 37)
  gameSessionsPlayed: number; // totaal over alle spellen (sectie 2: sessions, niet rondes)
  sessionWins: number;
  roundWins: number;
  // Game Night V2.2 (sectie 21) — "lifetime wins": som van canonicalWins
  // over alle spellen heen, dezelfde optelvorm als sessionWins/roundWins
  // hierboven maar bron-onafhankelijk.
  canonicalWins: number;
  perGame: PlayerGameStats[]; // alleen spellen die deze speler ooit speelde
  mostPlayed: { game: GameNightGame; count: number } | null;
  mostSessionWins: { game: GameNightGame; count: number } | null;
  mostRoundWins: { game: GameNightGame; count: number } | null;
  averageSessionDurationSeconds: number | null;
  longestSession: { game: GameNightGame; seconds: number } | null;
  totalActiveSeconds: number;
};

export function buildPlayerStats(
  data: AnalyticsData,
  playerId: string,
): PlayerStats | null {
  const player = data.index.playersById.get(playerId);
  if (!player) return null;

  const gameNightsAttended = data.sessionPlayers.filter(
    (sp) => sp.player_id === playerId,
  ).length;

  const playedGameSessionIds = new Set(
    data.gameSessionPlayers
      .filter((gsp) => gsp.player_id === playerId)
      .map((gsp) => gsp.game_session_id),
  );

  const perGameMap = new Map<
    string,
    {
      game: GameNightGame;
      sessionsPlayed: number;
      roundsPlayed: number;
      roundsWon: number;
      sessionsWithResult: number;
      sessionWins: number;
      canonicalWins: number;
    }
  >();

  let totalActiveSeconds = 0;
  let durationSampleCount = 0;
  let longestSession: { game: GameNightGame; seconds: number } | null = null;

  for (const gameSessionId of playedGameSessionIds) {
    const gs = data.index.gameSessionsById.get(gameSessionId);
    if (!gs) continue;
    const game = data.index.gamesById.get(gs.game_id);
    if (!game) continue;

    const entry = perGameMap.get(game.id) ?? {
      game,
      sessionsPlayed: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      sessionsWithResult: 0,
      sessionWins: 0,
      canonicalWins: 0,
    };
    entry.sessionsPlayed += 1;

    // Canonieke wins: rechtstreeks uit de al-genormaliseerde WinRecords van
    // deze spelsessie — zelfde bron als getGameWinCounts/
    // collectPlayerGameMetrics, dus per definitie consistent daarmee.
    const sessionWinRecords =
      data.index.winRecordsByGameSession.get(gs.id) ?? [];
    entry.canonicalWins += sessionWinRecords.filter(
      (r) => r.player_id === playerId,
    ).length;

    const rounds = (data.index.roundsByGameSession.get(gs.id) ?? []).filter(
      (r) => r.ended_at,
    );
    for (const round of rounds) {
      const results = data.index.roundResultsByRound.get(round.id) ?? [];
      const own = results.find((r) => r.player_id === playerId);
      if (!own) continue; // speler deed niet mee aan deze specifieke ronde
      entry.roundsPlayed += 1;
      if (own.is_winner) entry.roundsWon += 1;
    }

    if (hasRegisteredResult(data, gs.id)) {
      const results = data.index.sessionResultsByGameSession.get(gs.id) ?? [];
      const own = results.find((r) => r.player_id === playerId);
      if (own) {
        entry.sessionsWithResult += 1;
        if (own.is_winner) entry.sessionWins += 1;
      }
    }

    perGameMap.set(game.id, entry);

    const duration = gameSessionActiveDurationSeconds(gs);
    if (duration != null) {
      totalActiveSeconds += duration;
      durationSampleCount += 1;
      if (!longestSession || duration > longestSession.seconds) {
        longestSession = { game, seconds: duration };
      }
    }
  }

  const perGame: PlayerGameStats[] = [...perGameMap.values()]
    .map((e) => ({
      game: e.game,
      sessionsPlayed: e.sessionsPlayed,
      roundsPlayed: e.roundsPlayed,
      roundsWon: e.roundsWon,
      sessionsWithResult: e.sessionsWithResult,
      sessionWins: e.sessionWins,
      sessionWinratePct:
        e.sessionsWithResult > 0
          ? Math.round((e.sessionWins / e.sessionsWithResult) * 100)
          : null,
      canonicalWins: e.canonicalWins,
    }))
    .sort((a, b) => b.sessionsPlayed - a.sessionsPlayed);

  const sessionWins = perGame.reduce((sum, g) => sum + g.sessionWins, 0);
  const roundWins = perGame.reduce((sum, g) => sum + g.roundsWon, 0);
  const canonicalWins = perGame.reduce((sum, g) => sum + g.canonicalWins, 0);

  const mostPlayed =
    perGame.length > 0
      ? { game: perGame[0].game, count: perGame[0].sessionsPlayed }
      : null;

  const bySessionWins = [...perGame].sort(
    (a, b) => b.sessionWins - a.sessionWins,
  );
  const mostSessionWins =
    bySessionWins.length > 0 && bySessionWins[0].sessionWins > 0
      ? { game: bySessionWins[0].game, count: bySessionWins[0].sessionWins }
      : null;

  const byRoundWins = [...perGame].sort((a, b) => b.roundsWon - a.roundsWon);
  const mostRoundWins =
    byRoundWins.length > 0 && byRoundWins[0].roundsWon > 0
      ? { game: byRoundWins[0].game, count: byRoundWins[0].roundsWon }
      : null;

  return {
    player,
    gameNightsAttended,
    gameSessionsPlayed: playedGameSessionIds.size,
    sessionWins,
    roundWins,
    canonicalWins,
    perGame,
    mostPlayed,
    mostSessionWins,
    mostRoundWins,
    averageSessionDurationSeconds:
      durationSampleCount > 0
        ? Math.round(totalActiveSeconds / durationSampleCount)
        : null,
    longestSession,
    totalActiveSeconds,
  };
}

// ── Directe rematch (sectie 38, exacte definitie) ────────────────────────
// Twee opeenvolgende game_night_game_sessions BINNEN DEZELFDE Game Night,
// met hetzelfde game_id en exact dezelfde deelnemersset (als Set, volgorde
// maakt niet uit). "Opeenvolgend" = buren in de op started_at gesorteerde
// lijst van spelsessies van die Game Night — een Game Night heeft nooit
// twee gelijktijdig open spelsessies (zie de partial unique index), dus
// chronologisch sorteren geeft altijd de echte speelvolgorde.
// `gameId` (optioneel, sectie 26 V6): filtert tot rematches van precies dat
// ene spel — zelfde functie, geen tweede rematch-implementatie op
// speldetail.
export function countDirectRematches(
  data: AnalyticsData,
  gameId?: string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const gameSessions of data.index.gameSessionsByGameNight.values()) {
    const sorted = [...gameSessions].sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.game_id !== curr.game_id) continue;
      if (gameId && curr.game_id !== gameId) continue;

      const prevSet = new Set(
        (data.index.gameSessionPlayersByGameSession.get(prev.id) ?? []).map(
          (p) => p.player_id,
        ),
      );
      const currIds = (
        data.index.gameSessionPlayersByGameSession.get(curr.id) ?? []
      ).map((p) => p.player_id);
      const currSet = new Set(currIds);
      const sameSet =
        prevSet.size === currSet.size &&
        [...prevSet].every((id) => currSet.has(id));
      if (!sameSet) continue;

      for (const playerId of currIds) {
        counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
      }
    }
  }

  return counts;
}

// ── Winstreak (sectie 39, expliciete gekozen regel) ──────────────────────
// Alleen spelsessies MET een geregistreerd resultaat tellen mee in de
// reeks; sessies zonder resultaat worden genegeerd (niet als verlies
// geteld, niet als streekbreker geteld — we weten simpelweg niet of de
// speler won of verloor). De streak is de langste aaneengesloten reeks
// win=true binnen die gefilterde, chronologisch gesorteerde reeks — over
// alle Game Nights/spellen heen, niet per spel.
export function longestWinStreak(
  data: AnalyticsData,
  playerId: string,
): number {
  const relevant = data.gameSessions
    .filter((gs) => hasRegisteredResult(data, gs.id))
    .filter((gs) =>
      (data.index.gameSessionPlayersByGameSession.get(gs.id) ?? []).some(
        (p) => p.player_id === playerId,
      ),
    )
    .sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );

  let best = 0;
  let current = 0;
  for (const gs of relevant) {
    const results = data.index.sessionResultsByGameSession.get(gs.id) ?? [];
    const own = results.find((r) => r.player_id === playerId);
    if (own?.is_winner) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

// ── Algemene records (sectie 18) ─────────────────────────────────────────
export type LeaderboardEntry = { player: GameNightPlayer; value: number };
export type Leaderboard = { entries: LeaderboardEntry[] }; // gedeeld record = meerdere entries (sectie 26), geen willekeurige eerste rij

// Geëxporteerd (was privé in V5) — sectie 32 V6: speldetail-records
// hergebruiken dezelfde leaderboard-vorm/tie-logica i.p.v. een eigen
// variant te schrijven.
export function buildLeaderboard(
  data: AnalyticsData,
  valueFor: (playerId: string) => number,
): Leaderboard {
  const values = data.players.map((p) => ({
    player: p,
    value: valueFor(p.id),
  }));
  const max = Math.max(0, ...values.map((v) => v.value));
  if (max === 0) return { entries: [] };
  return {
    entries: values
      .filter((v) => v.value === max)
      .sort((a, b) => a.player.name.localeCompare(b.player.name, "nl")),
  };
}

export type GeneralRecords = {
  mostGameNights: Leaderboard;
  mostGameSessions: Leaderboard;
  mostSessionWins: Leaderboard;
  mostRoundWins: Leaderboard;
  mostDifferentGamesWon: Leaderboard;
  // Sectie 9 (V7): drie extra algemene records, nodig voor de finale-
  // vergelijking — geen nieuwe definitie, gewoon dezelfde optelpatronen als
  // hierboven, uitgebreid met wat de ceremonie al noemt (Hall of Fame kan
  // ze later ook tonen, maar dat is geen V7-vereiste).
  mostDifferentGamesPlayed: Leaderboard;
  mostTotalActiveSeconds: Leaderboard; // value = seconden
  mostRematches: Leaderboard;
  longestWinStreak: Leaderboard;
};

export function buildGeneralRecords(data: AnalyticsData): GeneralRecords {
  const gameNightsById = new Map<string, number>();
  for (const sp of data.sessionPlayers) {
    gameNightsById.set(
      sp.player_id,
      (gameNightsById.get(sp.player_id) ?? 0) + 1,
    );
  }
  const gameSessionsById = new Map<string, number>();
  for (const gsp of data.gameSessionPlayers) {
    gameSessionsById.set(
      gsp.player_id,
      (gameSessionsById.get(gsp.player_id) ?? 0) + 1,
    );
  }
  const sessionWinsById = new Map<string, number>();
  for (const sr of data.sessionResults) {
    if (!sr.is_winner) continue;
    sessionWinsById.set(
      sr.player_id,
      (sessionWinsById.get(sr.player_id) ?? 0) + 1,
    );
  }
  const roundWinsById = new Map<string, number>();
  for (const rr of data.roundResults) {
    if (!rr.is_winner) continue;
    roundWinsById.set(rr.player_id, (roundWinsById.get(rr.player_id) ?? 0) + 1);
  }
  const differentGamesWonById = new Map<string, Set<string>>();
  for (const sr of data.sessionResults) {
    if (!sr.is_winner) continue;
    const gs = data.index.gameSessionsById.get(sr.game_session_id);
    if (!gs) continue;
    const set = differentGamesWonById.get(sr.player_id) ?? new Set<string>();
    set.add(gs.game_id);
    differentGamesWonById.set(sr.player_id, set);
  }
  const differentGamesPlayedById = new Map<string, Set<string>>();
  for (const gsp of data.gameSessionPlayers) {
    const gs = data.index.gameSessionsById.get(gsp.game_session_id);
    if (!gs) continue;
    const set =
      differentGamesPlayedById.get(gsp.player_id) ?? new Set<string>();
    set.add(gs.game_id);
    differentGamesPlayedById.set(gsp.player_id, set);
  }
  const totalActiveSecondsById = new Map<string, number>();
  for (const gsp of data.gameSessionPlayers) {
    const gs = data.index.gameSessionsById.get(gsp.game_session_id);
    if (!gs) continue;
    const duration = gameSessionActiveDurationSeconds(gs);
    if (duration == null) continue;
    totalActiveSecondsById.set(
      gsp.player_id,
      (totalActiveSecondsById.get(gsp.player_id) ?? 0) + duration,
    );
  }
  const rematchesById = countDirectRematches(data);

  return {
    mostGameNights: buildLeaderboard(data, (id) => gameNightsById.get(id) ?? 0),
    mostGameSessions: buildLeaderboard(
      data,
      (id) => gameSessionsById.get(id) ?? 0,
    ),
    mostSessionWins: buildLeaderboard(
      data,
      (id) => sessionWinsById.get(id) ?? 0,
    ),
    mostRoundWins: buildLeaderboard(data, (id) => roundWinsById.get(id) ?? 0),
    mostDifferentGamesWon: buildLeaderboard(
      data,
      (id) => differentGamesWonById.get(id)?.size ?? 0,
    ),
    mostDifferentGamesPlayed: buildLeaderboard(
      data,
      (id) => differentGamesPlayedById.get(id)?.size ?? 0,
    ),
    mostTotalActiveSeconds: buildLeaderboard(
      data,
      (id) => totalActiveSecondsById.get(id) ?? 0,
    ),
    mostRematches: buildLeaderboard(data, (id) => rematchesById.get(id) ?? 0),
    longestWinStreak: buildLeaderboard(data, (id) =>
      longestWinStreak(data, id),
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Speldetail (Game Night V6) — hergebruikt uitsluitend AnalyticsData/
// definities hierboven, geen tweede analytics-systeem. Alle nieuwe
// functies zijn per-spel varianten van dezelfde bouwstenen die V5 al
// gebruikt (hasRegisteredResult, gameSessionActiveDurationSeconds,
// buildLeaderboard, countDirectRematches).
// ═══════════════════════════════════════════════════════════════════════

// Stabiele URL voor een spel (sectie 2/37): slug als beschikbaar, anders
// het database-id als fallback — een spel zonder slug moet nog steeds
// aanklikbaar/deelbaar zijn.
export function gameDetailPath(
  game: Pick<GameNightGame, "id" | "slug">,
): string {
  return `/game-night/spellen/${game.slug ?? game.id}`;
}

// Route-param → spel: probeert eerst op slug, dan op id (sectie 2). Geeft
// null terug bij een onbekende param — de pagina toont dan een nette
// "niet gevonden"-state, geen crash.
export function findGameBySlugOrId(
  data: AnalyticsData,
  slugOrId: string,
): GameNightGame | null {
  return (
    data.games.find((g) => g.slug === slugOrId) ??
    data.index.gamesById.get(slugOrId) ??
    null
  );
}

// ── Per-speler cijfers voor precies één spel ──────────────────────────────
// De ene herbruikbare bouwsteen achter participatie/klassementen/records op
// speldetail ÉN de spel-specifieke awards (gameNightTitles.ts) — voorheen
// stond een vrijwel identieke functie alleen daar; nu hier, geëxporteerd,
// zodat er nergens een tweede versie van deze optelling bestaat.
export type PlayerGameMetrics = {
  playerId: string;
  sessionsPlayed: number; // game_night_game_session_players, ALLE sessies (ook zonder resultaat)
  roundsPlayed: number;
  roundsWon: number;
  sessionsWithResult: number; // noemer voor sessie-winrate
  sessionWins: number;
  // Game Night V2.2 — canonieke, bron-onafhankelijke telling: hoeveel keer
  // won deze speler dit spel (winRecords, welke bron dan ook), en hoeveel
  // "opportunities" had hij daarvoor (uniforme noemer, zie hieronder). Dit
  // is wat spel-specifieke titels (gameNightTitles.ts) voortaan gebruiken —
  // roundsWon/roundsPlayed/sessionsWithResult/sessionWins hierboven blijven
  // ONGEWIJZIGD hun eigen, specifieke historische betekenis behouden voor
  // wie die losse cijfers nog apart wil tonen (bv. speldetail/spelerprofiel).
  canonicalWins: number;
  canonicalOpportunities: number;
};

export function collectPlayerGameMetrics(
  data: AnalyticsData,
  gameId: string,
): Map<string, PlayerGameMetrics> {
  const metrics = new Map<string, PlayerGameMetrics>();
  const get = (playerId: string) => {
    let m = metrics.get(playerId);
    if (!m) {
      m = {
        playerId,
        sessionsPlayed: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        sessionsWithResult: 0,
        sessionWins: 0,
        canonicalWins: 0,
        canonicalOpportunities: 0,
      };
      metrics.set(playerId, m);
    }
    return m;
  };

  const gameSessions = data.gameSessions.filter((gs) => gs.game_id === gameId);
  for (const gs of gameSessions) {
    const participantIds = (
      data.index.gameSessionPlayersByGameSession.get(gs.id) ?? []
    ).map((p) => p.player_id);
    for (const playerId of participantIds) {
      get(playerId).sessionsPlayed += 1;
    }

    // Canonieke wins: rechtstreeks uit de al-genormaliseerde WinRecords van
    // deze spelsessie (index.winRecordsByGameSession) — dezelfde bron als
    // getGameWinCounts, dus per definitie consistent daarmee.
    const sessionWinRecords =
      data.index.winRecordsByGameSession.get(gs.id) ?? [];
    for (const record of sessionWinRecords) {
      get(record.player_id).canonicalWins += 1;
    }

    // Canonieke opportunities: EXACT dezelfde precedence als
    // normalizeWinRecords hierboven, zodat een pure-legacy verleden
    // bit-voor-bit dezelfde drempel/winrate oplevert als vóór V2.2 (sectie
    // 22: "historische consistentie"). win_events-sessies tellen altijd als
    // 1 opportunity per deelnemer (geen voltooiing vereist, net als hun
    // wins geen voltooiing vereisen); legacy niet-rondespellen tellen 1
    // opportunity per deelnemer maar ALLEEN als er een geregistreerd
    // resultaat is (identiek aan de bestaande sessionsWithResult-poort);
    // legacy rondespellen tellen per afgeronde ronde waaraan de speler
    // meedeed (identiek aan de bestaande roundsPlayed-telling, hieronder).
    if (gs.win_source === "win_events") {
      for (const playerId of participantIds) {
        get(playerId).canonicalOpportunities += 1;
      }
    } else if (!gs.uses_rounds && hasRegisteredResult(data, gs.id)) {
      for (const playerId of participantIds) {
        get(playerId).canonicalOpportunities += 1;
      }
    }

    const rounds = (data.index.roundsByGameSession.get(gs.id) ?? []).filter(
      (r) => r.ended_at,
    );
    for (const round of rounds) {
      const results = data.index.roundResultsByRound.get(round.id) ?? [];
      for (const r of results) {
        const m = get(r.player_id);
        m.roundsPlayed += 1;
        if (gs.win_source !== "win_events" && gs.uses_rounds) {
          m.canonicalOpportunities += 1;
        }
        if (r.is_winner) m.roundsWon += 1;
      }
    }

    const sessionResults =
      data.index.sessionResultsByGameSession.get(gs.id) ?? [];
    if (sessionResults.length === 0) continue;
    for (const r of sessionResults) {
      const m = get(r.player_id);
      m.sessionsWithResult += 1;
      if (r.is_winner) m.sessionWins += 1;
    }
  }

  return metrics;
}

// ── Hoofdstatistieken (sectie 4-5) ────────────────────────────────────────
export type GameStats = {
  game: GameNightGame;
  sessionsPlayed: number;
  roundsPlayed: number; // 0 = geen rondespel of nog nooit met rondes gespeeld
  averageActiveDurationSeconds: number | null;
  longestSessionSeconds: number | null;
  shortestSessionSeconds: number | null;
  lastPlayedAt: string | null; // started_at van de meest recente AFGERONDE sessie
};

export function getGameStats(
  data: AnalyticsData,
  gameId: string,
): GameStats | null {
  const game = data.index.gamesById.get(gameId);
  if (!game) return null;

  const gameSessions = data.gameSessions.filter((gs) => gs.game_id === gameId);

  let roundsPlayed = 0;
  let durationSum = 0;
  let durationCount = 0;
  let longest: number | null = null;
  let shortest: number | null = null;
  let lastPlayedAt: string | null = null;
  let completedCount = 0;

  for (const gs of gameSessions) {
    const rounds = (data.index.roundsByGameSession.get(gs.id) ?? []).filter(
      (r) => r.ended_at,
    );
    roundsPlayed += rounds.length;

    const duration = gameSessionActiveDurationSeconds(gs);
    if (duration != null) {
      durationSum += duration;
      durationCount += 1;
      if (longest == null || duration > longest) longest = duration;
      if (shortest == null || duration < shortest) shortest = duration;
    }
    if (gs.status === "completed") {
      completedCount += 1;
      if (!lastPlayedAt || gs.started_at > lastPlayedAt) {
        lastPlayedAt = gs.started_at;
      }
    }
  }

  return {
    game,
    sessionsPlayed: gameSessions.length,
    roundsPlayed,
    averageActiveDurationSeconds:
      durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    longestSessionSeconds: longest,
    shortestSessionSeconds: shortest,
    lastPlayedAt: completedCount > 0 ? lastPlayedAt : null,
  };
}

// ── Klassementen (sectie 9-13) — rondes en sessiewinsten ALTIJD gescheiden
export type GameLeaderboardEntry = {
  player: GameNightPlayer;
  wins: number;
  denominator: number; // roundsPlayed of sessionsWithResult, afhankelijk van het type
  winratePct: number;
};

export function getGameRoundLeaderboard(
  data: AnalyticsData,
  gameId: string,
): GameLeaderboardEntry[] {
  const metrics = collectPlayerGameMetrics(data, gameId);
  return [...metrics.values()]
    .filter((m) => m.roundsPlayed > 0)
    .map((m) => ({
      player: data.index.playersById.get(m.playerId)!,
      wins: m.roundsWon,
      denominator: m.roundsPlayed,
      winratePct: Math.round((m.roundsWon / m.roundsPlayed) * 100),
    }))
    .filter((e) => !!e.player)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winratePct - a.winratePct ||
        a.player.name.localeCompare(b.player.name, "nl"),
    );
}

export function getGameSessionLeaderboard(
  data: AnalyticsData,
  gameId: string,
): GameLeaderboardEntry[] {
  const metrics = collectPlayerGameMetrics(data, gameId);
  return [...metrics.values()]
    .filter((m) => m.sessionsWithResult > 0)
    .map((m) => ({
      player: data.index.playersById.get(m.playerId)!,
      wins: m.sessionWins,
      denominator: m.sessionsWithResult,
      winratePct: Math.round((m.sessionWins / m.sessionsWithResult) * 100),
    }))
    .filter((e) => !!e.player)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winratePct - a.winratePct ||
        a.player.name.localeCompare(b.player.name, "nl"),
    );
}

// ── Deelname (sectie 11): game_night_game_session_players, niet attendance
export type GameParticipationEntry = {
  player: GameNightPlayer;
  sessionsPlayed: number;
};

export function getGameParticipation(
  data: AnalyticsData,
  gameId: string,
): GameParticipationEntry[] {
  const metrics = collectPlayerGameMetrics(data, gameId);
  return [...metrics.values()]
    .map((m) => ({
      player: data.index.playersById.get(m.playerId)!,
      sessionsPlayed: m.sessionsPlayed,
    }))
    .filter((e) => !!e.player && e.sessionsPlayed > 0)
    .sort(
      (a, b) =>
        b.sessionsPlayed - a.sessionsPlayed ||
        a.player.name.localeCompare(b.player.name, "nl"),
    );
}

// ── Score-record (sectie 14) ──────────────────────────────────────────────
// Alleen getoond voor result_mode='score'-sessies: de bestaande
// CompleteGameSessionPanel.submitScores() bepaalt is_winner nu al app-breed
// via "hoogste score in de sessie wint" (geen enkel score-spel gebruikt
// momenteel een ander patroon) — dat is dus al de betrouwbare,
// AL-BESTAANDE aanname in de app, niet iets dat V6 hier verzint. Zodra een
// spel ooit "laagste score wint" zou moeten worden, hoort daar een echte
// `score_direction`-kolom bij (bewust NIET nu toegevoegd, zie opleverrapport)
// — tot die tijd geldt overal hetzelfde app-brede "hoger is beter".
export type GameScoreRecord = {
  player: GameNightPlayer;
  score: number;
  gameSessionId: string;
  playedAt: string;
};

export function getGameScoreRecord(
  data: AnalyticsData,
  gameId: string,
): GameScoreRecord | null {
  const scoreSessions = data.gameSessions.filter(
    (gs) => gs.game_id === gameId && gs.result_mode === "score",
  );
  let best: GameScoreRecord | null = null;
  for (const gs of scoreSessions) {
    const results = data.index.sessionResultsByGameSession.get(gs.id) ?? [];
    for (const r of results) {
      if (r.score == null) continue;
      if (!best || r.score > best.score) {
        const player = data.index.playersById.get(r.player_id);
        if (!player) continue;
        best = {
          player,
          score: r.score,
          gameSessionId: gs.id,
          playedAt: gs.started_at,
        };
      }
    }
  }
  return best;
}

// ── Records (sectie 24) ───────────────────────────────────────────────────
export type GameRecords = {
  mostSessionWins: Leaderboard;
  mostRoundWins: Leaderboard;
  mostSessionsPlayed: Leaderboard;
  longestSessionSeconds: number | null;
  shortestSessionSeconds: number | null;
  scoreRecord: GameScoreRecord | null;
  mostRematches: Leaderboard;
};

export function getGameRecords(
  data: AnalyticsData,
  gameId: string,
): GameRecords {
  const metrics = collectPlayerGameMetrics(data, gameId);
  const rematches = countDirectRematches(data, gameId);
  const stats = getGameStats(data, gameId);

  return {
    mostSessionWins: buildLeaderboard(
      data,
      (id) => metrics.get(id)?.sessionWins ?? 0,
    ),
    mostRoundWins: buildLeaderboard(
      data,
      (id) => metrics.get(id)?.roundsWon ?? 0,
    ),
    mostSessionsPlayed: buildLeaderboard(
      data,
      (id) => metrics.get(id)?.sessionsPlayed ?? 0,
    ),
    longestSessionSeconds: stats?.longestSessionSeconds ?? null,
    shortestSessionSeconds: stats?.shortestSessionSeconds ?? null,
    scoreRecord: getGameScoreRecord(data, gameId),
    mostRematches: buildLeaderboard(data, (id) => rematches.get(id) ?? 0),
  };
}

// ── Rivaliteit (sectie 15-19) ─────────────────────────────────────────────
// Head-to-head telt zodra beide spelers samen deelnamen aan dezelfde
// game_night_game_session van dit spel — andere deelnemers mogen er ook bij
// zijn (sectie 16), geen letterlijk 1v1-vereiste. Rondeparticipatie wordt
// NIET apart gemodelleerd (sectie 17): elke ronde-RPC schrijft al een
// resultaatrij voor iedere deelnemer van de spelsessie, dus "beide rivalen
// hebben in deze ronde meegespeeld" volgt gewoon uit het al bestaande
// round_results-patroon.
export type GameRivalry = {
  playerA: GameNightPlayer;
  playerB: GameNightPlayer;
  sharedSessions: number;
  sessionsWithResult: number;
  sessionWinsA: number;
  sessionWinsB: number;
  sessionsWithoutResult: number;
  sharedRounds: number;
  roundWinsA: number;
  roundWinsB: number;
  // Game Night V2.2 — canonieke head-to-head WINs (winRecords, welke bron
  // dan ook), naast (niet in plaats van) de bestaande ronde-/sessiespecifieke
  // tellingen hierboven. Dit is de blijvend correcte vergelijking zodra een
  // rivaliteit overstapt van legacy naar win_events: roundWinsA/B groeit dan
  // niet meer mee, winsA/B wel.
  winsA: number;
  winsB: number;
};

const DEFAULT_RIVALRY_MIN_SESSIONS = 3;

export function getGameRivalries(
  data: AnalyticsData,
  gameId: string,
  minSharedSessions = DEFAULT_RIVALRY_MIN_SESSIONS,
): GameRivalry[] {
  type Accumulator = Omit<GameRivalry, "playerA" | "playerB"> & {
    playerAId: string;
    playerBId: string;
  };
  const pairs = new Map<string, Accumulator>();

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const gameSessions = data.gameSessions.filter((gs) => gs.game_id === gameId);
  for (const gs of gameSessions) {
    const participantIds = (
      data.index.gameSessionPlayersByGameSession.get(gs.id) ?? []
    ).map((p) => p.player_id);
    if (participantIds.length < 2) continue;

    const sessionResults =
      data.index.sessionResultsByGameSession.get(gs.id) ?? [];
    const resultByPlayer = new Map(sessionResults.map((r) => [r.player_id, r]));
    const hasResult = sessionResults.length > 0;

    const rounds = (data.index.roundsByGameSession.get(gs.id) ?? []).filter(
      (r) => r.ended_at,
    );
    const roundResultsByRound = rounds.map(
      (round) => data.index.roundResultsByRound.get(round.id) ?? [],
    );

    for (let i = 0; i < participantIds.length; i++) {
      for (let j = i + 1; j < participantIds.length; j++) {
        const idA = participantIds[i];
        const idB = participantIds[j];
        const key = pairKey(idA, idB);
        let acc = pairs.get(key);
        if (!acc) {
          acc = {
            playerAId: idA < idB ? idA : idB,
            playerBId: idA < idB ? idB : idA,
            sharedSessions: 0,
            sessionsWithResult: 0,
            sessionWinsA: 0,
            sessionWinsB: 0,
            sessionsWithoutResult: 0,
            sharedRounds: 0,
            roundWinsA: 0,
            roundWinsB: 0,
            winsA: 0,
            winsB: 0,
          };
          pairs.set(key, acc);
        }
        const [orderedA] = [acc.playerAId];
        const aIsA = idA === orderedA;
        const realIdA = aIsA ? idA : idB;
        const realIdB = aIsA ? idB : idA;

        acc.sharedSessions += 1;
        if (hasResult) {
          acc.sessionsWithResult += 1;
          if (resultByPlayer.get(realIdA)?.is_winner) acc.sessionWinsA += 1;
          if (resultByPlayer.get(realIdB)?.is_winner) acc.sessionWinsB += 1;
        } else {
          acc.sessionsWithoutResult += 1;
        }

        for (const results of roundResultsByRound) {
          const rA = results.find((r) => r.player_id === realIdA);
          const rB = results.find((r) => r.player_id === realIdB);
          if (!rA || !rB) continue;
          acc.sharedRounds += 1;
          if (rA.is_winner) acc.roundWinsA += 1;
          if (rB.is_winner) acc.roundWinsB += 1;
        }

        // Canoniek: dezelfde WinRecords als overal elders (getGameWinCounts/
        // collectPlayerGameMetrics), gescoped tot deze ene gedeelde sessie.
        const sessionWinRecords =
          data.index.winRecordsByGameSession.get(gs.id) ?? [];
        for (const record of sessionWinRecords) {
          if (record.player_id === realIdA) acc.winsA += 1;
          else if (record.player_id === realIdB) acc.winsB += 1;
        }
      }
    }
  }

  return [...pairs.values()]
    .filter((acc) => acc.sharedSessions >= minSharedSessions)
    .map((acc) => {
      const playerA = data.index.playersById.get(acc.playerAId);
      const playerB = data.index.playersById.get(acc.playerBId);
      if (!playerA || !playerB) return null;
      const { playerAId: _a, playerBId: _b, ...rest } = acc;
      return { playerA, playerB, ...rest };
    })
    .filter((r): r is GameRivalry => !!r)
    .sort(
      (a, b) =>
        b.sharedSessions - a.sharedSessions ||
        b.sessionsWithResult - a.sessionsWithResult ||
        `${a.playerA.name}${a.playerB.name}`.localeCompare(
          `${b.playerA.name}${b.playerB.name}`,
          "nl",
        ),
    );
}

// Sectie 19: "grootste rivaliteit" = simpelweg de eerste van dezelfde,
// deterministisch gesorteerde lijst — geen aparte keuzelogica.
export function getBiggestRivalry(
  data: AnalyticsData,
  gameId: string,
  minSharedSessions = DEFAULT_RIVALRY_MIN_SESSIONS,
): GameRivalry | null {
  return getGameRivalries(data, gameId, minSharedSessions)[0] ?? null;
}

// ── Recent gespeeld (sectie 21-22) ────────────────────────────────────────
export type RecentGameSession = {
  gameSession: GameNightGameSession;
  gameNightSession: GameNightSession;
  participants: GameNightPlayer[];
  durationSeconds: number | null;
  winner: GameNightPlayer | null;
  hasResult: boolean;
  roundCount: number;
};

export function getRecentGameSessions(
  data: AnalyticsData,
  gameId: string,
  limit?: number,
): RecentGameSession[] {
  const gameSessions = data.gameSessions
    .filter((gs) => gs.game_id === gameId)
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
  const limited = limit != null ? gameSessions.slice(0, limit) : gameSessions;

  return limited
    .map((gs) => {
      const gameNightSession = data.sessions.find(
        (s) => s.id === gs.game_night_session_id,
      );
      if (!gameNightSession) return null;

      const participants = (
        data.index.gameSessionPlayersByGameSession.get(gs.id) ?? []
      )
        .map((p) => data.index.playersById.get(p.player_id))
        .filter((p): p is GameNightPlayer => !!p);

      const results = data.index.sessionResultsByGameSession.get(gs.id) ?? [];
      const winnerResult = results.find((r) => r.is_winner);
      const winner = winnerResult
        ? (data.index.playersById.get(winnerResult.player_id) ?? null)
        : null;

      const roundCount = (
        data.index.roundsByGameSession.get(gs.id) ?? []
      ).filter((r) => r.ended_at).length;

      return {
        gameSession: gs,
        gameNightSession,
        participants,
        durationSeconds: gameSessionActiveDurationSeconds(gs),
        winner,
        hasResult: results.length > 0,
        roundCount,
      };
    })
    .filter((r): r is RecentGameSession => !!r);
}

// ═══════════════════════════════════════════════════════════════════════
// Chronologisch slicen (Game Night V7) — de bouwsteen achter "wat was de
// stand vóór deze avond" / "wat is de stand t/m deze avond", gebruikt door
// de finale om objectief te bepalen wat er door één specifieke Game Night
// veranderde, zonder ook maar één extra query of parallelle datastructuur:
// gewoon dezelfde AnalyticsData-vorm, opnieuw opgebouwd uit een subset
// rijen.
// ═══════════════════════════════════════════════════════════════════════

// Sectie 34: chronologie op started_at, met id als stabiele tie-break bij
// (zeldzame) gelijke timestamps — nooit de array-volgorde van het
// Supabase-antwoord.
function compareGameNightChrono(
  a: Pick<GameNightSession, "started_at" | "id">,
  b: Pick<GameNightSession, "started_at" | "id">,
): number {
  const diff =
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sliceAnalyticsToGameNightIds(
  data: AnalyticsData,
  includedGameNightIds: Set<string>,
): AnalyticsData {
  const sessions = data.sessions.filter((s) => includedGameNightIds.has(s.id));
  const sessionPlayers = data.sessionPlayers.filter((sp) =>
    includedGameNightIds.has(sp.session_id),
  );
  const gameSessions = data.gameSessions.filter((gs) =>
    includedGameNightIds.has(gs.game_night_session_id),
  );
  const gameSessionIds = new Set(gameSessions.map((gs) => gs.id));
  const gameSessionPlayers = data.gameSessionPlayers.filter((p) =>
    gameSessionIds.has(p.game_session_id),
  );
  const rounds = data.rounds.filter((r) =>
    gameSessionIds.has(r.game_session_id),
  );
  const roundIds = new Set(rounds.map((r) => r.id));
  const roundResults = data.roundResults.filter((rr) =>
    roundIds.has(rr.round_id),
  );
  const sessionResults = data.sessionResults.filter((sr) =>
    gameSessionIds.has(sr.game_session_id),
  );
  // Game Night V2.1: win-events horen rechtstreeks bij een game_session_id
  // (geen ronde-indirectie nodig), dus dezelfde gameSessionIds-set volstaat.
  const winEvents = data.winEvents.filter((we) =>
    gameSessionIds.has(we.game_session_id),
  );

  // Spelers/spellen zelf blijven ONgefilterd (sectie 3/35): het gaat om wie
  // op welk moment PARTICIPEERDE, niet om wanneer een speler/spel-rij zelf
  // is aangemaakt — zo resolven namen/covers altijd correct, ook in een
  // "before"-slice van vóór iemands eerste avond (die speler heeft daar dan
  // gewoon nergens statistieken in staan, wat correct is).
  return createAnalyticsData({
    sessions,
    sessionPlayers,
    players: data.players,
    games: data.games,
    gameSessions,
    gameSessionPlayers,
    rounds,
    roundResults,
    sessionResults,
    winEvents,
  });
}

// Sectie 3/33/35: "before" = alle Game Nights vóór deze avond, "through" =
// alle Game Nights tot en met deze avond. Voor een HISTORISCHE
// finale-replay is dit essentieel: `data` mag gerust ook Game Nights ná
// `session` bevatten (het is dezelfde gecachete dataset voor de hele
// app), maar die worden hier bewust uitgesloten uit "through" — anders
// zou een oude finale met terugwerkende kracht veranderen door latere
// avonden.
export function sliceAnalyticsAtGameNight(
  data: AnalyticsData,
  session: GameNightSession,
  mode: "before" | "through",
): AnalyticsData {
  const included = new Set(
    data.sessions
      .filter((s) => {
        const cmp = compareGameNightChrono(s, session);
        return mode === "before" ? cmp < 0 : cmp <= 0;
      })
      .map((s) => s.id),
  );
  return sliceAnalyticsToGameNightIds(data, included);
}

// Alleen de rijen van precies één Game Night (voor avondstatistieken/
// "vanavond"-rematches — sectie 20/26) — geen before/after-vergelijking,
// gewoon een schone deelverzameling van dezelfde AnalyticsData-vorm.
export function sliceAnalyticsForSingleGameNight(
  data: AnalyticsData,
  gameNightSessionId: string,
): AnalyticsData {
  return sliceAnalyticsToGameNightIds(data, new Set([gameNightSessionId]));
}
