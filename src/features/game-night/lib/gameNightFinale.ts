import type {
  GameNightGame,
  GameNightPlayer,
  GameNightSession,
} from "@/lib/supabase";
import {
  buildGameNightDetail,
  buildGeneralRecords,
  countDirectRematches,
  sliceAnalyticsAtGameNight,
  sliceAnalyticsForSingleGameNight,
  type AnalyticsData,
  type GameNightGameSessionDetail,
  type GeneralRecords,
  type Leaderboard,
} from "@/features/game-night/lib/gameNightStats";
import {
  buildGameAwards,
  type GameAwardResult,
} from "@/features/game-night/lib/gameNightTitles";
import { formatDuration } from "@/features/game-night/lib/gameTimer";
import { HIDDEN_INFO_TYPES } from "@/features/game-night/lib/checkpointPhotoTypes";
import type { CheckpointPhotoWithUrl } from "@/features/game-night/hooks/useCheckpointPhotos";

// Finale (Game Night V7): presenteert uitsluitend wat al opgeslagen is
// (sectie 2) — geen enkele functie hier schrijft naar Supabase of houdt
// een eigen "waarheid" bij. Alles wordt telkens opnieuw uit historie
// gereconstrueerd via sliceAnalyticsAtGameNight (before/through) +
// dezelfde V5/V6 award-/record-functies. Zie sectie 36: dit gebruikt
// bewust de HUIDIGE titelregels/minimumdrempels, ook voor een historische
// avond — als die regels later wijzigen, kan een oude finale in theorie
// anders reconstrueren. Voor V7 is dat een geaccepteerde, gedocumenteerde
// beperking (geen rule-versioning systeem).

// ── Event-model (sectie 32) ───────────────────────────────────────────────
export type FinaleEventType =
  | "game-title-unlocked"
  | "game-title-changed"
  | "game-title-shared"
  | "record-new-holder"
  | "record-sharpened"
  | "record-first";

export type FinaleEvent = {
  id: string;
  type: FinaleEventType;
  priority: number;
  players: GameNightPlayer[]; // huidige houder(s)
  previousPlayers: GameNightPlayer[]; // vorige houder(s) — leeg bij unlock/eerste record
  game: GameNightGame | null; // spel-specifieke titel, anders null (algemeen record)
  eyebrow: string;
  title: string;
  subtitle: string;
  narrative: string | null; // neutrale, deterministische vergelijkende zin — geen AI-tekst
  trivial: boolean; // sectie 45: onderdrukbaar eerste-record-ruis (bv. "1 Game Night bijgewoond")
};

function classifyHolderChange(
  beforeIds: Set<string>,
  afterIds: Set<string>,
): "none" | "unlocked" | "joined" | "narrowed" | "changed" {
  const same =
    beforeIds.size === afterIds.size &&
    [...beforeIds].every((id) => afterIds.has(id));
  if (same) return "none";
  if (beforeIds.size === 0) return "unlocked";
  const isSuperset =
    afterIds.size > beforeIds.size &&
    [...beforeIds].every((id) => afterIds.has(id));
  if (isSuperset) return "joined";
  const isSubset =
    afterIds.size > 0 &&
    afterIds.size < beforeIds.size &&
    [...afterIds].every((id) => beforeIds.has(id));
  if (isSubset) return "narrowed";
  return "changed";
}

function names(players: GameNightPlayer[]): string {
  return players.map((p) => p.name).join(" & ");
}

