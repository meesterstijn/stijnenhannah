import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  PRACTICE_LAYOUT,
  FREE_CARD_LAYOUT,
  type Distance,
  type MatchLayout,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import type { SessionScoreInput } from "@/features/schietsport/domain/scoring";
import { sortChronological } from "@/features/schietsport/domain/stats";

// Formulierstaat van "Nieuwe schietbeurt". Ruwe invoer (strings) zodat een
// half ingevuld veld kan bestaan; pas bij toScoreInput wordt het een getal.
// Volledig serialiseerbaar, zodat het als concept in IndexedDB kan.

export type CardMode = "score" | "shots";

export type CardForm = {
  shotCount: number;
  mode: CardMode;
  score: string;
  shots: number[];
};

export type SessionFormState = {
  type: SessionType;
  sessionDate: string;
  weaponId: string; // "" = onbekend / geleend zonder profiel
  disciplineId: string;
  distance: Distance | null;
  notes: string;
  matchMode: "total" | "cards"; // alleen voor een officiële wedstrijd
  totalScore: string;
  cards: CardForm[];
};

export function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d{1,3}$/.test(trimmed) ? Number(trimmed) : null;
}

export function cardsForLayout(
  layout: MatchLayout,
  mode: CardMode = "score",
): CardForm[] {
  return layout.map((shotCount) => ({ shotCount, mode, score: "", shots: [] }));
}

export function layoutOf(state: SessionFormState): MatchLayout {
  return state.cards.map((card) => card.shotCount);
}

export type FormDefaults = {
  weaponId: string;
  disciplineId: string;
  distance: Distance | null;
  matchLayout: MatchLayout; // [] = alleen totaal
  cardMode: CardMode;
};

function cardsFor(type: SessionType, defaults: FormDefaults): CardForm[] {
  if (type === "free_card")
    return cardsForLayout(FREE_CARD_LAYOUT, defaults.cardMode);
  if (type === "practice_match")
    return cardsForLayout(PRACTICE_LAYOUT, defaults.cardMode);
  return cardsForLayout(defaults.matchLayout, defaults.cardMode);
}

export function initialFormState(
  type: SessionType,
  sessionDate: string,
  defaults: FormDefaults,
): SessionFormState {
  return {
    type,
    sessionDate,
    weaponId: defaults.weaponId,
    disciplineId: defaults.disciplineId,
    distance: defaults.distance,
    notes: "",
    matchMode: defaults.matchLayout.length > 0 ? "cards" : "total",
    totalScore: "",
    cards: cardsFor(type, defaults),
  };
}

// Ander type kiezen: datum, wapen, discipline, afstand en notities blijven.
export function withType(
  state: SessionFormState,
  type: SessionType,
  defaults: FormDefaults,
): SessionFormState {
  if (state.type === type) return state;
  const next = initialFormState(type, state.sessionDate, {
    ...defaults,
    weaponId: state.weaponId,
    disciplineId: state.disciplineId,
    distance: state.distance,
  });
  return { ...next, notes: state.notes };
}

export function withMatchLayout(
  state: SessionFormState,
  layout: MatchLayout,
): SessionFormState {
  const mode = state.cards[0]?.mode ?? "score";
  return { ...state, matchMode: "cards", cards: cardsForLayout(layout, mode) };
}

export function toScoreInput(state: SessionFormState): SessionScoreInput {
  if (state.type === "match" && state.matchMode === "total") {
    return {
      type: "match",
      totalScore: parseScore(state.totalScore),
      cards: [],
    };
  }
  return {
    type: state.type,
    totalScore: null,
    cards: state.cards.map((card, index) => ({
      cardNumber: index + 1,
      shotCount: card.shotCount,
      score: card.mode === "score" ? parseScore(card.score) : null,
      shots: card.mode === "shots" ? card.shots : null,
    })),
  };
}

