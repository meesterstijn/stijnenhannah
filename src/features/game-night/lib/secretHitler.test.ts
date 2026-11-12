import { describe, expect, it } from "vitest";
import {
  analyzeClaims,
  buildSecretHitlerState,
  chancellorIneligibility,
  drawOdds,
  eligibleChancellors,
  fascistTrackPowers,
  roleDistribution,
  validateRoles,
  winningPlayers,
  type ShEvent,
  type ShEventPayload,
} from "@/features/game-night/lib/secretHitler";
import {
  buildAwards,
  buildSecretHitlerCareer,
  buildStory,
} from "@/features/game-night/lib/secretHitlerStory";

const seats7 = ["a", "b", "c", "d", "e", "f", "g"];
const seats5 = ["a", "b", "c", "d", "e"];

function events(...payloads: ShEventPayload[]): ShEvent[] {
  return payloads.map((payload, i) => ({
    id: `e${i}`,
    created_at: `2026-11-12T20:00:${String(i).padStart(2, "0")}.000Z`,
    payload,
  }));
}

const ja = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, "ja" as const]));

function govt(
  chancellorId: string,
  policy: "L" | "F",
  extra: { presidentClaim?: number; chancellorClaim?: number } = {},
): ShEventPayload[] {
  return [
    { type: "nominate", chancellorId },
    { type: "vote", passed: true, votes: {} },
    {
      type: "enact",
      policy,
      presidentClaim: extra.presidentClaim ?? null,
      chancellorClaim: extra.chancellorClaim ?? null,
    },
  ];
}

describe("Secret Hitler setup", () => {
  it("verdeelt rollen per spelersaantal", () => {
    expect(roleDistribution(5)).toEqual({ liberals: 3, fascists: 1 });
    expect(roleDistribution(7)).toEqual({ liberals: 4, fascists: 2 });
    expect(roleDistribution(10)).toEqual({ liberals: 6, fascists: 3 });
  });

  it("kent per spelersaantal het juiste bord", () => {
    expect(fascistTrackPowers(5)[2]).toBe("peek");
    expect(fascistTrackPowers(8)[1]).toBe("investigate");
    expect(fascistTrackPowers(9)[0]).toBe("investigate");
  });

  it("begint in setup en daarna bij de gekozen president", () => {
    expect(buildSecretHitlerState(seats7, []).phase).toBe("setup");
    const s = buildSecretHitlerState(
      seats7,
      events({ type: "start", firstPresidentId: "c" }),
    );
    expect(s.phase).toBe("nominate");
    expect(s.presidentId).toBe("c");
  });
});

describe("verkiezingen", () => {
  it("roteert de president en past termijnlimieten toe", () => {
    const s = buildSecretHitlerState(
      seats7,
      events({ type: "start", firstPresidentId: "a" }, ...govt("b", "L")),
    );
    expect(s.presidentId).toBe("b");
    expect(s.liberalPolicies).toBe(1);
    expect(s.lastElectedPresidentId).toBe("a");
    expect(s.lastElectedChancellorId).toBe("b");
    expect(chancellorIneligibility(s, "a")).toBe("last_president");
    expect(chancellorIneligibility(s, "b")).toBe("president");
    expect(eligibleChancellors(s)).toEqual(["c", "d", "e", "f", "g"]);
  });

  it("negeert een voordracht van een niet-verkiesbare speler", () => {
    const s = buildSecretHitlerState(
      seats7,
      events({ type: "start", firstPresidentId: "a" }, ...govt("b", "L"), {
        type: "nominate",
        chancellorId: "a",
      }),
    );
    expect(s.phase).toBe("nominate");
    expect(s.ignoredEventIds).toEqual(["e4"]);
  });

  it("bij vijf levende spelers geldt alleen de vorige kanselier", () => {
    const s = buildSecretHitlerState(
      seats5,
      events({ type: "start", firstPresidentId: "a" }, ...govt("c", "L")),
    );
    expect(chancellorIneligibility(s, "a")).toBeNull();
    expect(chancellorIneligibility(s, "c")).toBe("last_chancellor");
  });

  it("drie mislukte verkiezingen geven chaos en wissen termijnlimieten", () => {
    const fail = (c: string): ShEventPayload[] => [
      { type: "nominate", chancellorId: c },
      { type: "vote", passed: false, votes: { a: "nein" } },
    ];
    const s = buildSecretHitlerState(
      seats7,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("b", "L"),
        ...fail("d"),
        ...fail("e"),
        ...fail("f"),
      ),
    );
    expect(s.phase).toBe("chaos");
    expect(s.electionTracker).toBe(3);
    const after = buildSecretHitlerState(
      seats7,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("b", "L"),
        ...fail("d"),
        ...fail("e"),
        ...fail("f"),
        { type: "chaos", policy: "F" },
      ),
    );
    expect(after.fascistPolicies).toBe(1);
    expect(after.electionTracker).toBe(0);
    expect(after.lastElectedPresidentId).toBeNull();
    expect(after.pendingPower).toBeNull();
    // b, c, d waren president bij de mislukte rondes; e is nu aan de beurt.
    expect(after.presidentId).toBe("e");
  });
});

