import {
  defaultProfile,
  normalizeProfile,
} from "@/features/training/domain/defaults";
import { cleanValues, type Position } from "@/features/training/domain/workout";
import type {
  BodyMetric,
  CustomExerciseRecord,
  Exercise,
  ExercisePref,
  Profile,
  Program,
  ProgramContent,
  SessionSnapshot,
  SessionStatus,
  SetValues,
  Tracking,
  TrainingSession,
  TrainingSet,
} from "@/features/training/domain/types";
import { deterministicId, newId } from "@/features/training/lib/ids";
import type { EntityName, LocalRecord, TrainingDatabase } from "./database";
import { fromServerRow } from "./mapping";

// Alle schrijfacties van de trainingsmodule. Elke wijziging gaat in één
// IndexedDB-transactie samen met een wachtrij-entry, zodat niets kwijt kan
// raken tussen "opgeslagen" en "te synchroniseren".

const listeners = new Set<() => void>();

export function onLocalChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const notify = () => listeners.forEach((l) => l());
const nowIso = () => new Date().toISOString();

async function enqueue(
  db: TrainingDatabase,
  entity: EntityName,
  recordId: string,
) {
  const existing = await db.outbox.get(recordId);
  if (existing) {
    // Nieuwe inhoud = nieuw changeId; de volgorde (seq) blijft, zodat een
    // sessie altijd vóór haar sets naar de server gaat.
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
    lastError: null,
  });
}

export async function writeRecord<E extends EntityName>(
  db: TrainingDatabase,
  entity: E,
  record:
    | LocalRecord<E>
    | (Omit<LocalRecord<E>, "syncState"> & { syncState?: string }),
  options: { seeded?: boolean; silent?: boolean } = {},
) {
  const table = db.entityTable(entity);
  await db.transaction("rw", table, db.outbox, async () => {
    await table.put({
      ...(record as LocalRecord<E>),
      syncState: "pending",
      syncError: null,
      seeded: options.seeded ? true : undefined,
    });
    await enqueue(db, entity, record.id);
  });
  if (!options.silent) notify();
}

async function patch<E extends EntityName>(
  db: TrainingDatabase,
  entity: E,
  id: string,
  change: (current: LocalRecord<E>) => Partial<LocalRecord<E>>,
): Promise<LocalRecord<E>> {
  const table = db.entityTable(entity);
  let next!: LocalRecord<E>;
  await db.transaction("rw", table, db.outbox, async () => {
    const current = await table.get(id);
    if (!current) throw new Error("Record niet gevonden");
    next = { ...current, ...change(current), updatedAt: nowIso() };
    await writeRecord(db, entity, next, { silent: true });
  });
  notify();
  return next;
}

const base = (userId: string, id = newId()) => {
  const at = nowIso();
  return {
    id,
    userId,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    version: 0,
  };
};

// ── Profiel ───────────────────────────────────────────────────────────

export async function ensureProfile(
  db: TrainingDatabase,
  userId: string,
): Promise<Profile> {
  const existing = await db.profiles.get(userId);
  if (existing) return normalizeProfile(existing);
  const profile = defaultProfile(userId, nowIso());
  await writeRecord(
    db,
    "profile",
    { ...profile, syncState: "pending" },
    { seeded: true },
  );
  return profile;
}

export async function updateProfile(
  db: TrainingDatabase,
  userId: string,
  change: (profile: Profile) => Profile,
) {
  await ensureProfile(db, userId);
  return patch(db, "profile", userId, (current) => {
    const next = change(normalizeProfile(current));
    return {
      settings: next.settings,
      equipment: next.equipment,
      exercisePrefs: next.exercisePrefs,
      seeded: undefined,
    };
  });
}

export function setExercisePref(
  db: TrainingDatabase,
  userId: string,
  exerciseId: string,
  pref: ExercisePref,
) {
  return updateProfile(db, userId, (p) => {
    const merged: ExercisePref = {
      ...(p.exercisePrefs[exerciseId] ?? {}),
      ...pref,
    };
    // Lege waarden weglaten, zodat het profiel klein blijft.
    for (const key of Object.keys(merged) as (keyof ExercisePref)[]) {
      if (
        merged[key] === undefined ||
        merged[key] === "" ||
        merged[key] === false
      )
        delete merged[key];
    }
    const prefs = { ...p.exercisePrefs };
    if (Object.keys(merged).length) prefs[exerciseId] = merged;
    else delete prefs[exerciseId];
    return { ...p, exercisePrefs: prefs };
  });
}

