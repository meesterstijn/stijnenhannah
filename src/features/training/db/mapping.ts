import type { EntityName, LocalRecord } from "./database";

// Vertaling tussen lokale records (camelCase) en Supabase-rijen
// (snake_case). Expliciete veldlijsten: alleen deze kolommen gaan heen en
// weer, sync-metadata (syncState) blijft lokaal.

type Row = Record<string, unknown>;

const COMMON = ["id", "userId", "createdAt", "updatedAt", "deletedAt", "version"];

const FIELDS: Record<EntityName, string[]> = {
  profile: [...COMMON, "settings", "equipment", "exercisePrefs"],
  exercise: [...COMMON, "name", "data", "archivedAt"],
  program: [...COMMON, "name", "content", "revision", "source", "archivedAt"],
  session: [
    ...COMMON,
    "programId",
    "programRevision",
    "dayId",
    "name",
    "status",
    "startedAt",
    "endedAt",
    "localDate",
    "timeZone",
    "notes",
    "snapshot",
  ],
  set: [
    ...COMMON,
    "sessionId",
    "exerciseId",
    "slot",
    "kind",
    "setIndex",
    "weightKg",
    "reps",
    "durationSec",
    "jumps",
    "rpe",
    "rir",
    "notes",
    "completedAt",
  ],
  body_metric: [...COMMON, "measuredOn", "weightKg", "measurements", "notes"],
};

export const TABLES: Record<EntityName, string> = {
  profile: "training_profiles",
  exercise: "training_exercises",
  program: "training_programs",
  session: "training_sessions",
  set: "training_sets",
  body_metric: "training_body_metrics",
};

const RENAMES: Record<string, string> = { durationSec: "duration_s" };
const TIMESTAMPS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "archivedAt",
  "startedAt",
  "endedAt",
  "completedAt",
]);
const NUMERIC = new Set(["weightKg", "rpe"]);

const snake = (key: string) => RENAMES[key] ?? key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Push: de client stelt "basisversie + 1" voor; de server controleert dat
// (zie training_touch in de migratie).
export function toServerRow<E extends EntityName>(entity: E, record: LocalRecord<E>, changeId: string): Row {
  const row: Row = {};
  const source = record as unknown as Row;
  for (const field of FIELDS[entity]) {
    row[snake(field)] = source[field] ?? null;
  }
  row.version = (record.version ?? 0) + 1;
  row.last_change_id = changeId;
  return row;
}

// Server → lokaal. Tijdstempels worden ISO met "Z" (sorteerbaar als tekst),
// numeric-velden altijd number.
export function fromServerRow<E extends EntityName>(entity: E, row: Row): LocalRecord<E> {
  const record: Row = {};
  for (const field of FIELDS[entity]) {
    let value = row[snake(field)];
    if (value === undefined) value = null;
    if (value !== null && TIMESTAMPS.has(field)) value = new Date(value as string).toISOString();
    if (value !== null && NUMERIC.has(field)) value = Number(value);
    record[field] = value;
  }
  record.syncState = "synced";
  record.syncError = null;
  return record as LocalRecord<E>;
}
