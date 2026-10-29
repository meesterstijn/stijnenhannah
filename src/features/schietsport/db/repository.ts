import type {
  CompetitionPeriod,
  Discipline,
  SessionCard,
  ShootingSession,
  Weapon,
} from "@/features/schietsport/domain/model";
import type { ScoredSession } from "@/features/schietsport/domain/scoring";
import type { Distance } from "@/features/schietsport/domain/rules";
import {
  type EntityName,
  type LocalRecord,
  type SchietsportDatabase,
} from "@/features/schietsport/db/database";
import { fromServerRow } from "@/features/schietsport/db/mapping";
import { newId } from "@/features/schietsport/lib/ids";

// Alle schrijfacties van de module. Elke wijziging wordt in één
// IndexedDB-transactie opgeslagen samen met een wachtrij-entry, zodat een
// wijziging nooit kwijt kan raken tussen "opgeslagen" en "te synchroniseren".

const changeListeners = new Set<() => void>();

// De sync-planner luistert hierop om kort na een wijziging te synchroniseren.
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange() {
  for (const listener of changeListeners) listener();
}

const now = () => new Date().toISOString();

async function enqueue(
  db: SchietsportDatabase,
  entity: EntityName,
  recordId: string,
) {
  const existing = await db.outbox.get(recordId);
  if (existing) {
    // Nieuwe wijziging op een record dat nog in de wachtrij staat: nieuw
    // changeId, zodat deze inhoud nooit verward wordt met een eerdere poging.
    await db.outbox.update(recordId, { changeId: newId(), lastError: null });
    return;
  }
  const last = await db.outbox.orderBy("seq").last();
  await db.outbox.add({
    recordId,
    entity,
    changeId: newId(),
    seq: (last?.seq ?? 0) + 1,
    attempts: 0,
    lastAttemptPayload: null,
    lastError: null,
  });
}

// Basis: record lokaal opslaan als "pending" en in de wachtrij zetten.
export async function writeRecord<E extends EntityName>(
  db: SchietsportDatabase,
  entity: E,
  record: LocalRecord<E>,
  options: { seeded?: boolean; silent?: boolean } = {},
) {
  const table = db.entityTable(entity);
  await db.transaction("rw", table, db.outbox, async () => {
    await table.put({
      ...record,
      syncState: "pending",
      syncError: null,
      seeded: options.seeded ? true : undefined,
    });
    await enqueue(db, entity, record.id);
  });
  if (!options.silent) notifyChange();
}

function baseFields(userId: string) {
  const timestamp = now();
  return {
    id: newId(),
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    version: 0,
  };
}

async function updateRecord<E extends EntityName>(
  db: SchietsportDatabase,
  entity: E,
  id: string,
  patch: Partial<LocalRecord<E>>,
) {
  const current = await db.entityTable(entity).get(id);
  if (!current) throw new Error("Record niet gevonden");
  await writeRecord(db, entity, {
    ...current,
    ...patch,
    updatedAt: now(),
  } as LocalRecord<E>);
}

export const softDelete = (
  db: SchietsportDatabase,
  entity: EntityName,
  id: string,
) => updateRecord(db, entity, id, { deletedAt: now() });

// ── Disciplines ──────────────────────────────────────────────────────

export type DisciplineInput = Pick<Discipline, "name" | "description">;

export async function createDiscipline(
  db: SchietsportDatabase,
  userId: string,
  input: DisciplineInput,
) {
  const record = {
    ...baseFields(userId),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    archivedAt: null,
  } as LocalRecord<"discipline">;
  await writeRecord(db, "discipline", record);
  return record;
}

export const updateDiscipline = (
  db: SchietsportDatabase,
  id: string,
  patch: Partial<Discipline>,
) => updateRecord(db, "discipline", id, patch);

// ── Wapens ───────────────────────────────────────────────────────────

export type WeaponInput = Pick<
  Weapon,
  "name" | "brand" | "model" | "weaponType" | "caliber" | "ownership" | "notes"