// ── Schema's ──────────────────────────────────────────────────────────

export async function createProgram(
  db: TrainingDatabase,
  userId: string,
  input: { name: string; content: ProgramContent; source?: string | null },
): Promise<Program> {
  const program: Program = {
    ...base(userId),
    name: input.name.trim().slice(0, 80) || "Mijn schema",
    content: input.content,
    revision: 1,
    source: input.source ?? null,
    archivedAt: null,
  };
  await writeRecord(db, "program", { ...program, syncState: "pending" });
  return program;
}

export function saveProgram(
  db: TrainingDatabase,
  id: string,
  input: { name: string; content: ProgramContent },
) {
  return patch(db, "program", id, (p) => ({
    name: input.name.trim().slice(0, 80) || p.name,
    content: input.content,
    revision: p.revision + 1,
  }));
}

export async function duplicateProgram(
  db: TrainingDatabase,
  userId: string,
  id: string,
) {
  const original = await db.programs.get(id);
  if (!original) throw new Error("Schema niet gevonden");
  return createProgram(db, userId, {
    name: `${original.name} (kopie)`.slice(0, 80),
    content: structuredClone(original.content),
    source: original.source,
  });
}

export const archiveProgram = (
  db: TrainingDatabase,
  id: string,
  archived: boolean,
) =>
  patch(db, "program", id, () => ({ archivedAt: archived ? nowIso() : null }));

export const deleteProgram = (db: TrainingDatabase, id: string) =>
  patch(db, "program", id, () => ({ deletedAt: nowIso() }));

// ── Eigen oefeningen ──────────────────────────────────────────────────

export async function saveCustomExercise(
  db: TrainingDatabase,
  userId: string,
  exercise: Exercise,
): Promise<string> {
  const { id, name, custom: _custom, ...data } = exercise;
  const existing = id ? await db.exercises.get(id) : undefined;
  if (existing) {
    await patch(db, "exercise", id, () => ({
      name: name.trim().slice(0, 80),
      data,
    }));
    return id;
  }
  const record: CustomExerciseRecord = {
    ...base(userId),
    name: name.trim().slice(0, 80) || "Eigen oefening",
    data,
    archivedAt: null,
  };
  await writeRecord(db, "exercise", { ...record, syncState: "pending" });
  return record.id;
}

export const archiveCustomExercise = (
  db: TrainingDatabase,
  id: string,
  archived: boolean,
) =>
  patch(db, "exercise", id, () => ({ archivedAt: archived ? nowIso() : null }));

// ── Sessies ───────────────────────────────────────────────────────────

export async function startSession(
  db: TrainingDatabase,
  userId: string,
  input: {
    programId: string | null;
    programRevision: number | null;
    dayId: string | null;
    name: string;
    snapshot: SessionSnapshot;
    localDate: string;
    timeZone: string | null;
    status?: SessionStatus;
  },
): Promise<TrainingSession> {
  const at = nowIso();
  const session: TrainingSession = {
    ...base(userId),
    programId: input.programId,
    programRevision: input.programRevision,
    dayId: input.dayId,
    name: input.name.slice(0, 120) || "Training",
    status: input.status ?? "active",
    startedAt: at,
    endedAt: input.status === "skipped" ? at : null,
    localDate: input.localDate,
    timeZone: input.timeZone,
    notes: null,
    snapshot: input.snapshot,
  };
  await writeRecord(db, "session", { ...session, syncState: "pending" });
  return session;
}

export const updateSnapshot = (
  db: TrainingDatabase,
  id: string,
  change: (snapshot: SessionSnapshot) => SessionSnapshot,
) =>
  patch(db, "session", id, (s) => ({
    snapshot: change(structuredClone(s.snapshot)),
  }));

export const updateSession = (
  db: TrainingDatabase,
  id: string,
  change: Partial<Pick<TrainingSession, "notes" | "name" | "localDate">>,
) => patch(db, "session", id, () => change);

export function setSessionStatus(
  db: TrainingDatabase,
  id: string,
  status: SessionStatus,
  options: { endedEarly?: boolean } = {},
) {
  return patch(db, "session", id, (s) => {
    const ends = status === "completed" || status === "cancelled";
    return {
      status,
      endedAt: ends
        ? (s.endedAt ?? nowIso())
        : status === "active"
          ? null
          : s.endedAt,
      snapshot:
        options.endedEarly !== undefined
          ? { ...s.snapshot, endedEarly: options.endedEarly }
          : s.snapshot,
    };
  });
}