export function fromSession(session: ShootingSession): SessionFormState {
  return {
    type: session.type,
    sessionDate: session.sessionDate,
    weaponId: session.weaponId ?? "",
    disciplineId: session.disciplineId,
    distance: session.distance,
    notes: session.notes ?? "",
    matchMode: session.cards.length > 0 ? "cards" : "total",
    totalScore: session.cards.length === 0 ? String(session.totalScore) : "",
    cards: session.cards.map((card) => ({
      shotCount: card.shotCount,
      mode: card.shots ? "shots" : "score",
      score: card.shots ? "" : String(card.score),
      shots: card.shots ? [...card.shots] : [],
    })),
  };
}

// Standaardwaarden uit de geschiedenis: wapen, discipline en afstand van de
// laatste schietbeurt; kaartindeling en invoermodus van de laatste
// officiële wedstrijd in die discipline. Zo is de snelste route bij de
// vereniging: type kiezen, score, opslaan.
export function defaultsFromHistory(
  sessions: readonly ShootingSession[],
  fallback: { disciplineId: string },
  forDisciplineId?: string,
): FormDefaults {
  const sorted = sortChronological(sessions);
  const last = sorted[sorted.length - 1];
  const disciplineId =
    forDisciplineId ?? last?.disciplineId ?? fallback.disciplineId;
  const lastMatch = [...sorted]
    .reverse()
    .find((s) => s.type === "match" && s.disciplineId === disciplineId);
  const lastCards = lastMatch?.cards ?? [];
  return {
    weaponId: last?.weaponId ?? "",
    disciplineId,
    distance: last?.distance ?? null,
    matchLayout: lastCards.map((card) => card.shotCount),
    cardMode: (lastMatch ?? last)?.cards[0]?.shots ? "shots" : "score",
  };
}

// ── Doorlopende vrije kaarten ─────────────────────────────────────────
// Bij een nieuwe vrije kaart kun je meerdere kaarten achter elkaar
// invullen: er staat altijd precies één lege kaart onder de laatste
// ingevulde, en alle kaarten volgen de invoermodus van kaart 1. Elke
// ingevulde kaart wordt bij opslaan een eigen vrije kaart (schietbeurt).

export function isCardEmpty(card: CardForm): boolean {
  return card.mode === "score"
    ? card.score.trim() === ""
    : card.shots.length === 0;
}

function emptyFreeCard(mode: CardMode): CardForm {
  return { shotCount: FREE_CARD_LAYOUT[0], mode, score: "", shots: [] };
}

// Lege kaarten aan het eind weghalen en er precies één terugzetten.
export function normalizeFreeCards(cards: CardForm[]): CardForm[] {
  const mode = cards[0]?.mode ?? "score";
  const trimmed = [...cards];
  while (trimmed.length > 0 && isCardEmpty(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }
  return [...trimmed, emptyFreeCard(mode)];
}

// Modus van kaart 1 geldt voor alle kaarten. Volledig ingevulde schoten
// blijven bewaard als kaartscore; verder gaat de invoer van een kaart bij
// een moduswissel verloren (score en schoten zijn niet om te rekenen).
export function withFreeCardsMode(
  cards: CardForm[],
  mode: CardMode,
): CardForm[] {
  return normalizeFreeCards(
    cards.map((card) => {
      if (card.mode === mode) return card;
      const completeShots =
        card.mode === "shots" && card.shots.length === card.shotCount;
      return {
        ...card,
        mode,
        score:
          completeShots && mode === "score"
            ? String(card.shots.reduce((sum, shot) => sum + shot, 0))
            : "",
        shots: [],
      };
    }),
  );
}

// Eén score-invoer per niet-lege kaart, met het kaartnummer zoals getoond.
export function freeCardInputs(
  state: SessionFormState,
): { position: number; input: SessionScoreInput }[] {
  return state.cards
    .map((card, index) => ({ card, position: index + 1 }))
    .filter(({ card }) => !isCardEmpty(card))
    .map(({ card, position }) => ({
      position,
      input: {
        type: "free_card" as const,
        totalScore: null,
        cards: [
          {
            cardNumber: 1,
            shotCount: card.shotCount,
            score: card.mode === "score" ? parseScore(card.score) : null,
            shots: card.mode === "shots" ? card.shots : null,
          },
        ],
      },
    }));
}
