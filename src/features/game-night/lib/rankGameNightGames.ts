import type { GameDifficulty, GameNightGame } from "@/lib/supabase";
import { gameTagLabel } from "@/features/game-night/lib/gameTags";

// Pure, deterministische adviesengine voor "Kies voor ons" (Game Night V4,
// sectie 8-14). Geen AI/API/internet-aanroepen, geen winnaars-/persoonlijke
// statistiekinvloed (sectie 15/40) — uitsluitend spelmetadata + eenvoudige,
// uitlegbare rekenregels. Bewust opgesplitst in kleine pure functies zodat
// een toekomstig signaal (favorieten, ratings, groepshistorie — sectie 16)
// als extra term toegevoegd kan worden zonder deze formule te herschrijven.

export type DurationPreference = "any" | "short" | "medium" | "long";

export const DURATION_PREFERENCE_TARGET_MINUTES: Record<
  Exclude<DurationPreference, "any">,
  number
> = {
  short: 15,
  medium: 30,
  long: 60,
};

export type GameHistoryEntry = {
  lastPlayedAt: string | null;
  playCount: number;
};

export type RankGameNightGamesInput = {
  games: GameNightGame[];
  playerCount: number;
  preferredDuration?: DurationPreference;
  preferredTags?: string[];
  preferredDifficulty?: GameDifficulty | null;
  history?: Map<string, GameHistoryEntry>;
  now?: Date;
};