export const deleteSession = (db: TrainingDatabase, id: string) =>
  patch(db, "session", id, () => ({ deletedAt: nowIso() }));

// ── Sets ──────────────────────────────────────────────────────────────

// Set voltooien. Idempotent per positie: staat er al een (niet ongedaan
// gemaakte) set op deze plek, dan gebeurt er niets. Dubbel tikken of een
// herhaalde aanroep kan dus nooit twee sets opleveren. Een eerder ongedaan
// gemaakte set op dezelfde plek wordt hergebruikt.
export async function completeSet(
  db: TrainingDatabase,
  userId: string,
  input: {
    sessionId: string;
    position: Position;
    exerciseId: string;
    tracking: Tracking;
    values: SetValues;
  },
): Promise<{ set: TrainingSet; created: boolean }> {
  let result!: { set: TrainingSet; created: boolean };
  const values = cleanValues(input.tracking, input.values);
  await db.transaction("rw", db.sets, db.outbox, async () => {
    const existing = await db.sets
      .where("[sessionId+slot+kind+setIndex]")
      .equals([
        input.sessionId,
        input.position.slot,
        input.position.kind,
        input.position.index,
      ])
      .first();
    if (existing && !existing.deletedAt) {
      result = { set: existing, created: false };
      return;
    }
    const at = nowIso();
    const set: TrainingSet = existing
      ? {
          ...existing,
          ...values,
          exerciseId: input.exerciseId,
          deletedAt: null,
          completedAt: at,
          updatedAt: at,
        }
      : {
          ...base(userId),
          ...values,
          sessionId: input.sessionId,
          exerciseId: input.exerciseId,
          slot: input.position.slot,
          kind: input.position.kind,
          setIndex: input.position.index,
          rpe: null,
          rir: null,
          notes: null,
          completedAt: at,
        };
    await writeRecord(
      db,
      "set",
      { ...set, syncState: "pending" },
      { silent: true },
    );
    result = { set, created: true };
  });
  notify();
  return result;
}

export const undoSet = (db: TrainingDatabase, id: string) =>
  patch(db, "set", id, () => ({ deletedAt: nowIso() }));

// Gecontroleerde correctie van een opgeslagen set (historie).
export function editSet(
  db: TrainingDatabase,
  id: string,
  tracking: Tracking,
  values: SetValues,
) {
  return patch(db, "set", id, () => cleanValues(tracking, values));
}

// ── Lichaam ───────────────────────────────────────────────────────────

export async function saveBodyMetric(
  db: TrainingDatabase,
  userId: string,
  input: {
    measuredOn: string;
    weightKg: number | null;
    measurements: Record<string, number>;
    notes: string | null;
  },
): Promise<BodyMetric> {
  const id = await deterministicId(`${userId}:body:${input.measuredOn}`);
  const existing = await db.bodyMetrics.get(id);
  const metric: BodyMetric = {
    ...(existing ?? base(userId, id)),
    measuredOn: input.measuredOn,
    weightKg: input.weightKg,
    measurements: input.measurements,
    notes: input.notes?.trim() || null,
    deletedAt: null,
    updatedAt: nowIso(),
  };
  await writeRecord(db, "body_metric", { ...metric, syncState: "pending" });
  return metric;
}

export const deleteBodyMetric = (db: TrainingDatabase, id: string) =>
  patch(db, "body_metric", id, () => ({ deletedAt: nowIso() }));

// ── Conflicten ────────────────────────────────────────────────────────

// "local": eigen versie alsnog doorvoeren (bovenop de serverversie).
// "server": serverversie houden, eigen versie vergeten.
export async function resolveConflict(
  db: TrainingDatabase,
  id: string,
  choice: "local" | "server",
) {
  const conflict = await db.conflicts.get(id);
  if (!conflict) return;
  if (choice === "local") {
    const table = db.entityTable(conflict.entity);
    const current = await table.get(id);
    const mine = fromServerRow(conflict.entity, conflict.local);
    await writeRecord(db, conflict.entity, {
      ...mine,
      version: current?.version ?? (conflict.server.version as number),
      updatedAt: nowIso(),
    } as never);
  }
  await db.conflicts.delete(id);
  notify();
}