// Sectie 5-8: exacte titelwijziging-regels. Alle vier de gevraagde
// gevallen (overname, gelijk gebleven, eerste titel, gedeeld
// erbij/eruit) worden hier één keer beslist — nooit los in UI-code.
function compareGameAward(
  before: GameAwardResult,
  after: GameAwardResult,
): FinaleEvent | null {
  if (!after.game) return null;
  const beforeIds = new Set(before.holders.map((h) => h.id));
  const afterIds = new Set(after.holders.map((h) => h.id));
  const kind = classifyHolderChange(beforeIds, afterIds);
  if (kind === "none") return null;

  // V2.2: geen round_wins/session_wins-onderscheid meer — canonicalWins
  // is uniform "overwinningen", ongeacht bron.
  const subtitle = `${after.metricValue} overwinningen`;
  const id = `game-award-${after.config.slug}`;

  if (kind === "unlocked") {
    return {
      id,
      type: "game-title-unlocked",
      priority: 100,
      players: after.holders,
      previousPlayers: [],
      game: after.game,
      eyebrow: "Titel ontgrendeld",
      title: after.config.title,
      subtitle,
      narrative: null,
      trivial: false,
    };
  }

  if (kind === "joined") {
    const joiners = after.holders.filter((h) => !beforeIds.has(h.id));
    return {
      id,
      type: "game-title-shared",
      priority: 85,
      players: after.holders,
      previousPlayers: before.holders,
      game: after.game,
      eyebrow: "Gedeelde titel",
      title: after.config.title,
      subtitle,
      narrative: `${names(joiners)} voegt zich bij ${names(before.holders)} als gedeeld titelhouder.`,
      trivial: false,
    };
  }

  if (kind === "narrowed") {
    return {
      id,
      type: "game-title-shared",
      priority: 85,
      players: after.holders,
      previousPlayers: before.holders,
      game: after.game,
      eyebrow: "Gedeelde titel",
      title: after.config.title,
      subtitle,
      narrative:
        after.holders.length === 1
          ? `${after.holders[0].name} is nu de enige titelhouder.`
          : `${names(after.holders)} blijven gedeeld titelhouder.`,
      trivial: false,
    };
  }

  // "changed" — echte overname
  const isCleanTakeover =
    before.holders.length === 1 && after.holders.length === 1;
  return {
    id,
    type: "game-title-changed",
    priority: 95,
    players: after.holders,
    previousPlayers: before.holders,
    game: after.game,
    eyebrow: `Nieuwe ${after.config.title}`,
    title: after.config.title,
    subtitle,
    narrative: isCleanTakeover
      ? `${after.holders[0].name} neemt de titel over van ${before.holders[0].name}.`
      : `De titel verschuift van ${names(before.holders)} naar ${names(after.holders)}.`,
    trivial: false,
  };
}

// Sectie 9-10: algemene all-time records. "Aangescherpt" (zelfde houder,
// hogere waarde) krijgt bewust een lage prioriteit — hij was al
// recordhouder, dat is geen groot moment (sectie 10.A).
function compareGeneralRecord(
  key: string,
  label: string,
  before: Leaderboard,
  after: Leaderboard,
  formatValue: (v: number) => string,
): FinaleEvent | null {
  const beforeIds = new Set(before.entries.map((e) => e.player.id));
  const afterIds = new Set(after.entries.map((e) => e.player.id));
  const kind = classifyHolderChange(beforeIds, afterIds);
  const afterValue = after.entries[0]?.value ?? 0;
  const id = `general-record-${key}`;

  if (kind === "none") {
    const beforeValue = before.entries[0]?.value ?? 0;
    if (afterValue > beforeValue) {
      return {
        id,
        type: "record-sharpened",
        priority: 50,
        players: after.entries.map((e) => e.player),
        previousPlayers: [],
        game: null,
        eyebrow: "Record aangescherpt",
        title: label,
        subtitle: formatValue(afterValue),
        narrative: null,
        trivial: false,
      };
    }
    return null;
  }

  if (kind === "unlocked") {
    const trivial = afterValue <= 1;
    return {
      id,
      type: "record-first",
      priority: trivial ? 20 : 70,
      players: after.entries.map((e) => e.player),
      previousPlayers: [],
      game: null,
      eyebrow: "Eerste record gevestigd",
      title: label,
      subtitle: formatValue(afterValue),
      narrative: null,
      trivial,
    };
  }

  // joined / narrowed / changed — op algemeen-recordniveau allemaal
  // "nieuwe recordhouder" (geen aparte "gedeeld"-copy zoals bij titels,
  // de opdracht vraagt dat onderscheid alleen expliciet voor titels).
  return {
    id,
    type: "record-new-holder",
    priority: 90,
    players: after.entries.map((e) => e.player),
    previousPlayers: before.entries.map((e) => e.player),
    game: null,
    eyebrow: "Nieuwe recordhouder",
    title: label,
    subtitle: formatValue(afterValue),
    narrative:
      before.entries.length > 0
        ? `${names(after.entries.map((e) => e.player))} neemt het record over van ${names(before.entries.map((e) => e.player))}.`
        : null,
    trivial: false,
  };
}