export type RankedGame = {
  game: GameNightGame;
  score: number;
  reasons: string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Hard filters (sectie 8/9): niet-gearchiveerd + spelersaantal past. Nooit
// omzeild door een voorkeur — een spel dat hier niet doorheen komt, komt
// ook nooit in de gescoorde lijst of in Game Roulette terecht.
export function hardFilterGames(
  games: GameNightGame[],
  playerCount: number,
): GameNightGame[] {
  return games.filter((game) => {
    if (game.archived_at) return false;
    if (game.min_players != null && playerCount < game.min_players)
      return false;
    if (game.max_players != null && playerCount > game.max_players)
      return false;
    return true;
  });
}

// Geen voorkeur of onbekende duur → neutrale score (0.7), nooit een
// harde straf voor ontbrekende data (sectie 27). Bekende duur + voorkeur:
// volledige score binnen 10 minuten van het streefpunt, daarna lineair
// aflopend tot 0 op 60 minuten afstand.
function durationScore(
  preference: DurationPreference,
  durationMinutes: number | null,
): number {
  if (preference === "any" || durationMinutes == null) return 0.7;
  const target = DURATION_PREFERENCE_TARGET_MINUTES[preference];
  const diff = Math.abs(durationMinutes - target);
  return clamp01(1 - Math.max(0, diff - 10) / 50);
}

// Geen gekozen tags → neutraal (0.7). Spel zonder tags → licht onzeker
// (0.5), nooit 0 (sectie 27: onvolledige metadata mag geen kandidaat
// uitsluiten of hard afstraffen). Anders: aandeel van de gekozen tags dat
// het spel ook heeft.
function tagScore(preferredTags: string[], gameTags: string[]): number {
  if (preferredTags.length === 0) return 0.7;
  if (gameTags.length === 0) return 0.5;
  const gameSet = new Set(gameTags.map((t) => t.toLowerCase()));
  const matched = preferredTags.filter((t) => gameSet.has(t.toLowerCase()));
  return matched.length / preferredTags.length;
}

const DIFFICULTY_ORDER: GameDifficulty[] = ["licht", "gemiddeld", "zwaar"];

// Optioneel signaal (sectie 9): geen voorkeur of onbekende moeilijkheid →
// neutraal. Exacte match = vol, één stap verschil = half, twee stappen
// verschil (licht vs. zwaar) = bijna niets.
function difficultyScore(
  preference: GameDifficulty | null | undefined,
  gameDifficulty: GameDifficulty | null,
): number {
  if (!preference) return 0.7;
  if (!gameDifficulty) return 0.5;
  const distance = Math.abs(
    DIFFICULTY_ORDER.indexOf(preference) -
      DIFFICULTY_ORDER.indexOf(gameDifficulty),
  );
  if (distance === 0) return 1;
  if (distance === 1) return 0.5;
  return 0.15;
}

// Mild signaal, kan spelersaantal-compatibiliteit nooit overstemmen omdat
// het pas ná de harde filter meetelt (sectie 13). Nooit gespeeld → milde
// bonus (0.75, geen volle 1 — voorkomt dat één nieuw spel altijd wint).
// Recent gespeeld (<3 dagen) → lichte terughoudendheid. Lang niet gespeeld
// → lichte aanmoediging.
function recencyScore(
  lastPlayedAt: string | null | undefined,
  now: Date,
): number {
  if (!lastPlayedAt) return 0.75;
  const days =
    (now.getTime() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 3) return 0.3;
  if (days < 14) return 0.55;
  return 0.85;
}

// Sectie 14: populariteit mag nooit domineren, dus bewust een vlakke,
// bescheiden waarde i.p.v. een schaal die met het aantal keer gespeeld
// meegroeit — alleen "nooit gespeeld" krijgt een klein ontdek-duwtje.
function popularityScore(playCount: number): number {
  return playCount === 0 ? 0.85 : 0.6;
}

const WEIGHTS = {
  duration: 30,
  tags: 30,
  difficulty: 15,
  recency: 15,
  popularity: 10,
} as const;

function buildReasons(
  game: GameNightGame,
  playerCount: number,
  input: Required<
    Pick<
      RankGameNightGamesInput,
      "preferredDuration" | "preferredTags" | "preferredDifficulty"
    >
  >,
  history: GameHistoryEntry | undefined,
  now: Date,
): string[] {
  const reasons: string[] = [`Geschikt voor ${playerCount} spelers`];

  if (input.preferredDuration !== "any" && game.duration_minutes != null) {
    const target =
      DURATION_PREFERENCE_TARGET_MINUTES[
        input.preferredDuration as Exclude<DurationPreference, "any">
      ];
    if (Math.abs(game.duration_minutes - target) <= 15) {
      reasons.push(`Duurt ongeveer ${game.duration_minutes} minuten`);
    }
  }

  if (input.preferredTags.length > 0) {
    const gameTagSet = new Set(game.tags.map((t) => t.toLowerCase()));
    const matched = input.preferredTags.filter((t) =>
      gameTagSet.has(t.toLowerCase()),
    );
    if (matched.length > 0) {
      reasons.push(`Past bij ${matched.map(gameTagLabel).join(", ")}`);
    }
  }

  if (
    input.preferredDifficulty &&
    game.difficulty === input.preferredDifficulty
  ) {
    reasons.push(`Moeilijkheid past: ${game.difficulty}`);
  }

  if (!history || history.playCount === 0) {
    reasons.push("Nog nooit gespeeld — leuk om te ontdekken");
  } else if (history.lastPlayedAt) {
    const days =
      (now.getTime() - new Date(history.lastPlayedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > 21) reasons.push("Alweer even geleden gespeeld");
  }

  if (
    game.duration_minutes == null ||
    game.tags.length === 0 ||
    game.difficulty == null
  ) {
    reasons.push("Spelinfo nog niet volledig ingevuld");
  }

  return reasons.slice(0, 4);
}

// Sectie 8-14: past hard filters toe, scoort de rest 0-100 (gewogen som van
// vijf factoren, elk 0-1) en geeft per spel 2-4 korte, neutrale (geen
// winnaars-bias) redenen terug. Zowel `history` als de voorkeuren zijn
// optioneel — ontbrekende input geeft altijd neutrale scores, nooit NaN of
// een crash.
export function rankGameNightGames(
  input: RankGameNightGamesInput,
): RankedGame[] {
  const preferredDuration = input.preferredDuration ?? "any";
  const preferredTags = input.preferredTags ?? [];
  const preferredDifficulty = input.preferredDifficulty ?? null;
  const now = input.now ?? new Date();

  const candidates = hardFilterGames(input.games, input.playerCount);

  return candidates
    .map((game) => {
      const history = input.history?.get(game.id);

      const duration = durationScore(preferredDuration, game.duration_minutes);
      const tags = tagScore(preferredTags, game.tags);
      const difficulty = difficultyScore(preferredDifficulty, game.difficulty);
      const recency = recencyScore(history?.lastPlayedAt, now);
      const popularity = popularityScore(history?.playCount ?? 0);

      const rawScore =
        duration * WEIGHTS.duration +
        tags * WEIGHTS.tags +
        difficulty * WEIGHTS.difficulty +
        recency * WEIGHTS.recency +
        popularity * WEIGHTS.popularity;

      return {
        game,
        score: Math.round(rawScore),
        reasons: buildReasons(
          game,
          input.playerCount,
          { preferredDuration, preferredTags, preferredDifficulty },
          history,
          now,
        ),
      };
    })
    .sort((a, b) => b.score - a.score);
}
