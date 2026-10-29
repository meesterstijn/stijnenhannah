import Dexie, { type Table } from "dexie";
import type {
  BodyMetric,
  CustomExerciseRecord,
  Profile,
  Program,
  TrainingSession,
  TrainingSet,
} from "@/features/training/domain/types";

// Lokale database (IndexedDB via Dexie), één per gebruiker: accounts op
// hetzelfde apparaat zien elkaars (tijdelijke) trainingsdata nooit. Alles
// wordt eerst hier opgeslagen; de sync brengt het naar Supabase. Zo gaat een
// training nooit verloren door slecht bereik in de sportruimte.

export const ENTITIES = ["profile", "exercise", "program", "session", "set", "body_metric"] as const;
export type EntityName = (typeof ENTITIES)[number];

export type EntityMap = {
  profile: Profile;
  exercise: CustomExerciseRecord;
  program: Program;
  session: TrainingSession;
  set: TrainingSet;
  body_metric: BodyMetric;
};

// pending  = lokale wijziging, nog niet door Supabase bevestigd
// synced   = gelijk aan de laatst bekende serverversie
// rejected = Supabase weigerde de wijziging; blijft lokaal met de reden
export type SyncState = "pending" | "synced" | "rejected";

export type LocalMeta = {
  syncState: SyncState;
  syncError?: string | null;
  // Automatisch aangemaakt (standaardprofiel): bij een conflict wint stil
  // de server, want er is niets door de gebruiker ingevoerd.
  seeded?: boolean;
};

export type LocalRecord<E extends EntityName> = EntityMap[E] & LocalMeta;

export type OutboxEntry = {
  recordId: string;
  entity: EntityName;
  changeId: string; // nieuw bij elke lokale wijziging (idempotente push)
  seq: number; // volgorde van eerste wijziging; push in deze volgorde
  attempts: number;
  lastError: string | null;
};

export type ConflictRecord = {
  id: string; // = recordId
  entity: EntityName;
  local: Record<string, unknown>; // eigen versie die niet doorkwam
  server: Record<string, unknown>; // serverversie op dat moment
  detectedAt: string;
};

export type MetaRecord = { key: string; value: unknown };

export class TrainingDatabase extends Dexie {
  profiles!: Table<LocalRecord<"profile">, string>;
  exercises!: Table<LocalRecord<"exercise">, string>;
  programs!: Table<LocalRecord<"program">, string>;
  sessions!: Table<LocalRecord<"session">, string>;
  sets!: Table<LocalRecord<"set">, string>;
  bodyMetrics!: Table<LocalRecord<"body_metric">, string>;
  outbox!: Table<OutboxEntry, string>;
  conflicts!: Table<ConflictRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    // Schemawijzigingen: altijd een nieuwe this.version(n) met upgrade,
    // nooit een bestaande versie aanpassen.
    this.version(1).stores({
      profiles: "id",
      exercises: "id",
      programs: "id",
      sessions: "id, status, localDate, startedAt",
      sets: "id, sessionId, exerciseId, [sessionId+slot+kind+setIndex]",
      bodyMetrics: "id, measuredOn",
      outbox: "recordId, seq",
      conflicts: "id",
      meta: "key",
    });
  }

  entityTable<E extends EntityName>(entity: E): Table<LocalRecord<E>, string> {
    const tables = {
      profile: this.profiles,
      exercise: this.exercises,
      program: this.programs,
      session: this.sessions,
      set: this.sets,
      body_metric: this.bodyMetrics,
    } as const;
    return tables[entity] as unknown as Table<LocalRecord<E>, string>;
  }

  get entityTables() {
    return [this.profiles, this.exercises, this.programs, this.sessions, this.sets, this.bodyMetrics];
  }
}

export const databaseNameFor = (userId: string) => `training-${userId}`;

export async function getMeta<T>(db: TrainingDatabase, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(db: TrainingDatabase, key: string, value: unknown) {
  await db.meta.put({ key, value });
}