export type FinaleEventBundle = {
  headline: FinaleEvent[];
  bundled: FinaleEvent[];
};

// Sectie 11: maximaal 5 grote awardmomenten, de rest compact gebundeld.
const MAX_HEADLINE_EVENTS = 5;

// De hoofdfunctie (conceptueel "compareGameNightImpact", sectie 3):
// vergelijkt before/through-analytics voor precies deze Game Night en
// levert een deterministisch geprioriteerde, gecapte lijst met
// award-/recordmomenten. Nooit database-schrijvend, altijd herleidbaar uit
// dezelfde AnalyticsData die de rest van Game Night al gebruikt.
export function buildFinaleEvents(
  data: AnalyticsData,
  session: GameNightSession,
): FinaleEventBundle {
  const before = sliceAnalyticsAtGameNight(data, session, "before");
  const after = sliceAnalyticsAtGameNight(data, session, "through");

  const events: FinaleEvent[] = [];

  const beforeAwards = buildGameAwards(before);
  const afterAwards = buildGameAwards(after);
  for (const afterAward of afterAwards) {
    const beforeAward = beforeAwards.find(
      (a) => a.config.slug === afterAward.config.slug,
    );
    if (!beforeAward) continue;
    const event = compareGameAward(beforeAward, afterAward);
    if (event) events.push(event);
  }

  const beforeRecords = buildGeneralRecords(before);
  const afterRecords = buildGeneralRecords(after);
  const recordDefs: {
    key: keyof GeneralRecords;
    label: string;
    format: (v: number) => string;
  }[] = [
    {
      key: "mostGameNights",
      label: "Meeste Game Nights bijgewoond",
      format: String,
    },
    {
      key: "mostGameSessions",
      label: "Meeste game sessions gespeeld",
      format: String,
    },
    { key: "mostSessionWins", label: "Meeste session wins", format: String },
    { key: "mostRoundWins", label: "Meeste round wins", format: String },
    {
      key: "mostDifferentGamesWon",
      label: "Meeste verschillende spellen gewonnen",
      format: String,
    },
    {
      key: "mostDifferentGamesPlayed",
      label: "Meeste verschillende spellen gespeeld",
      format: String,
    },
    {
      key: "mostTotalActiveSeconds",
      label: "Meeste totale actieve speeltijd",
      format: (v) => formatDuration(v),
    },
    { key: "mostRematches", label: "Meeste directe rematches", format: String },
    { key: "longestWinStreak", label: "Langste winstreak", format: String },
  ];
  for (const def of recordDefs) {
    const event = compareGeneralRecord(
      def.key,
      def.label,
      beforeRecords[def.key],
      afterRecords[def.key],
      def.format,
    );
    if (event) events.push(event);
  }

  const nonTrivial = events.filter((e) => !e.trivial);
  const trivial = events.filter((e) => e.trivial);
  const sorted = [...nonTrivial].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );

  return {
    headline: sorted.slice(0, MAX_HEADLINE_EVENTS),
    bundled: [...sorted.slice(MAX_HEADLINE_EVENTS), ...trivial],
  };
}

