import type { GameNightPlayer } from "@/lib/supabase";
import {
  buildGeneralRecords,
  getGameRivalries,
  longestWinStreak,
  type AnalyticsData,
} from "@/features/game-night/lib/gameNightStats";

// Game Night V2.10.5 (Arena Fase 1, sectie "automatische scènerotatie") —
// puur data in, data uit: welke scènes hebben ECHT genoeg data om te tonen
// (sectie "scène-prioriteit": "niet willekeurig irrelevante statistieken
// tonen"), en welke inhoud hoort daarbij. Geen JSX, geen Supabase-call —
// hergebruikt uitsluitend de al bestaande, al opgehaalde
// gameNightStats.ts-functies/-data (geen nieuwe query, geen nieuwe
// aggregatie-tabel). TAFEL is bewust GEEN scène hier: die blijft de
// bestaande ArenaPlayerLayout/ArenaSetupPhoto-render in
// GameNightV2Arena.tsx zelf, dit bestand gaat alleen over de vier
// AANVULLENDE scènes.

export type ArenaSceneId =
  | "tafel"
  | "vanavond"
  | "rivaliteit"
  | "historisch"
  | "record";

export type VanavondStanding = { player: GameNightPlayer; wins: number };

export type VanavondSceneData = {
  standings: VanavondStanding[]; // aflopend gesorteerd op wins, alleen wins > 0
};

export type RivaliteitSceneData = {
  playerA: GameNightPlayer;
  playerB: GameNightPlayer;
  winsA: number;
  winsB: number;
  headline: string;
};

export type HistorischSceneData = {
  player: GameNightPlayer;
  sentence: string; // volledige NL-zin, klaar om te tonen
};

export type RecordSceneData = {
  player: GameNightPlayer;
  streak: number;
};

const MIN_RIVALRY_SHARED_SESSIONS = 2;
const MIN_NOTABLE_STREAK = 3;

// Sectie "rivaliteit": droge/prikkelende, NIET beledigende tekst — puur
// data-driven op basis van het puntverschil, geen AI-call, geen willekeur
// (zelfde uitkomst bij elke render van dezelfde stand, geen flakiness).
function rivalryHeadline(winsA: number, winsB: number): string {
  const gap = Math.abs(winsA - winsB);
  if (gap === 0) return "Nog altijd gelijk — wie breekt de patstelling?";
  if (gap === 1) return "Dit begint persoonlijk te worden.";
  if (gap <= 3) return "Eén overwinning en de rollen zijn omgedraaid.";
  return "Dit is inmiddels een gewoonte aan het worden.";
}

export function resolveVanavondScene(
  participants: GameNightPlayer[],
  activeWinsByPlayer: Map<string, number>,
): VanavondSceneData | null {
  const standings = participants
    .map((player) => ({ player, wins: activeWinsByPlayer.get(player.id) ?? 0 }))
    .filter((s) => s.wins > 0)
    .sort((a, b) => b.wins - a.wins);
  if (standings.length === 0) return null;
  return { standings };
}

export function resolveRivaliteitScene(
  data: AnalyticsData,
  gameId: string,
  participants: GameNightPlayer[],
): RivaliteitSceneData | null {
  const participantIds = new Set(participants.map((p) => p.id));
  const rivalry = getGameRivalries(
    data,
    gameId,
    MIN_RIVALRY_SHARED_SESSIONS,
  ).find(
    (r) => participantIds.has(r.playerA.id) && participantIds.has(r.playerB.id),
  );
  if (!rivalry) return null;
  return {
    playerA: rivalry.playerA,
    playerB: rivalry.playerB,
    winsA: rivalry.winsA,
    winsB: rivalry.winsB,
    headline: rivalryHeadline(rivalry.winsA, rivalry.winsB),
  };
}

export function resolveHistorischScene(
  data: AnalyticsData,
  participants: GameNightPlayer[],
): HistorischSceneData | null {
  const participantIds = new Set(participants.map((p) => p.id));
  const records = buildGeneralRecords(data);
  const candidates: {
    board: typeof records.mostSessionWins;
    sentence: (n: number) => string;
  }[] = [
    {
      board: records.mostSessionWins,
      sentence: (n) =>
        `heeft dit al ${n}× gewonnen — een vertrouwd gezicht op het podium.`,
    },
    {
      board: records.mostGameNights,
      sentence: (n) =>
        `was al bij ${n} Game Nights aanwezig — een vaste waarde.`,
    },
    {
      board: records.mostDifferentGamesWon,
      sentence: (n) => `heeft al ${n} verschillende spellen weten te winnen.`,
    },
    {
      board: records.mostRematches,
      sentence: (n) => `vraagt het vaakst om een directe rematch (${n}×).`,
    },
  ];
  for (const { board, sentence } of candidates) {
    const entry = board.entries.find((e) => participantIds.has(e.player.id));
    if (entry) {
      return { player: entry.player, sentence: sentence(entry.value) };
    }
  }
  return null;
}

export function resolveRecordScene(
  data: AnalyticsData,
  participants: GameNightPlayer[],
): RecordSceneData | null {
  let best: RecordSceneData | null = null;
  for (const player of participants) {
    const streak = longestWinStreak(data, player.id);
    if (streak >= MIN_NOTABLE_STREAK && (!best || streak > best.streak)) {
      best = { player, streak };
    }
  }
  return best;
}

// De ENE plek die bepaalt welke aanvullende scènes vanavond daadwerkelijk
// beschikbaar zijn — GameNightV2Arena.tsx bouwt hier de rotatievolgorde
// omheen (TAFEL blijft altijd primair aanwezig, zie het opleverrapport).
export function resolveAvailableArenaScenes(input: {
  analyticsData: AnalyticsData | undefined;
  gameId: string;
  participants: GameNightPlayer[];
  activeWinsByPlayer: Map<string, number>;
}): {
  vanavond: VanavondSceneData | null;
  rivaliteit: RivaliteitSceneData | null;
  historisch: HistorischSceneData | null;
  record: RecordSceneData | null;
} {
  const { analyticsData, gameId, participants, activeWinsByPlayer } = input;
  const vanavond = resolveVanavondScene(participants, activeWinsByPlayer);
  if (!analyticsData) {
    return { vanavond, rivaliteit: null, historisch: null, record: null };
  }
  return {
    vanavond,
    rivaliteit: resolveRivaliteitScene(analyticsData, gameId, participants),
    historisch: resolveHistorischScene(analyticsData, participants),
    record: resolveRecordScene(analyticsData, participants),
  };
}
