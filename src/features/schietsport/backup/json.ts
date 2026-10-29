import { z } from "zod";
import {
  ENTITIES,
  type EntityName,
  type LocalRecord,
  type SchietsportDatabase,
} from "@/features/schietsport/db/database";
import { writeRecord } from "@/features/schietsport/db/repository";
import {
  COMPETITION_RULE_TYPES,
  WEAPON_TYPES,
} from "@/features/schietsport/domain/model";
import { scoreSession } from "@/features/schietsport/domain/scoring";
import { DISTANCES, SESSION_TYPES } from "@/features/schietsport/domain/rules";

// Volledige JSON-back-up, onafhankelijk van Supabase. Bevat alle actieve
// records (zonder lokale sync-metadata en zonder foto's). Importeren voegt
// samen op id: een record wordt alleen overschreven als de back-up nieuwer
// is, en gaat daarna gewoon via de wachtrij naar Supabase.

export const BACKUP_FORMAT = "stijnenhannah-schietsport-backup";
export const BACKUP_SCHEMA_VERSION = 1;

const TABLE_KEYS: Record<EntityName, string> = {
  discipline: "disciplines",
  weapon: "weapons",
  session: "sessions",
  competition: "competitions",
  competition_entry: "competitionEntries",
};

const LOCAL_ONLY = ["syncState", "syncError", "seeded"] as const;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
};

export async function createBackup(db: SchietsportDatabase): Promise<Backup> {
  const data: Record<string, unknown[]> = {};
  for (const entity of ENTITIES) {
    const records = await db.entityTable(entity).toArray();
    data[TABLE_KEYS[entity]] = records
      .filter((record) => record.deletedAt === null)
      .map((record) => {
        const copy: Record<string, unknown> = { ...record };
        for (const key of LOCAL_ONLY) delete copy[key];
        return copy;
      });
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// ── Validatie ────────────────────────────────────────────────────────

const id = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.string().datetime({ offset: true });
const text = (max: number) => z.string().max(max);
const sync = {
  id,
  userId: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: iso.nullable(),
  version: z.number().int().min(0).optional(),
};

const schemas: Record<EntityName, z.ZodTypeAny> = {
  discipline: z.object({
    ...sync,
    name: text(80).min(1),
    description: text(500).nullable(),
    archivedAt: iso.nullable(),
  }),
  weapon: z.object({
    ...sync,
    name: text(80).min(1),
    brand: text(80).nullable(),
    model: text(80).nullable(),
    weaponType: z.enum(WEAPON_TYPES),
    caliber: text(40).nullable(),
    ownership: z.enum(["eigen", "geleend"]),
    photoPath: text(300).nullable(),
    notes: text(2000).nullable(),
    archivedAt: iso.nullable(),
  }),
  session: z
    .object({
      ...sync,
      sessionDate: ymd,
      weaponId: id.nullable(),
      disciplineId: id,
      distance: z
        .number()
        .refine((d) => (DISTANCES as readonly number[]).includes(d)),
      type: z.enum(SESSION_TYPES),
      totalScore: z.number().int(),
      maxScore: z.number().int(),
      notes: text(2000).nullable(),
      cards: z.array(
        z.object({
          id,
          cardNumber: z.number().int(),
          shotCount: z.number().int(),
          score: z.number().int(),
          shots: z.array(z.number().int()).nullable(),
        }),
      ),
    })
    // De schietsportregels gelden ook voor geïmporteerde gegevens.
    .refine((s) => {
      const result = scoreSession({
        type: s.type,
        totalScore: s.cards.length === 0 ? s.totalScore : null,
        cards: s.cards,
      });
      return result.ok && result.value.totalScore === s.totalScore;
    }, "Schietbeurt voldoet niet aan de schietsportregels"),
  competition: z.object({
    ...sync,
    name: text(120).min(1),
    startDate: ymd,
    endDate: ymd,
    disciplineId: id.nullable(),
    notes: text(2000).nullable(),
    archivedAt: iso.nullable(),
    ruleType: z.enum(COMPETITION_RULE_TYPES).optional(),
    rules: z.record(z.unknown()).optional(),
  }),
  competition_entry: z.object({
    ...sync,
    competitionId: id,
    sessionId: id,
  }),
};

export type ImportReport = {
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
};

export function parseBackup(json: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Dit bestand is geen geldige JSON.");
  }
  const header = z
    .object({
      format: z.literal(BACKUP_FORMAT),
      schemaVersion: z.number().int(),
      exportedAt: z.string(),
      data: z.record(z.array(z.unknown())),
    })
    .safeParse(parsed);
  if (!header.success) {
    throw new Error("Dit is geen Schietsport-back-up.");
  }
  if (header.data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      "Deze back-up komt uit een nieuwere versie van de app. Werk de app eerst bij.",
    );
  }
  // Oudere schemaversies zouden hier gemigreerd worden (nog geen).
  return header.data as Backup;
}

export async function importBackup(
  db: SchietsportDatabase,
  userId: string,
  backup: Backup,
): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: 0, invalid: 0 };
  // Volgorde: eerst waar anderen naar verwijzen.
  for (const entity of ENTITIES) {
    const records = backup.data[TABLE_KEYS[entity]] ?? [];
    for (const raw of records) {
      const parsed = schemas[entity].safeParse(raw);
      if (!parsed.success) {
        report.invalid++;
        continue;
      }
      const record = parsed.data as LocalRecord<typeof entity>;
      const existing = await db.entityTable(entity).get(record.id);
      if (existing && existing.updatedAt >= record.updatedAt) {
        report.skipped++;
        continue;
      }
      await writeRecord(
        db,
        entity,
        {
          ...record,
          userId,
          version: existing?.version ?? 0,
          syncState: "pending",
        } as LocalRecord<typeof entity>,
        { silent: true },
      );
      if (existing) report.updated++;
      else report.added++;
    }
  }
  return report;
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