// ── Avondstatistieken (sectie 20-21) — expliciet GEEN lifetime-titels ────
export type GameNightFunStat = {
  key: string;
  label: string;
  holders: GameNightPlayer[];
  value: string;
};

export function getGameNightFunStats(
  data: AnalyticsData,
  session: GameNightSession,
): GameNightFunStat[] {
  const detail = buildGameNightDetail(data, session.id);
  if (!detail) return [];
  const stats: GameNightFunStat[] = [];

  if (detail.sessionWinsByPlayer.length > 0) {
    const max = detail.sessionWinsByPlayer[0].wins;
    stats.push({
      key: "session-wins",
      label: "Meeste spelwinsten vanavond",
      holders: detail.sessionWinsByPlayer
        .filter((w) => w.wins === max)
        .map((w) => w.player),
      value: String(max),
    });
  }

  if (detail.roundWinsByPlayer.length > 0) {
    const max = detail.roundWinsByPlayer[0].wins;
    stats.push({
      key: "round-wins",
      label: "Meeste rondewinsten vanavond",
      holders: detail.roundWinsByPlayer
        .filter((w) => w.wins === max)
        .map((w) => w.player),
      value: String(max),
    });
  }

  const withDuration = detail.gameSessions.filter(
    (g): g is GameNightGameSessionDetail & { durationSeconds: number } =>
      g.durationSeconds != null,
  );
  if (withDuration.length > 0) {
    const longest = withDuration.reduce((a, b) =>
      b.durationSeconds > a.durationSeconds ? b : a,
    );
    stats.push({
      key: "longest",
      label: "Langste partij",
      holders: [],
      value: `${longest.game.name} · ${formatDuration(longest.durationSeconds)}`,
    });
    const shortest = withDuration.reduce((a, b) =>
      b.durationSeconds < a.durationSeconds ? b : a,
    );
    if (shortest.gameSession.id !== longest.gameSession.id) {
      stats.push({
        key: "shortest",
        label: "Kortste voltooide partij",
        holders: [],
        value: `${shortest.game.name} · ${formatDuration(shortest.durationSeconds)}`,
      });
    }
  }

  const sessionCountByGame = new Map<string, number>();
  for (const gs of detail.gameSessions) {
    sessionCountByGame.set(
      gs.game.id,
      (sessionCountByGame.get(gs.game.id) ?? 0) + 1,
    );
  }
  const topGame = [...sessionCountByGame.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (topGame && topGame[1] > 1) {
    const game = detail.gameSessions.find(
      (gs) => gs.game.id === topGame[0],
    )!.game;
    stats.push({
      key: "most-played-game",
      label: "Meest gespeeld vanavond",
      holders: [],
      value: `${game.name} · ${topGame[1]}×`,
    });
  }

  const sessionsPlayedByPlayer = new Map<string, number>();
  const distinctGamesByPlayer = new Map<string, Set<string>>();
  for (const gs of detail.gameSessions) {
    for (const p of gs.participants) {
      sessionsPlayedByPlayer.set(
        p.id,
        (sessionsPlayedByPlayer.get(p.id) ?? 0) + 1,
      );
      const set = distinctGamesByPlayer.get(p.id) ?? new Set<string>();
      set.add(gs.game.id);
      distinctGamesByPlayer.set(p.id, set);
    }
  }
  const maxSessionsPlayed = Math.max(0, ...sessionsPlayedByPlayer.values());
  if (maxSessionsPlayed > 1) {
    stats.push({
      key: "most-games-played",
      label: "Meeste spellen meegespeeld",
      holders: detail.attendees.filter(
        (p) => sessionsPlayedByPlayer.get(p.id) === maxSessionsPlayed,
      ),
      value: String(maxSessionsPlayed),
    });
  }
  const maxDistinctGames = Math.max(
    0,
    ...[...distinctGamesByPlayer.values()].map((s) => s.size),
  );
  if (maxDistinctGames > 1) {
    stats.push({
      key: "most-different-games",
      label: "Meeste verschillende spellen gespeeld",
      holders: detail.attendees.filter(
        (p) =>
          (distinctGamesByPlayer.get(p.id)?.size ?? 0) === maxDistinctGames,
      ),
      value: String(maxDistinctGames),
    });
  }

  const nightSlice = sliceAnalyticsForSingleGameNight(data, session.id);
  const rematches = countDirectRematches(nightSlice);
  const maxRematches = Math.max(0, ...rematches.values());
  if (maxRematches > 0) {
    const holderIds = new Set(
      [...rematches.entries()]
        .filter(([, v]) => v === maxRematches)
        .map(([id]) => id),
    );
    stats.push({
      key: "rematches",
      label: "Meeste directe rematches",
      holders: detail.attendees.filter((p) => holderIds.has(p.id)),
      value: String(maxRematches),
    });
  }

  return stats;
}

// ── Foto's van de avond (sectie 22-25) ────────────────────────────────────
export type FinalePhoto = {
  gameSessionId: string;
  photo: CheckpointPhotoWithUrl;
};

// Sectie 22/63: cards/player-foto's mogen NOOIT automatisch groot getoond
// worden in de ceremonie — zelfde HIDDEN_INFO_TYPES-set als de bestaande
// checkpoint-viewer, hier als pure, los testbare predicate (geen
// Supabase/netwerk nodig om deze regel te verifiëren).
export function isCeremonySafePhotoType(
  photoType: CheckpointPhotoWithUrl["photo_type"],
): boolean {
  return !HIDDEN_INFO_TYPES.has(photoType);
}

// Sectie 23: max 1 representatieve (niet-verborgen) foto per spelsessie,
// gekozen deterministisch — eerste checkpoint chronologisch met een
// veilige foto, eerste veilige foto daarbinnen op sort_order. Pure functie
// (geen netwerk): de hook (useFinalePhotos) haalt de rijen op en filtert
// vooraf op isCeremonySafePhotoType, dit bepaalt alleen de selectie.
export function pickRepresentativePhotosPerSession(
  checkpointsChronological: { id: string; game_session_id: string }[],
  safePhotosByCheckpoint: Map<string, CheckpointPhotoWithUrl[]>,
): FinalePhoto[] {
  const bySession = new Map<string, FinalePhoto>();
  for (const checkpoint of checkpointsChronological) {
    if (bySession.has(checkpoint.game_session_id)) continue;
    const candidates = safePhotosByCheckpoint.get(checkpoint.id);
    if (!candidates || candidates.length === 0) continue;
    bySession.set(checkpoint.game_session_id, {
      gameSessionId: checkpoint.game_session_id,
      photo: candidates[0],
    });
  }
  return [...bySession.values()];
}

const MAX_FINALE_PHOTOS = 4;

// Laatste stap: cap op het totaal aantal ceremony-foto's.
export function selectFinalePhotos(candidates: FinalePhoto[]): FinalePhoto[] {
  return candidates.slice(0, MAX_FINALE_PHOTOS);
}

// ── Stappen (sectie 12/44) ────────────────────────────────────────────────
export type FinaleStepId =
  | "intro"
  | "tonight"
  | "results"
  | "moments"
  | "awards"
  | "podium";

export function buildFinaleSteps(input: {
  hasResults: boolean;
  hasPhotos: boolean;
  hasHeadlineEvents: boolean;
}): FinaleStepId[] {
  const steps: FinaleStepId[] = ["intro", "tonight"];
  if (input.hasResults) steps.push("results");
  if (input.hasPhotos) steps.push("moments");
  if (input.hasHeadlineEvents) steps.push("awards");
  steps.push("podium");
  return steps;
}
