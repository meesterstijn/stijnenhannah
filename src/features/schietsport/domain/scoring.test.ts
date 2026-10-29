import { describe, expect, it } from "vitest";
import {
  DISTANCES,
  MATCH_LAYOUT_PRESETS,
  PRACTICE_LAYOUT,
  isDistance,
  isValidMatchLayout,
  isValidShot,
  layoutKey,
  maxScoreFor,
  scaleFor,
  shotCountFor,
} from "@/features/schietsport/domain/rules";
import {
  createEmptyCards,
  scoreProgress,
  scoreSession,
  type CardInput,
} from "@/features/schietsport/domain/scoring";

const shots = (...values: number[]) => values;
const card = (
  cardNumber: number,
  shotCount: number,
  score: number | null,
  cardShots: number[] | null = null,
): CardInput => ({ cardNumber, shotCount, score, shots: cardShots });

describe("vaste regels", () => {
  it("een schot is een geheel getal van 0 tot en met 10", () => {
    for (let n = 0; n <= 10; n++) expect(isValidShot(n)).toBe(true);
    for (const bad of [-1, 11, 9.5, NaN, "9", null, undefined]) {
      expect(isValidShot(bad)).toBe(false);
    }
  });

  it("afstanden zijn uitsluitend 10, 12 en 25 meter", () => {
    expect(DISTANCES).toEqual([10, 12, 25]);
    expect(isDistance(10)).toBe(true);
    expect(isDistance(12)).toBe(true);
    expect(isDistance(25)).toBe(true);
    for (const bad of [0, 15, 50, "25", null]) {
      expect(isDistance(bad)).toBe(false);
    }
  });

  it("schoten en maxima per type", () => {
    expect(shotCountFor("match")).toBe(30);
    expect(maxScoreFor("match")).toBe(300);
    expect(shotCountFor("free_card")).toBe(5);
    expect(maxScoreFor("free_card")).toBe(50);
    expect(shotCountFor("practice_match")).toBe(30);
    expect(maxScoreFor("practice_match")).toBe(300);
    expect(scaleFor("match")).toBe(300);
    expect(scaleFor("practice_match")).toBe(300);
    expect(scaleFor("free_card")).toBe(50);
  });

  it("wedstrijdindelingen tellen altijd op tot 30 schoten", () => {
    for (const preset of MATCH_LAYOUT_PRESETS) {
      expect(isValidMatchLayout(preset.layout)).toBe(true);
    }
    expect(isValidMatchLayout([10, 10, 10])).toBe(true);
    expect(isValidMatchLayout([15, 15])).toBe(true);
    expect(isValidMatchLayout([10, 10])).toBe(false);
    expect(isValidMatchLayout([10, 10, 10, 1])).toBe(false);
    expect(isValidMatchLayout([31, -1])).toBe(false);
    expect(isValidMatchLayout([])).toBe(false);
    expect(layoutKey([5, 5, 5, 5, 5, 5])).toBe("6x5");
    expect(layoutKey([20, 10])).toBe("20+10");
  });
});

describe("officiële wedstrijd", () => {
  it("alleen totaalscore werkt zonder schotgegevens", () => {
    const result = scoreSession({ type: "match", totalScore: 290, cards: [] });
    expect(result).toEqual({
      ok: true,
      value: { type: "match", totalScore: 290, maxScore: 300, cards: [] },
    });
  });

  it("totaalscore buiten 0–300 of niet-geheel wordt geweigerd", () => {
    for (const total of [-1, 301, 289.5, null]) {
      expect(
        scoreSession({ type: "match", totalScore: total, cards: [] }).ok,
      ).toBe(false);
    }
    expect(scoreSession({ type: "match", totalScore: 300, cards: [] }).ok).toBe(
      true,
    );
    expect(scoreSession({ type: "match", totalScore: 0, cards: [] }).ok).toBe(
      true,
    );
  });

  it("één serie van 30 schoten berekent het juiste totaal", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => (i % 2 ? 10 : 9));
    const result = scoreSession({
      type: "match",
      totalScore: null,
      cards: [card(1, 30, null, thirty)],
    });
    expect(result.ok && result.value.totalScore).toBe(285);
    expect(result.ok && result.value.cards).toHaveLength(1);
  });

  it("wordt niet automatisch opgesplitst: indeling komt van de gebruiker", () => {
    // 3 × 10 (bv. 25 m karabijn staand) en 6 × 5 zijn allebei geldig.
    const threeByTen = scoreSession({
      type: "match",
      totalScore: null,
      cards: [card(1, 10, 95), card(2, 10, 97), card(3, 10, 92)],
    });
    expect(threeByTen.ok && threeByTen.value.totalScore).toBe(284);
    const sixByFive = scoreSession({
      type: "match",
      totalScore: null,
      cards: createEmptyCards([5, 5, 5, 5, 5, 5]).map((c) => ({
        ...c,
        score: 48,
      })),
    });
    expect(sixByFive.ok && sixByFive.value.totalScore).toBe(288);
  });

  it("kaarten die niet samen 30 schoten zijn worden geweigerd", () => {
    const result = scoreSession({
      type: "match",
      totalScore: null,
      cards: [card(1, 10, 95), card(2, 10, 97)],
    });
    expect(result.ok).toBe(false);
  });

  it("onvolledige schotinvoer wordt geweigerd", () => {
    const result = scoreSession({
      type: "match",
      totalScore: null,
      cards: [card(1, 30, null, shots(10, 9, 8))],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message).toContain("30 schoten");
  });

  it("kaartscore per kaart is maximaal schoten × 10", () => {
    const result = scoreSession({
      type: "match",
      totalScore: null,
      cards: [card(1, 10, 101), card(2, 10, 90), card(3, 10, 90)],
    });
    expect(result.ok).toBe(false);
  });
});

