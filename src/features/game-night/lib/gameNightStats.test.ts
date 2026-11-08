import { describe, expect, it } from "vitest";
import {
  buildGameNightDetail,
  createAnalyticsData,
  getRecentGameSessions,
  type GameNightAnalyticsRaw,
} from "./gameNightStats";

const player = (id: string, name: string) => ({ id, name }) as never;
const event = (id: string, player_id: string, undone = false) =>
  ({
    id,
    game_session_id: "gs1",
    player_id,
    created_at: "2026-11-08T20:00:00Z",
    undone_at: undone ? "2026-11-08T20:01:00Z" : null,
  }) as never;

function data(winEvents: never[]) {
  const raw = {
    sessions: [
      {
        id: "night",
        name: "Avond",
        status: "completed",
        started_at: "2026-11-08T19:00:00Z",
      },
    ],
    sessionPlayers: [],
    players: [player("a", "Anna"), player("b", "Bram"), player("c", "Cas")],
    games: [{ id: "g", name: "Hitster" }],
    gameSessions: [
      {
        id: "gs1",
        game_night_session_id: "night",
        game_id: "g",
        status: "completed",
        started_at: "2026-11-08T19:30:00Z",
        ended_at: "2026-11-08T20:30:00Z",
        total_paused_seconds: 0,
        win_source: "win_events",
        result_mode: "winner",
        has_session_winner: true,
      },
    ],
    gameSessionPlayers: ["a", "b", "c"].map((player_id, seat_order) => ({
      game_session_id: "gs1",
      player_id,
      seat_order,
    })),
    rounds: [],
    roundResults: [],
    sessionResults: [],
    winEvents,
  } as unknown as GameNightAnalyticsRaw;
  return createAnalyticsData(raw);
}

describe("history for WIN-event games", () => {
  it("shows the player with the most active WINs as winner", () => {
    const d = data([
      event("1", "b"),
      event("2", "b"),
      event("3", "a"),
      event("4", "a", true), // undone: does not count
    ]);
    const game = buildGameNightDetail(d, "night")!.gameSessions[0];
    expect(game.hasResult).toBe(true);
    expect(
      game.results.filter((r) => r.isWinner).map((r) => r.player.name),
    ).toEqual(["Bram"]);
    expect(game.results.map((r) => [r.player.name, r.score])).toEqual([
      ["Bram", 2],
      ["Anna", 1],
      ["Cas", 0],
    ]);
    expect(buildGameNightDetail(d, "night")!.sessionWinsByPlayer).toEqual([
      { player: expect.objectContaining({ name: "Bram" }), wins: 1 },
    ]);
    expect(getRecentGameSessions(d, "g")[0].winner?.name).toBe("Bram");
  });

  it("shares the win on a tie and reports no result without WINs", () => {
    const tie = buildGameNightDetail(
      data([event("1", "a"), event("2", "c")]),
      "night",
    )!.gameSessions[0];
    expect(
      tie.results.filter((r) => r.isWinner).map((r) => r.player.name),
    ).toEqual(["Anna", "Cas"]);

    const none = buildGameNightDetail(data([]), "night")!.gameSessions[0];
    expect(none.hasResult).toBe(false);
    expect(none.results).toEqual([]);
  });
});
