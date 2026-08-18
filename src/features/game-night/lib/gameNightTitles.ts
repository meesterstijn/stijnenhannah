import type { GameNightGame, GameNightPlayer } from "@/lib/supabase";
import {
  buildGeneralRecords,
  collectPlayerGameMetrics,
  countDirectRematches,
  type AnalyticsData,
  type PlayerGameMetrics,
} from "@/features/game-night/lib/gameNightStats";

// Automatische titels (Game Night V5, sectie 19-28) — titels zijn NOOIT
// handmatig op een speler opgeslagen; ze worden hier elke keer opnieuw uit
// de historie berekend. Als iemand morgen het record overneemt, wisselt de
// titel dus vanzelf mee (sectie 19/50: geen player_awards-cachetabel).

// ── Spel-specifieke titels (sectie 20-22/25, gemigreerd naar canonieke
// WINs in Game Night V2.2 sectie 17-19) ──────────────────────────────────
export type GameAwardConfig = {
  slug: string;
  title: string;
  // V2.2: niet langer "round_wins"/"session_wins" — elke spel-specifieke
  // titel beantwoordt nu uniform "wie wint dit spel het vaakst?" via de
  // canonieke WinRecord-laag (PlayerGameMetrics.canonicalWins/
  // canonicalOpportunities in gameNightStats.ts), ongeacht of de winst
  // historisch uit rondes, sessieresultaten of nieuwe win-events kwam. De
  // drempelwaarden zelf zijn bewust ongewijzigd overgenomen (5 voor Skull,
  // 3 voor de rest) — canonicalOpportunities reduceert voor puur-legacy
  // data exact tot de oude roundsPlayed/sessionsWithResult (zie
  // gameNightStats.ts), dus bestaande titelhouders/drempels wijzigen niet
  // met terugwerkende kracht door deze migratie op zich.
  minOpportunities: number;
};

// Uitbreidbaar: een nieuw spel-specifieke titel toevoegen is één regel
// hier, geen nieuwe databasekolom, geen aparte UI-code (sectie 22). Alleen
// slugs die ook echt in game_night_games voorkomen leveren een toegekende
// titel op — een slug die (nog) niet bestaat wordt gewoon overgeslagen.
export const GAME_AWARD_CONFIGS: GameAwardConfig[] = [
  { slug: "skull", title: "Skullcrusher", minOpportunities: 5 },
  { slug: "catan", title: "Kolonist der Kolonisten", minOpportunities: 3 },
  { slug: "hitster", title: "Hitster DJ", minOpportunities: 3 },
  { slug: "sequence", title: "Sequence Master", minOpportunities: 3 },
];

export type GameAwardResult = {
  config: GameAwardConfig;
  game: GameNightGame | null; // null = slug bestaat (nog) niet in de spellenkast
  holders: GameNightPlayer[]; // leeg = "Nog niet uitgereikt"; >1 = gedeeld record
  metricValue: number | null;
  requirementText: string;
};

// `collectPlayerGameMetrics` verhuisde in Game Night V6 naar
// gameNightStats.ts (gameDetailPath e.a. hebben 'm ook nodig) — hier alleen
// nog hergebruikt, niet opnieuw geïmplementeerd.
type PlayerGameMetric = PlayerGameMetrics;

// Tie-break regel (sectie 26/51, letterlijk zoals gevraagd): wins → winrate
// → gedeeld indien nog gelijk. Nooit een willekeurige eerste database-rij.
// V2.2: "wins" en "winrate" komen nu uit canonicalWins/canonicalOpportunities
// i.p.v. apart round_wins/session_wins-pad — zie GameAwardConfig hierboven.
function resolveGameAward(
  data: AnalyticsData,
  config: GameAwardConfig,
  game: GameNightGame,
): GameAwardResult {
  const metrics = [...collectPlayerGameMetrics(data, game.id).values()];

  const eligible = metrics.filter(
    (m) => m.canonicalOpportunities >= config.minOpportunities,
  );

  const requirementText = `Speel minimaal ${config.minOpportunities} keer ${game.name}.`;

  if (eligible.length === 0) {
    return { config, game, holders: [], metricValue: null, requirementText };
  }

  const primaryValue = (m: PlayerGameMetric) => m.canonicalWins;
  const winrate = (m: PlayerGameMetric) =>
    m.canonicalOpportunities > 0
      ? m.canonicalWins / m.canonicalOpportunities
      : 0;

  const maxPrimary = Math.max(...eligible.map(primaryValue));
  if (maxPrimary === 0) {
    return { config, game, holders: [], metricValue: null, requirementText };
  }

  const topByPrimary = eligible.filter((m) => primaryValue(m) === maxPrimary);
  const maxWinrate = Math.max(...topByPrimary.map(winrate));
  const winners = topByPrimary.filter((m) => winrate(m) === maxWinrate);

  const holders = winners
    .map((m) => data.index.playersById.get(m.playerId))
    .filter((p): p is GameNightPlayer => !!p)
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return { config, game, holders, metricValue: maxPrimary, requirementText };
}