>;

const clean = (value: string | null | undefined) => value?.trim() || null;

export async function createWeapon(
  db: SchietsportDatabase,
  userId: string,
  input: WeaponInput,
) {
  const record = {
    ...baseFields(userId),
    name: input.name.trim(),
    brand: clean(input.brand),
    model: clean(input.model),
    weaponType: input.weaponType,
    caliber: clean(input.caliber),
    ownership: input.ownership,
    notes: clean(input.notes),
    photoPath: null,
    archivedAt: null,
  } as LocalRecord<"weapon">;
  await writeRecord(db, "weapon", record);
  return record;
}

export function updateWeapon(
  db: SchietsportDatabase,
  id: string,
  patch: Partial<Weapon>,
) {
  const cleaned: Partial<Weapon> = { ...patch };
  for (const key of ["brand", "model", "caliber", "notes"] as const) {
    if (key in cleaned) cleaned[key] = clean(cleaned[key]);
  }
  if (cleaned.name !== undefined) cleaned.name = cleaned.name.trim();
  return updateRecord(db, "weapon", id, cleaned);
}

// Foto lokaal bewaren; de sync uploadt 'm en zet daarna photoPath.
export async function setWeaponPhoto(
  db: SchietsportDatabase,
  weaponId: string,
  blob: Blob,
) {
  await db.photos.put({ weaponId, blob, uploaded: false });
  notifyChange();
}

export async function removeWeaponPhoto(
  db: SchietsportDatabase,
  weaponId: string,
) {
  await db.photos.delete(weaponId);
  await updateWeapon(db, weaponId, { photoPath: null });
}

// ── Schietbeurten ────────────────────────────────────────────────────

export type SessionInput = {
  id?: string; // bestaand id = bewerken
  sessionDate: string;
  weaponId: string | null;
  disciplineId: string;
  distance: Distance;
  notes: string | null;
  score: ScoredSession; // resultaat van scoreSession(), dus al gevalideerd
};

export async function saveSession(
  db: SchietsportDatabase,
  userId: string,
  input: SessionInput,
): Promise<ShootingSession> {
  const existing = input.id ? await db.sessions.get(input.id) : undefined;
  const timestamp = now();
  const cards: SessionCard[] = input.score.cards.map((card) => ({
    id: newId(),
    cardNumber: card.cardNumber,
    shotCount: card.shotCount,
    score: card.score,
    shots: card.shots,
  }));
  const record = {
    ...(existing ?? baseFields(userId)),
    updatedAt: timestamp,
    sessionDate: input.sessionDate,
    weaponId: input.weaponId,
    disciplineId: input.disciplineId,
    distance: input.distance,
    type: input.score.type,
    totalScore: input.score.totalScore,
    maxScore: input.score.maxScore,
    notes: clean(input.notes),
    cards,
  } as LocalRecord<"session">;
  await writeRecord(db, "session", record);

  // Een competitiekoppeling hoort alleen bij een officiële wedstrijd; de
  // server laat 'm bij een typewijziging ook vervallen.
  if (existing && existing.type === "match" && record.type !== "match") {
    const entries = await db.competitionEntries
      .where("sessionId")
      .equals(record.id)
      .toArray();
    for (const entry of entries.filter((e) => e.deletedAt === null)) {
      await softDelete(db, "competition_entry", entry.id);
    }
  }
  return record;
}

export async function deleteSession(db: SchietsportDatabase, id: string) {
  const entries = await db.competitionEntries
    .where("sessionId")
    .equals(id)
    .toArray();
  for (const entry of entries.filter((e) => e.deletedAt === null)) {
    await softDelete(db, "competition_entry", entry.id);
  }
  await softDelete(db, "session", id);
}

// ── Competities ──────────────────────────────────────────────────────

