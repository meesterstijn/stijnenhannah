import {
  FREE_CARD_LAYOUT,
  PRACTICE_CARDS,
  PRACTICE_LAYOUT,
  SHOT_MAX,
  isValidMatchLayout,
  isValidShot,
  maxScoreFor,
  type MatchLayout,
  type SessionType,
} from "@/features/schietsport/domain/rules";

// Invoer en validatie van één schietbeurt (§4, §7).
//
// Een schietbeurt bestaat uit kaarten. Per kaart vul je óf de kaartscore in,
// óf alle losse schoten (dan wordt de score berekend). Alleen een officiële
// wedstrijd mag ook zonder kaarten: dan alleen de totaalscore, en blijven de
// schoten onbekend — er worden nooit fictieve schotwaarden gemaakt.
//   - match:          [] (alleen totaal) of een indeling met som 30 schoten
//   - free_card:      precies 1 kaart van 5 schoten
//   - practice_match: precies 6 kaarten van 5 schoten

export type CardInput = {
  cardNumber: number; // 1-based, aaneengesloten
  shotCount: number;
  score: number | null; // null = (nog) niet ingevuld
  shots: number[] | null; // null = geen schotinvoer voor deze kaart
};

export type SessionScoreInput = {
  type: SessionType;
  totalScore: number | null; // alleen gebruikt als `cards` leeg is (match)
  cards: CardInput[];
};

export type ScoredCard = {
  cardNumber: number;
  shotCount: number;
  score: number;
  shots: number[] | null;
};

export type ScoredSession = {
  type: SessionType;
  totalScore: number;
  maxScore: number;
  cards: ScoredCard[];
};

export type ScoreError = { path: string; message: string };

export type ScoreResult =
  | { ok: true; value: ScoredSession }
  | { ok: false; errors: ScoreError[] };

export function cardMaxScore(shotCount: number): number {
  return shotCount * SHOT_MAX;
}

export function sumShots(shots: readonly number[]): number {
  return shots.reduce((sum, shot) => sum + shot, 0);
}