export function buildGameAwards(data: AnalyticsData): GameAwardResult[] {
  return GAME_AWARD_CONFIGS.map((config) => {
    const game = data.games.find((g) => g.slug === config.slug) ?? null;
    if (!game) {
      return {
        config,
        game: null,
        holders: [],
        metricValue: null,
        requirementText: "Dit spel staat nog niet in de spellenkast.",
      };
    }
    return resolveGameAward(data, config, game);
  });
}

// ── Algemene, speelse titels (sectie 23-24) ──────────────────────────────
// Bewust alleen POSITIEVE titels (sectie 24) — geen "pechvogel"-achtige
// varianten in V5.
export type GeneralAwardKey =
  | "veelvraat"
  | "alleskunner"
  | "rematchkoning"
  | "marathonspeler"
  | "avondmens";

export type GeneralAwardConfig = {
  key: GeneralAwardKey;
  title: string;
  description: string;
  minValue: number;
};

export const GENERAL_AWARD_CONFIGS: GeneralAwardConfig[] = [
  {
    key: "veelvraat",
    title: "Veelvraat",
    description: "Meeste verschillende spellen gespeeld",
    minValue: 3,
  },
  {
    key: "alleskunner",
    title: "Alleskunner",
    description: "Meeste verschillende spellen gewonnen",
    minValue: 2,
  },
  {
    key: "rematchkoning",
    title: "Rematchkoning",
    description: "Meeste directe rematches gespeeld",
    minValue: 1,
  },
  {
    key: "marathonspeler",
    title: "Marathonspeler",
    description: "Meeste totale actieve speeltijd",
    minValue: 3600,
  },
  {
    key: "avondmens",
    title: "Avondmens",
    description: "Meeste Game Nights bijgewoond",
    minValue: 3,
  },
];

export type GeneralAwardResult = {
  config: GeneralAwardConfig;
  holders: GameNightPlayer[];
  value: number | null;
};

function metricMap(
  data: AnalyticsData,
  key: GeneralAwardKey,
): Map<string, number> {
  switch (key) {
    case "veelvraat": {
      const distinctGames = new Map<string, Set<string>>();
      for (const gsp of data.gameSessionPlayers) {
        const gs = data.index.gameSessionsById.get(gsp.game_session_id);
        if (!gs) continue;
        const set = distinctGames.get(gsp.player_id) ?? new Set<string>();
        set.add(gs.game_id);
        distinctGames.set(gsp.player_id, set);
      }
      return new Map([...distinctGames].map(([id, set]) => [id, set.size]));
    }
    case "alleskunner": {
      const distinctWonGames = new Map<string, Set<string>>();
      for (const sr of data.sessionResults) {
        if (!sr.is_winner) continue;
        const gs = data.index.gameSessionsById.get(sr.game_session_id);
        if (!gs) continue;
        const set = distinctWonGames.get(sr.player_id) ?? new Set<string>();
        set.add(gs.game_id);
        distinctWonGames.set(sr.player_id, set);
      }
      return new Map([...distinctWonGames].map(([id, set]) => [id, set.size]));
    }
    case "rematchkoning":
      return countDirectRematches(data);
    case "marathonspeler": {
      const totals = new Map<string, number>();
      for (const p of data.players) {
        const stats = data.gameSessionPlayers.filter(
          (gsp) => gsp.player_id === p.id,
        );
        let sum = 0;
        for (const gsp of stats) {
          const gs = data.index.gameSessionsById.get(gsp.game_session_id);
          if (!gs) continue;
          const duration =
            gs.ended_at != null
              ? Math.max(
                  0,
                  (new Date(gs.ended_at).getTime() -
                    new Date(gs.started_at).getTime()) /
                    1000 -
                    gs.total_paused_seconds,
                )
              : 0;
          sum += duration;
        }
        totals.set(p.id, sum);
      }
      return totals;
    }
    case "avondmens": {
      const totals = new Map<string, number>();
      for (const sp of data.sessionPlayers) {
        totals.set(sp.player_id, (totals.get(sp.player_id) ?? 0) + 1);
      }
      return totals;
    }
  }
}