describe("machten en einde", () => {
  it("speciale verkiezing springt en keert terug in de rotatie", () => {
    // 7 spelers: 2e F = onderzoek, 3e F = speciale verkiezing.
    const s = buildSecretHitlerState(
      seats7,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("c", "F"), // pres a
        ...govt("d", "F"), // pres b → investigate
        { type: "investigate", targetId: "g", claim: "liberal" },
        ...govt("e", "F"), // pres c → special election
        { type: "special_election", targetId: "f" },
      ),
    );
    expect(s.presidentId).toBe("f");
    expect(s.currentIsSpecial).toBe(true);
    expect(s.phase).toBe("nominate");
    // ≥3 F: na de verkiezing komt eerst de Hitler-check.
    const next = buildSecretHitlerState(
      seats7,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("c", "F"),
        ...govt("d", "F"),
        { type: "investigate", targetId: "g", claim: "liberal" },
        ...govt("e", "F"),
        { type: "special_election", targetId: "f" },
        { type: "nominate", chancellorId: "a" },
        { type: "vote", passed: true, votes: {} },
        { type: "hitler_check", isHitler: false },
        {
          type: "enact",
          policy: "L",
          presidentClaim: null,
          chancellorClaim: null,
        },
      ),
    );
    expect(next.confirmedNotHitler).toContain("a");
    expect(next.presidentId).toBe("d");
  });

  it("Hitler als kanselier na 3 F laat de fascisten winnen", () => {
    const s = buildSecretHitlerState(
      seats5,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("b", "F"),
        ...govt("c", "F"),
        ...govt("d", "F"), // pres c, 5p: 3e F = peek
        { type: "peek", claim: 2 },
        { type: "nominate", chancellorId: "e" },
        { type: "vote", passed: true, votes: ja(seats5) },
        { type: "hitler_check", isHitler: true },
      ),
    );
    expect(s.phase).toBe("game_over");
    expect(s.winner).toBe("fascist");
    expect(s.winReason).toBe("hitler_elected");
    expect(s.hitlerId).toBe("e");
  });

  it("executie van Hitler laat de liberalen winnen", () => {
    const s = buildSecretHitlerState(
      seats5,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("b", "F"),
        ...govt("c", "F"),
        ...govt("d", "F"),
        { type: "peek", claim: null },
        { type: "nominate", chancellorId: "a" },
        { type: "vote", passed: true, votes: {} },
        { type: "hitler_check", isHitler: false },
        {
          type: "enact",
          policy: "F",
          presidentClaim: null,
          chancellorClaim: null,
        },
        { type: "execute", targetId: "b", wasHitler: true },
      ),
    );
    expect(s.winner).toBe("liberal");
    expect(s.winReason).toBe("hitler_executed");
    expect(s.dead).toEqual(["b"]);
  });

  it("vijf liberale wetten winnen en de stapel wordt geschud", () => {
    const s = buildSecretHitlerState(
      seats7,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("c", "L"),
        ...govt("d", "L"),
        ...govt("e", "L"),
        ...govt("f", "L"),
        ...govt("g", "L"),
      ),
    );
    expect(s.winner).toBe("liberal");
    // 17 - 5×3 = 2 < 3 → geschud: 17 - 5 = 12.
    expect(s.reshuffles).toBe(1);
    expect(s.drawPile).toBe(12);
  });

  it("ongedane events tellen niet mee", () => {
    const evs = events(
      { type: "start", firstPresidentId: "a" },
      ...govt("b", "F"),
    );
    evs[3].undone_at = "2026-11-12T21:00:00.000Z";
    const s = buildSecretHitlerState(seats7, evs);
    expect(s.phase).toBe("legislate");
    expect(s.fascistPolicies).toBe(0);
  });
});