describe("vrije kaart", () => {
  it("bevat 5 schoten en heeft maximaal 50 punten", () => {
    const result = scoreSession({
      type: "free_card",
      totalScore: null,
      cards: [card(1, 5, null, shots(10, 10, 10, 10, 10))],
    });
    expect(result).toMatchObject({
      ok: true,
      value: { totalScore: 50, maxScore: 50 },
    });
  });

  it("alleen kaartscore werkt; boven 50 wordt geweigerd", () => {
    expect(
      scoreSession({
        type: "free_card",
        totalScore: null,
        cards: [card(1, 5, 47)],
      }),
    ).toMatchObject({ ok: true, value: { totalScore: 47 } });
    expect(
      scoreSession({
        type: "free_card",
        totalScore: null,
        cards: [card(1, 5, 51)],
      }).ok,
    ).toBe(false);
  });

  it("moet precies één kaart van 5 schoten zijn", () => {
    expect(
      scoreSession({ type: "free_card", totalScore: 47, cards: [] }).ok,
    ).toBe(false);
    expect(
      scoreSession({
        type: "free_card",
        totalScore: null,
        cards: [card(1, 10, 90)],
      }).ok,
    ).toBe(false);
    expect(
      scoreSession({
        type: "free_card",
        totalScore: null,
        cards: [card(1, 5, 40), card(2, 5, 40)],
      }).ok,
    ).toBe(false);
  });

  it("kaarttotaal moet overeenkomen met de ingevulde schoten", () => {
    const result = scoreSession({
      type: "free_card",
      totalScore: null,
      cards: [card(1, 5, 48, shots(10, 10, 10, 9, 8))],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0].message).toContain("komt niet overeen");
  });
});

describe("oefenwedstrijd", () => {
  const sixCards = (scores: number[]): CardInput[] =>
    createEmptyCards(PRACTICE_LAYOUT).map((c, i) => ({
      ...c,
      score: scores[i],
    }));

  it("heeft 6 kaarten van 5 schoten, 30 schoten en maximaal 300", () => {
    expect(PRACTICE_LAYOUT).toEqual([5, 5, 5, 5, 5, 5]);
    const result = scoreSession({
      type: "practice_match",
      totalScore: null,
      cards: sixCards([50, 50, 50, 50, 50, 50]),
    });
    expect(result).toMatchObject({
      ok: true,
      value: { totalScore: 300, maxScore: 300 },
    });
    if (result.ok) {
      expect(result.value.cards).toHaveLength(6);
      expect(result.value.cards.reduce((sum, c) => sum + c.shotCount, 0)).toBe(
        30,
      );
    }
  });

  it("kaarttotalen worden correct opgeteld (voorbeeld uit de opdracht)", () => {
    const result = scoreSession({
      type: "practice_match",
      totalScore: null,
      cards: sixCards([47, 49, 48, 50, 46, 49]),
    });
    expect(result.ok && result.value.totalScore).toBe(289);
  });

  it("kaartscore en losse schoten mogen per kaart verschillen", () => {
    const cards = sixCards([47, 49, 48, 50, 46, 49]);
    cards[2] = { ...cards[2], score: null, shots: [10, 10, 9, 10, 9] };
    const result = scoreSession({
      type: "practice_match",
      totalScore: null,
      cards,
    });
    expect(result.ok && result.value.totalScore).toBe(289);
  });

  it("een volledige oefenwedstrijd heeft zes ingevulde kaarten", () => {
    const cards = sixCards([47, 49, 48, 50, 46, 49]);
    cards[5] = { ...cards[5], score: null };
    const result = scoreSession({
      type: "practice_match",
      totalScore: null,
      cards,
    });
    expect(result.ok).toBe(false);
    expect(
      scoreSession({
        type: "practice_match",
        totalScore: null,
        cards: sixCards([47, 49, 48, 50, 46]).slice(0, 5),
      }).ok,
    ).toBe(false);
  });

  it("alleen totaalscore is niet toegestaan", () => {
    expect(
      scoreSession({ type: "practice_match", totalScore: 289, cards: [] }).ok,
    ).toBe(false);
  });

  it("voortgang telt ingevulde kaarten en lopend totaal", () => {
    const cards = sixCards([47, 49, 48, 50, 46, 49]);
    cards[4] = { ...cards[4], score: null };
    cards[5] = { ...cards[5], score: null };
    expect(
      scoreProgress({ type: "practice_match", totalScore: null, cards }),
    ).toEqual({
      cardsFilled: 4,
      cardsTotal: 6,
      runningTotal: 194,
      maxScore: 300,
      complete: false,
    });
  });
});
