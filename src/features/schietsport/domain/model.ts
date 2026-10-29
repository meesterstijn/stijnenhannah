import type {
  Distance,
  SessionType,
} from "@/features/schietsport/domain/rules";

// Domeinentiteiten (§13). Dezelfde vorm in IndexedDB en, via een
// camelCase↔snake_case-mapping in de sync-laag, in Supabase. Alles hangt
// aan `userId`, zodat meerdere gebruikers (en later verenigingen) erbij
// kunnen komen zonder herbouw.

// Velden die elke gesynchroniseerde entiteit heeft.
export type SyncFields = {
  id: string; // UUID, op het apparaat aangemaakt
  userId: string;
  createdAt: string; // ISO-tijdstip
  updatedAt: string; // ISO-tijdstip, laatste lokale wijziging
  deletedAt: string | null; // verwijdermarkering (tombstone)
  version: number; // serverversie waarop deze staat voortbouwt; 0 = nooit gesynchroniseerd
};

export type Discipline = SyncFields & {
  name: string;
  description: string | null;
  archivedAt: string | null;
};

export const WEAPON_TYPES = [
  "pistool",
  "revolver",
  "karabijn",
  "geweer",
  "luchtpistool",
  "luchtgeweer",
  "anders",
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export type Weapon = SyncFields & {
  name: string; // zelfgekozen, bv. "Walther GSP (club)"
  brand: string | null;
  model: string | null;
  weaponType: WeaponType;
  caliber: string | null;
  ownership: "eigen" | "geleend";
  photoPath: string | null; // pad in de privé Storage-bucket
  notes: string | null;
  archivedAt: string | null;
  // Bewust GEEN serienummer, vergunning- of verlofgegevens.
};

export type SessionCard = {
  id: string;
  cardNumber: number;
  shotCount: number;
  score: number;
  shots: number[] | null; // null = alleen kaartscore ingevoerd
};

export type ShootingSession = SyncFields & {
  sessionDate: string; // YYYY-MM-DD
  weaponId: string | null; // null = onbekend wapen
  disciplineId: string;
  distance: Distance;
  type: SessionType;
  totalScore: number;
  maxScore: number;
  notes: string | null;
  // Leeg alleen bij een officiële wedstrijd met uitsluitend totaalscore.
  cards: SessionCard[];
};

export const COMPETITION_RULE_TYPES = ["periods", "best_of", "manual"] as const;
export type CompetitionRuleType = (typeof COMPETITION_RULE_TYPES)[number];

export type CompetitionRules = {
  // Welk type schietbeurt telt (één type: 50- en 300-scores nooit mengen).
  sessionType?: SessionType;
  distance?: Distance | null;
  // Puntenbord: periodes binnen het jaar.
  periods?: { start: string; end: string }[];
  // Afgelopen periodes worden vastgezet; daarna verandert hun score niet meer.
  frozen?: { period: number; sessionId: string | null; score: number | null }[];
  // Beste N.
  bestCount?: number;
};

export type CompetitionPeriod = SyncFields & {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  disciplineId: string | null;
  notes: string | null;
  archivedAt: string | null;
  // Ontbreekt bij competities van vóór de regels: dan "manual".
  ruleType?: CompetitionRuleType;
  rules?: CompetitionRules;
};

export type CompetitionEntry = SyncFields & {
  competitionId: string;
  sessionId: string; // altijd een officiële wedstrijd (`type === "match"`)
};

export function isActive(entity: Pick<SyncFields, "deletedAt">): boolean {
  return entity.deletedAt === null;
}