export type CompetitionInput = Pick<
  CompetitionPeriod,
  | "name"
  | "startDate"
  | "endDate"
  | "disciplineId"
  | "notes"
  | "ruleType"
  | "rules"
>;

export async function createCompetition(
  db: SchietsportDatabase,
  userId: string,
  input: CompetitionInput,
) {
  const record = {
    ...baseFields(userId),
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    disciplineId: input.disciplineId,
    notes: clean(input.notes),
    ruleType: input.ruleType ?? "manual",
    rules: input.rules ?? {},
    archivedAt: null,
  } as LocalRecord<"competition">;
  await writeRecord(db, "competition", record);
  return record;
}

export const updateCompetition = (
  db: SchietsportDatabase,
  id: string,
  patch: Partial<CompetitionPeriod>,
) => updateRecord(db, "competition", id, patch);

export async function linkSessionToCompetition(
  db: SchietsportDatabase,
  userId: string,
  competitionId: string,
  sessionId: string,
) {
  const session = await db.sessions.get(sessionId);
  if (!session || session.type !== "match" || session.deletedAt) {
    throw new Error(
      "Alleen officiële wedstrijden tellen mee voor een competitie.",
    );
  }
  const existing = (
    await db.competitionEntries.where("sessionId").equals(sessionId).toArray()
  ).find((e) => e.competitionId === competitionId && e.deletedAt === null);
  if (existing) return existing;
  const record = {
    ...baseFields(userId),
    competitionId,
    sessionId,
  } as LocalRecord<"competition_entry">;
  await writeRecord(db, "competition_entry", record);
  return record;
}

export async function unlinkSessionFromCompetition(
  db: SchietsportDatabase,
  competitionId: string,
  sessionId: string,
) {
  const entries = await db.competitionEntries
    .where("sessionId")
    .equals(sessionId)
    .toArray();
  for (const entry of entries) {
    if (entry.competitionId === competitionId && entry.deletedAt === null) {
      await softDelete(db, "competition_entry", entry.id);
    }
  }
}

// ── Conflicten ───────────────────────────────────────────────────────

// "server": serverversie houden (staat al lokaal), conflict opruimen.
// "local": de eigen versie opnieuw opslaan bovenop de huidige serverversie.
export async function resolveConflict(
  db: SchietsportDatabase,
  id: string,
  keep: "server" | "local",
) {
  const conflict = await db.conflicts.get(id);
  if (!conflict) return;
  if (keep === "local") {
    const current = await db.entityTable(conflict.entity).get(id);
    const local = fromServerRow(conflict.entity, conflict.local);
    await writeRecord(db, conflict.entity, {
      ...local,
      userId: current?.userId ?? local.userId,
      version: current?.version ?? local.version,
      updatedAt: now(),
    });
  }
  await db.conflicts.delete(id);
}

// ── Concepten (alleen lokaal) ────────────────────────────────────────

export async function saveDraft(
  db: SchietsportDatabase,
  id: string,
  data: unknown,
) {
  await db.drafts.put({ id, data, updatedAt: now() });
}

export async function deleteDraft(db: SchietsportDatabase, id: string) {
  await db.drafts.delete(id);
}

// ── Geweigerde wijziging weggooien ───────────────────────────────────

// Een door de server geweigerde wijziging laten vallen: nooit
// gesynchroniseerde records verdwijnen lokaal; van bestaande records wordt
// bij de volgende sync de serverversie opnieuw opgehaald.
export async function discardLocalChange(
  db: SchietsportDatabase,
  entity: EntityName,
  id: string,
) {
  const table = db.entityTable(entity);
  await db.transaction("rw", table, db.outbox, db.meta, async () => {
    const record = await table.get(id);
    await db.outbox.delete(id);
    if (!record) return;
    if (record.version === 0) {
      await table.delete(id);
    } else {
      await table.update(id, { syncState: "synced", syncError: null } as never);
      await db.meta.put({ key: "cursor", value: 0 });
    }
  });
  notifyChange();
}
