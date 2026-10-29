import type {
  EntityName,
  LocalRecord,
} from "@/features/schietsport/db/database";

// Vertaling lokale records (camelCase) ↔ Supabase-rijen (snake_case).

type Row = Record<string, unknown>;
type FieldKind = "plain" | "timestamp";

// [lokaal veld, serverkolom, soort]
const FIELDS: Record<EntityName, [string, string, FieldKind][]> = {
  discipline: [
    ["name", "name", "plain"],
    ["description", "description", "plain"],
    ["archivedAt", "archived_at", "timestamp"],
  ],
  weapon: [
    ["name", "name", "plain"],
    ["brand", "brand", "plain"],
    ["model", "model", "plain"],
    ["weaponType", "weapon_type", "plain"],
    ["caliber", "caliber", "plain"],
    ["ownership", "ownership", "plain"],
    ["photoPath", "photo_path", "plain"],
    ["notes", "notes", "plain"],
    ["archivedAt", "archived_at", "timestamp"],
  ],
  session: [
    ["sessionDate", "session_date", "plain"],
    ["weaponId", "weapon_id", "plain"],
    ["disciplineId", "discipline_id", "plain"],
    ["distance", "distance", "plain"],
    ["type", "session_type", "plain"],
    ["totalScore", "total_score", "plain"],
    ["maxScore", "max_score", "plain"],
    ["notes", "notes", "plain"],
  ],
  competition: [
    ["name", "name", "plain"],
    ["startDate", "start_date", "plain"],
    ["endDate", "end_date", "plain"],
    ["disciplineId", "discipline_id", "plain"],
    ["notes", "notes", "plain"],
    ["archivedAt", "archived_at", "timestamp"],
    ["ruleType", "rule_type", "plain"],
    ["rules", "rules", "plain"],
  ],
  competition_entry: [
    ["competitionId", "competition_id", "plain"],
    ["sessionId", "session_id", "plain"],
  ],
};

// Supabase geeft "2026-10-29T12:00:00+00:00", lokaal staat
// "2026-10-29T12:00:00.000Z": altijd naar dezelfde ISO-vorm.
function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const time = Date.parse(String(value));
  return Number.isNaN(time) ? String(value) : new Date(time).toISOString();
}

export function toServerRow<E extends EntityName>(
  entity: E,
  record: LocalRecord<E>,
): Row {
  const source = record as unknown as Row;
  const row: Row = {
    id: source.id,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
    deleted_at: source.deletedAt,
  };
  for (const [local, server] of FIELDS[entity]) {
    row[server] = source[local] ?? null;
  }
  if (entity === "session") {
    row.cards = (source.cards as Row[]).map((card) => ({
      id: card.id,
      card_number: card.cardNumber,
      shot_count: card.shotCount,
      score: card.score,
      shots: card.shots ?? null,
    }));
  }
  return row;
}

export function fromServerRow<E extends EntityName>(
  entity: E,
  row: Row,
): LocalRecord<E> {
  const record: Row = {
    id: row.id,
    userId: row.user_id,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    deletedAt: normalizeTimestamp(row.deleted_at),
    version: row.version,
    syncState: "synced",
    syncError: null,
  };
  for (const [local, server, kind] of FIELDS[entity]) {
    const value = row[server] ?? null;
    record[local] = kind === "timestamp" ? normalizeTimestamp(value) : value;
  }
  if (entity === "session") {
    record.cards = ((row.cards as Row[] | undefined) ?? []).map((card) => ({
      id: card.id,
      cardNumber: card.card_number,
      shotCount: card.shot_count,
      score: card.score,
      shots: (card.shots as number[] | null) ?? null,
    }));
  }
  return record as unknown as LocalRecord<E>;
}

// Inhoud van een rij zonder metadata (ids, versies, tijdstempels van
// aanmaken/wijzigen), om te herkennen dat twee versies inhoudelijk gelijk
// zijn — bv. dezelfde wijziging die al was aangekomen.
export function contentKey(entity: EntityName, row: Row): string {
  const content: Row = { deleted_at: normalizeTimestamp(row.deleted_at) };
  for (const [, server, kind] of FIELDS[entity]) {
    const value = row[server] ?? null;
    content[server] = kind === "timestamp" ? normalizeTimestamp(value) : value;
  }
  if (entity === "session") {
    content.cards = ((row.cards as Row[] | undefined) ?? []).map((card) => [
      card.card_number,
      card.shot_count,
      card.score,
      card.shots ?? null,
    ]);
  }
  // max_score volgt uit het type en wordt door de server bepaald.
  delete content.max_score;
  return stableStringify(content);
}

// JSON met gesorteerde sleutels: PostgreSQL (jsonb) geeft objectsleutels in
// een eigen volgorde terug, dat mag geen verschil in inhoud lijken.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Row)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