describe("claims", () => {
  it("vindt tegenspraak en onmogelijke claims", () => {
    expect(analyzeClaims("F", 3, 2)).toEqual([]);
    expect(analyzeClaims("F", 3, 1)).toEqual(["conflict"]);
    expect(analyzeClaims("L", 3, null)).toEqual(["president_impossible"]);
    expect(analyzeClaims("F", null, 0)).toEqual(["chancellor_impossible"]);
    expect(analyzeClaims("F", 2, 1)).toEqual(["chancellor_chose_fascist"]);
    expect(analyzeClaims("F", 2, 2)).toEqual(["president_discarded_liberal"]);
  });

  it("geeft ruwe trekkansen", () => {
    const s = buildSecretHitlerState(seats7, []);
    const odds = drawOdds(s);
    // C(11,3)/C(17,3) = 165/680
    expect(odds.threeFascist).toBeCloseTo(165 / 680, 5);
  });
});

describe("onthulling en awards", () => {
  const roles = {
    a: "liberal",
    b: "fascist",
    c: "liberal",
    d: "hitler",
    e: "liberal",
  } as const;

  it("controleert de rolverdeling", () => {
    expect(validateRoles(seats5, roles)).toBeNull();
    expect(validateRoles(seats5, { ...roles, c: "fascist" })).toMatch(
      /3 liberalen/,
    );
  });

  it("bepaalt winnaars en awards", () => {
    const s = buildSecretHitlerState(
      seats5,
      events(
        { type: "start", firstPresidentId: "a" },
        { type: "nominate", chancellorId: "b" },
        { type: "vote", passed: true, votes: ja(["a", "c", "e", "b"]) },
        {
          type: "enact",
          policy: "F",
          presidentClaim: 3,
          chancellorClaim: 1,
        },
        { type: "nominate", chancellorId: "d" },
        { type: "vote", passed: true, votes: ja(["a", "c", "e"]) },
        {
          type: "enact",
          policy: "F",
          presidentClaim: null,
          chancellorClaim: null,
        },
        { type: "declare_winner", winner: "fascist" },
        { type: "reveal", roles },
      ),
    );
    expect(winningPlayers(s)).toEqual(["b", "d"]);
    const nameOf = (id: string | null | undefined) => String(id).toUpperCase();
    const awards = buildAwards(s, nameOf, [
      { voterId: "a", suspectId: "d" },
      { voterId: "c", suspectId: "e" },
      { voterId: "b", suspectId: "e" },
    ]);
    const ids = awards.map((a) => a.id);
    expect(ids).toContain("sheep");
    expect(ids).toContain("hitler-friend");
    expect(ids).toContain("liar");
    expect(ids).toContain("sherlock");
    expect(ids).toContain("wrongly-accused");
    expect(awards.find((a) => a.id === "sherlock")?.playerIds).toEqual(["a"]);
    const story = buildStory(
      seats5,
      events(
        { type: "start", firstPresidentId: "a" },
        ...govt("b", "F", { presidentClaim: 3, chancellorClaim: 1 }),
      ),
      nameOf,
    );
    expect(story.at(-1)?.extra).toMatch(/liegt/);
  });
});

describe("zitvolgorde en statistieken", () => {
  it("gebruikt de ingestelde zitvolgorde voor de rotatie", () => {
    const s = buildSecretHitlerState(
      seats5,
      events(
        {
          type: "start",
          firstPresidentId: "a",
          seats: ["a", "c", "e", "b", "d"],
        },
        ...govt("b", "L"),
      ),
    );
    expect(s.seats).toEqual(["a", "c", "e", "b", "d"]);
    expect(s.presidentId).toBe("c");
  });

  it("negeert een ongeldige zitvolgorde", () => {
    const s = buildSecretHitlerState(
      seats5,
      events({
        type: "start",
        firstPresidentId: "a",
        seats: ["a", "a", "b", "c", "d"],
      }),
    );
    expect(s.seats).toEqual(seats5);
  });

  it("telt rollen en winst over potjes heen", () => {
    const roles = {
      a: "liberal",
      b: "fascist",
      c: "liberal",
      d: "hitler",
      e: "liberal",
    } as const;
    const game = events(
      { type: "start", firstPresidentId: "a" },
      { type: "declare_winner", winner: "liberal" },
      { type: "reveal", roles },
    );
    const unrevealed = events({ type: "start", firstPresidentId: "a" });
    const career = buildSecretHitlerCareer([
      { seats: seats5, events: game },
      { seats: seats5, events: unrevealed },
    ]);
    expect(career.games).toBe(1);
    expect(career.liberalWins).toBe(1);
    const d = career.players.find((p) => p.playerId === "d");
    expect(d).toMatchObject({ played: 1, hitler: 1, wins: 0 });
    const a = career.players.find((p) => p.playerId === "a");
    expect(a).toMatchObject({ liberal: 1, liberalWins: 1 });
  });
});