export function buildGeneralAwards(data: AnalyticsData): GeneralAwardResult[] {
  return GENERAL_AWARD_CONFIGS.map((config) => {
    const values = metricMap(data, config.key);
    const eligible = [...values.entries()].filter(
      ([, v]) => v >= config.minValue,
    );
    if (eligible.length === 0) {
      return { config, holders: [], value: null };
    }
    const max = Math.max(...eligible.map(([, v]) => v));
    const holders = eligible
      .filter(([, v]) => v === max)
      .map(([playerId]) => data.index.playersById.get(playerId))
      .filter((p): p is GameNightPlayer => !!p)
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
    return { config, holders, value: max };
  });
}

// ── Homepage-kampioen (sectie 27/28) ──────────────────────────────────────
// Deterministische prioriteit, nooit willekeurig/tijdgebaseerd wisselend:
// 1. huidige Skullcrusher (enkele houder)
// 2. algemene session-wins leider (enkel)
// 3. round-wins leider (enkel)
// 4. speler met de meeste bijgewoonde Game Nights (enkel)
// Een gedeeld record op elke stap valt door naar de volgende stap — de
// champion-plaque toont altijd precies één naam, nooit "Hannah & Stijn".
export type HomepageChampion = {
  player: GameNightPlayer;
  titleLabel: string;
  detailLine: string;
};

export function buildHomepageChampion(
  data: AnalyticsData,
): HomepageChampion | null {
  const skullcrusher = buildGameAwards(data).find(
    (a) => a.config.title === "Skullcrusher",
  );
  if (skullcrusher && skullcrusher.holders.length === 1) {
    return {
      player: skullcrusher.holders[0],
      titleLabel: "Skullcrusher",
      detailLine: `${skullcrusher.metricValue} Skull-rondes gewonnen`,
    };
  }

  const records = buildGeneralRecords(data);

  if (records.mostSessionWins.entries.length === 1) {
    const entry = records.mostSessionWins.entries[0];
    return {
      player: entry.player,
      titleLabel: "Meeste session wins",
      detailLine: `${entry.value} session wins`,
    };
  }

  if (records.mostRoundWins.entries.length === 1) {
    const entry = records.mostRoundWins.entries[0];
    return {
      player: entry.player,
      titleLabel: "Meeste ronde-overwinningen",
      detailLine: `${entry.value} rondes gewonnen`,
    };
  }

  if (records.mostGameNights.entries.length === 1) {
    const entry = records.mostGameNights.entries[0];
    return {
      player: entry.player,
      titleLabel: "Meest toegewijd",
      detailLine: `${entry.value} Game Nights bijgewoond`,
    };
  }

  return null;
}

// ── Titels van één specifieke speler (sectie 12: spelerprofiel-header) ──
// Spel-specifieke titels eerst (prestigieuzer/specifieker), dan algemene.
// Gedeelde titels (meerdere houders) tellen gewoon mee voor iedere houder.
export type PlayerTitle = { title: string; detail: string };

export function titlesForPlayer(
  data: AnalyticsData,
  playerId: string,
): PlayerTitle[] {
  const titles: PlayerTitle[] = [];

  for (const award of buildGameAwards(data)) {
    if (award.holders.some((h) => h.id === playerId)) {
      titles.push({
        title: award.config.title,
        detail:
          `${award.metricValue} keer ${award.game?.name ?? ""} gewonnen`.trim(),
      });
    }
  }

  for (const award of buildGeneralAwards(data)) {
    if (award.holders.some((h) => h.id === playerId)) {
      titles.push({
        title: award.config.title,
        detail: award.config.description,
      });
    }
  }

  return titles;
}
