import Dexie, { type Table } from "dexie";
import type {
  CompetitionEntry,
  CompetitionPeriod,
  Discipline,
  ShootingSession,
  Weapon,
} from "@/features/schietsport/domain/model";

// Lokale database (IndexedDB via Dexie). Eén database per gebruiker, zodat
// accounts op een gedeeld apparaat nooit door elkaar lopen. Alles wordt
// eerst hier opgeslagen; de sync-laag brengt het naar Supabase.

export const ENTITIES = [
  "discipline",
  "weapon",
  "session",
  "competition",
  "competition_entry",
] as const;
export type EntityName = (typeof ENTITIES)[number];

export type EntityMap = {
  discipline: Discipline;
  weapon: Weapon;
  session: ShootingSession;
  competition: CompetitionPeriod;
  competition_entry: CompetitionEntry;
};

// pending  = lokale wijziging nog niet door Supabase bevestigd
// synced   = gelijk aan de laatst bekende serverversie
// rejected = Supabase weigerde de wijziging (bv. ongeldig); blijft lokaal
//            staan met de reden, tot de gebruiker het aanpast
export type SyncState = "pending" | "synced" | "rejected";

export type LocalMeta = {
  syncState: SyncState;
  syncError?: string | null;
  // Alleen lokaal: standaarddiscipline die sinds het seeden niet is
  // aangepast. Bij een conflict wint dan stil de server.
  seeded?: boolean;
};

export type LocalRecord<E extends EntityName> = EntityMap[E] & LocalMeta;

// Eén openstaande wijziging per record. Bij een nieuwe lokale wijziging
// krijgt de entry een nieuw changeId; de vorige pogingen blijven bekend om
// een eigen, al verwerkte poging te herkennen (zie sync/engine.ts).
export type OutboxEntry = {
  recordId: string;
  entity: EntityName;
  changeId: string;
  seq: number; // volgorde van wijzigen; push gaat in deze volgorde
  attempts: number;
  lastAttemptPayload: Record<string, unknown> | null;
  lastError: string | null;
};

export type ConflictRecord = {
  id: string; // = recordId
  entity: EntityName;
  local: Record<string, unknown>; // de lokale versie die niet doorkwam
  server: Record<string, unknown>; // de serverversie op dat moment
  detectedAt: string;
};

export type DraftRecord = {
  id: string;
  updatedAt: string;
  data: unknown; // formulierstaat van "Nieuwe schietbeurt"
};

export type PhotoRecord = {
  weaponId: string;
  blob: Blob;
  uploaded: boolean;
};

export type MetaRecord = { key: string; value: unknown };

export class SchietsportDatabase extends Dexie {
  disciplines!: Table<LocalRecord<"discipline">, string>;
  weapons!: Table<LocalRecord<"weapon">, string>;
  sessions!: Table<LocalRecord<"session">, string>;
  competitions!: Table<LocalRecord<"competition">, string>;
  competitionEntries!: Table<LocalRecord<"competition_entry">, string>;
  outbox!: Table<OutboxEntry, string>;
  conflicts!: Table<ConflictRecord, string>;
  drafts!: Table<DraftRecord, string>;
  photos!: Table<PhotoRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    // Schemawijzigingen: altijd een nieuwe this.version(n) toevoegen met een
    // upgrade-functie; nooit een bestaande versie aanpassen.
    this.version(1).stores({
      disciplines: "id, syncState",
      weapons: "id, syncState",
      sessions: "id, sessionDate, weaponId, disciplineId, type, syncState",
      competitions: "id, syncState",
      competitionEntries: "id, competitionId, sessionId, syncState",
      outbox: "recordId, seq",
      conflicts: "id",
      drafts: "id, updatedAt",
      photos: "weaponId, uploaded",
      meta: "key",
    });
  }

  entityTable<E extends EntityName>(entity: E): Table<LocalRecord<E>, string> {
    const tables = {
      discipline: this.disciplines,
      weapon: this.weapons,
      session: this.sessions,
      competition: this.competitions,
      competition_entry: this.competitionEntries,
    } as const;
    return tables[entity] as unknown as Table<LocalRecord<E>, string>;
  }

  get entityTables() {
    return [
      this.disciplines,
      this.weapons,
      this.sessions,
      this.competitions,
      this.competitionEntries,
    ];
  }
}

export function databaseNameFor(userId: string): string {
  return `schietsport-${userId}`;
}

export async function getMeta<T>(
  db: SchietsportDatabase,
  key: string,
): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(
  db: SchietsportDatabase,
  key: string,
  value: unknown,
) {
  await db.meta.put({ key, value });
}
