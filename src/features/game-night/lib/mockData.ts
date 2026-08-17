// ⚠️ MOCKDATA — deze module bevat uitsluitend placeholder-gegevens voor
// onderdelen die nog geen eigen Supabase-tabel hebben: spelers, potjes,
// Game Nights en Hall of Fame (zie het opleverrapport voor de analyse
// waarom dat in deze stap bewust nog niet gebouwd is — section 20 van de
// opdracht). Alleen de spellenkast zelf (game_night_games) is echte data,
// zie hooks/useGameNightGames.ts.
//
// Elke export hier is MOCK_-geprefixt. Vervang deze module zodra de echte
// tabellen bestaan — de componenten die dit consumeren (ChampionPlaque,
// RecentlyPlayedSection, StatsStrip, HallOfFamePreview) blijven ongewijzigd,
// ze accepteren gewoon dezelfde propvormen.

export type MockChampion = {
  name: string;
  streak: number;
  remark: string;
};

export const MOCK_CURRENT_CHAMPION: MockChampion = {
  name: "Hannah",
  streak: 4,
  remark: "De rest noemt het statistische ruis.",
};

export type MockRecentSession = {
  id: string;
  gameName: string;
  playedAt: string;
  players: string[];
  winner: string;
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const MOCK_RECENT_SESSIONS: MockRecentSession[] = [
  {
    id: "mock-1",
    gameName: "Carcassonne",
    playedAt: daysAgo(2),
    players: ["Hannah", "Stijn"],
    winner: "Hannah",
  },
  {
    id: "mock-2",
    gameName: "Skull",
    playedAt: daysAgo(6),
    players: ["Hannah", "Stijn", "Sanne", "Bram"],
    winner: "Bram",
  },
  {
    id: "mock-3",
    gameName: "Just One",
    playedAt: daysAgo(9),
    players: ["Hannah", "Stijn", "Sanne", "Bram", "Julia"],
    winner: "Iedereen",
  },
  {
    id: "mock-4",
    gameName: "Catan",
    playedAt: daysAgo(13),
    players: ["Hannah", "Stijn", "Julia"],
    winner: "Stijn",
  },
];

export type MockStats = {
  totalSessions: number;
  totalGameNights: number;
  totalPlayers: number;
};

export const MOCK_STATS: MockStats = {
  totalSessions: 184,
  totalGameNights: 27,
  totalPlayers: 8,
};

export type MockHallOfFameEntry = {
  title: string;
  holder: string;
};

export const MOCK_HALL_OF_FAME_PREVIEW: MockHallOfFameEntry[] = [
  { title: "Overall kampioen", holder: "Hannah" },
  { title: "Kolonist der Kolonisten", holder: "Stijn" },
  { title: "Hitster DJ", holder: "Sanne" },
  { title: "Skullcrusher", holder: "Bram" },
  { title: "De Grote Dalmuti", holder: "Julia" },
];