export function isValidScore(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

export function defaultLayoutFor(type: SessionType): MatchLayout {
  if (type === "free_card") return FREE_CARD_LAYOUT;
  if (type === "practice_match") return PRACTICE_LAYOUT;
  return [];
}

export function createEmptyCards(layout: MatchLayout): CardInput[] {
  return layout.map((shotCount, index) => ({
    cardNumber: index + 1,
    shotCount,
    score: null,
    shots: null,
  }));
}

// Score van een kaart: uit de schoten als die volledig zijn ingevuld,
// anders de ingevoerde kaartscore. null = nog niet (geldig) ingevuld.
export function resolveCardScore(card: CardInput): number | null {
  if (card.shots !== null) {
    return card.shots.length === card.shotCount && card.shots.every(isValidShot)
      ? sumShots(card.shots)
      : null;
  }
  return isValidScore(card.score, cardMaxScore(card.shotCount))
    ? card.score
    : null;
}

function validateCard(card: CardInput, index: number): ScoreError[] {
  const path = `cards.${index}`;
  const label = `Kaart ${card.cardNumber}`;
  const errors: ScoreError[] = [];
  const max = cardMaxScore(card.shotCount);

  if (card.cardNumber !== index + 1) {
    errors.push({ path, message: `${label}: verkeerd kaartnummer.` });
  }
  if (card.shots !== null) {
    if (card.shots.length !== card.shotCount) {
      errors.push({
        path: `${path}.shots`,
        message: `${label}: vul alle ${card.shotCount} schoten in (nu ${card.shots.length}).`,
      });
    }
    card.shots.forEach((shot, shotIndex) => {
      if (!isValidShot(shot)) {
        errors.push({
          path: `${path}.shots.${shotIndex}`,
          message: `${label}, schot ${shotIndex + 1}: alleen hele punten van 0 tot en met 10.`,
        });
      }
    });
    if (
      card.score !== null &&
      card.shots.every(isValidShot) &&
      card.score !== sumShots(card.shots)
    ) {
      errors.push({
        path: `${path}.score`,
        message: `${label}: kaartscore ${card.score} komt niet overeen met de schoten (${sumShots(card.shots)}).`,
      });
    }
  } else if (card.score === null) {
    errors.push({
      path: `${path}.score`,
      message: `${label}: nog niet ingevuld.`,
    });
  } else if (!isValidScore(card.score, max)) {
    errors.push({
      path: `${path}.score`,
      message: `${label}: score moet een heel getal van 0 tot en met ${max} zijn.`,
    });
  }
  return errors;
}

function layoutErrors(type: SessionType, cards: CardInput[]): ScoreError[] {
  const layout = cards.map((card) => card.shotCount);
  if (type === "free_card") {
    return layout.length === 1 && layout[0] === FREE_CARD_LAYOUT[0]
      ? []
      : [
          {
            path: "cards",
            message: "Een vrije kaart is precies 1 kaart van 5 schoten.",
          },
        ];
  }
  if (type === "practice_match") {
    return layout.length === PRACTICE_CARDS &&
      layout.every((n) => n === PRACTICE_LAYOUT[0])
      ? []
      : [
          {
            path: "cards",
            message: "Een oefenwedstrijd bestaat uit 6 kaarten van 5 schoten.",
          },
        ];
  }
  return isValidMatchLayout(layout)
    ? []
    : [
        {
          path: "cards",
          message:
            "De kaarten van een wedstrijd moeten samen precies 30 schoten zijn.",
        },
      ];
}

// Valideert een volledig ingevulde schietbeurt en berekent de totalen.
// Een concept dat hier niet doorheen komt, mag niet als voltooid resultaat
// worden opgeslagen.
export function scoreSession(input: SessionScoreInput): ScoreResult {
  const maxScore = maxScoreFor(input.type);

  if (input.cards.length === 0) {
    if (input.type !== "match") {
      return {
        ok: false,
        errors: layoutErrors(input.type, input.cards),
      };
    }
    if (!isValidScore(input.totalScore, maxScore)) {
      return {
        ok: false,
        errors: [
          {
            path: "totalScore",
            message: `Totaalscore moet een heel getal van 0 tot en met ${maxScore} zijn.`,
          },
        ],
      };
    }
    return {
      ok: true,
      value: {
        type: input.type,
        totalScore: input.totalScore,
        maxScore,
        cards: [],
      },
    };
  }

  const errors = [
    ...layoutErrors(input.type, input.cards),
    ...input.cards.flatMap(validateCard),
  ];
  if (errors.length > 0) return { ok: false, errors };

  const cards: ScoredCard[] = input.cards.map((card) => ({
    cardNumber: card.cardNumber,
    shotCount: card.shotCount,
    score: resolveCardScore(card)!,
    shots: card.shots ? [...card.shots] : null,
  }));
  return {
    ok: true,
    value: {
      type: input.type,
      totalScore: cards.reduce((sum, card) => sum + card.score, 0),
      maxScore,
      cards,
    },
  };
}

// Live voortgang tijdens het invoeren ("4/6 kaarten · 236/300").
export function scoreProgress(input: SessionScoreInput) {
  const maxScore = maxScoreFor(input.type);
  if (input.cards.length === 0) {
    const total = isValidScore(input.totalScore, maxScore)
      ? input.totalScore
      : null;
    return {
      cardsFilled: 0,
      cardsTotal: 0,
      runningTotal: total ?? 0,
      maxScore,
      complete: total !== null,
    };
  }
  const scores = input.cards.map(resolveCardScore);
  const filled = scores.filter((score): score is number => score !== null);
  return {
    cardsFilled: filled.length,
    cardsTotal: input.cards.length,
    runningTotal: filled.reduce((sum, score) => sum + score, 0),
    maxScore,
    complete: scoreSession(input).ok,
  };
}
