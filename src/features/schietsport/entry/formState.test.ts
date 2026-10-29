import { describe, expect, it } from "vitest";
import { scoreSession } from "@/features/schietsport/domain/scoring";
import { makeSession } from "@/features/schietsport/domain/test-fixtures";
import {
  defaultsFromHistory,
  fromSession,
  initialFormState,
  parseScore,
  toScoreInput,
  withMatchLayout,
  withType,
  type FormDefaults,
} from "@/features/schietsport/entry/formState";

const defaults: FormDefaults = {
  weaponId: "w1",
  disciplineId: "d1",
  distance: 25,
  matchLayout: [],
  cardMode: "score",
};

describe("formulierstaat", () => {
  it("parseScore accepteert alleen hele, niet-negatieve getallen", () => {
    expect(parseScore("287")).toBe(287);
    expect(parseScore(" 47 ")).toBe(47);
    for (const bad of ["", "-1", "4.5", "4,5", "abc", "1000"]) {
      expect(parseScore(bad)).toBeNull();
    }
  });

  it("officiële wedstrijd met alleen totaal maakt geen fictieve schoten", () => {
    const state = {
      ...initialFormState("match", "2026-10-29", defaults),
      totalScore: "290",
    };
    const input = toScoreInput(state);
    expect(input).toEqual({ type: "match", totalScore: 290, cards: [] });
    expect(scoreSession(input)).toMatchObject({
      ok: true,
      value: { totalScore: 290, cards: [] },
    });
  });

  it("vrije kaart en oefenwedstrijd krijgen de vaste kaartindeling", () => {
    expect(
      initialFormState("free_card", "2026-10-29", defaults).cards.map(
        (c) => c.shotCount,
      ),
    ).toEqual([5]);
    expect(
      initialFormState("practice_match", "2026-10-29", defaults).cards.map(
        (c) => c.shotCount,
      ),
    ).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it("wedstrijd per kaart: 3 × 10 met losse schoten op één kaart", () => {
    let state = withMatchLayout(
      initialFormState("match", "2026-10-29", defaults),
      [10, 10, 10],
    );
    state = {
      ...state,
      cards: [
        { ...state.cards[0], score: "95" },
        {
          ...state.cards[1],
          mode: "shots",
          shots: [10, 10, 10, 9, 10, 10, 9, 10, 10, 9],
        },
        { ...state.cards[2], score: "92" },
      ],
    };
    expect(scoreSession(toScoreInput(state))).toMatchObject({
      ok: true,
      value: { totalScore: 284 },
    });
  });

  it("ander type kiezen houdt datum, wapen, discipline, afstand en notities", () => {
    const state = {
      ...initialFormState("match", "2026-10-01", defaults),
      notes: "Wind",
      distance: 12 as const,
    };
    const next = withType(state, "practice_match", defaults);
    expect(next).toMatchObject({
      type: "practice_match",
      sessionDate: "2026-10-01",
      distance: 12,
      notes: "Wind",
    });
    expect(next.cards).toHaveLength(6);
  });

  it("een opgeslagen schietbeurt laat zich exact terug bewerken", () => {
    const session = makeSession({
      type: "practice_match",
      totalScore: 289,
      cards: [47, 49, 48, 50, 46, 49].map((score, i) => ({
        id: `c${i}`,
        cardNumber: i + 1,
        shotCount: 5,
        score,
        shots: i === 2 ? [10, 10, 9, 10, 9] : null,
      })),
    });
    const result = scoreSession(toScoreInput(fromSession(session)));
    expect(result.ok && result.value.totalScore).toBe(289);
    expect(result.ok && result.value.cards[2].shots).toEqual([
      10, 10, 9, 10, 9,
    ]);
  });
});

describe("standaardwaarden uit de geschiedenis", () => {
  it("laatste wapen/afstand en kaartindeling van de laatste wedstrijd in de discipline", () => {
    const history = [
      makeSession({
        sessionDate: "2026-10-01",
        weaponId: "w1",
        disciplineId: "karabijn",
        distance: 25,
        type: "match",
        cards: [95, 97, 92].map((score, i) => ({
          id: `${i}`,
          cardNumber: i + 1,
          shotCount: 10,
          score,
          shots: null,
        })),
        totalScore: 284,
      }),
      makeSession({
        sessionDate: "2026-10-10",
        weaponId: "w2",
        disciplineId: "karabijn",
        distance: 25,
        type: "free_card",
        cards: [
          { id: "x", cardNumber: 1, shotCount: 5, score: 48, shots: null },
        ],
        totalScore: 48,
      }),
    ];
    expect(defaultsFromHistory(history, { disciplineId: "fallback" })).toEqual({
      weaponId: "w2",
      disciplineId: "karabijn",
      distance: 25,
      matchLayout: [10, 10, 10],
      cardMode: "score",
    });
  });

  it("zonder geschiedenis: fallback-discipline, alleen totaal", () => {
    expect(defaultsFromHistory([], { disciplineId: "d" })).toEqual({
      weaponId: "",
      disciplineId: "d",
      distance: null,
      matchLayout: [],
      cardMode: "score",
    });
  });
});
