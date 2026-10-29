import "fake-indexeddb/auto";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { TrainingDatabase } from "@/features/training/db/database";
import {
  completeSet,
  createProgram,
  ensureProfile,
  resolveConflict,
  saveProgram,
  setSessionStatus,
  startSession,
  undoSet,
  updateProfile,
} from "@/features/training/db/repository";
import { systemExercise } from "@/features/training/domain/exercises";
import { generateProgram } from "@/features/training/domain/generator";
import { buildHistoryIndex, buildPrescription, previousPerformance } from "@/features/training/domain/performance";
import { programTemplate } from "@/features/training/domain/templates";
import { buildSnapshot } from "@/features/training/domain/workout";
import { SyncEngine } from "@/features/training/sync/engine";
import { OWNER_A, OWNER_B, PgliteTransport, createTrainingTestDb } from "./harness";

// Van begin tot eind: IndexedDB (fake-indexeddb) ↔ de echte migratie in
// PGlite. Elk "apparaat" heeft een eigen lokale database.

let pg: PGlite;
let n = 0;

function device(user: string) {
  const db = new TrainingDatabase(`training-test-${user}-${++n}`);
  const transport = new PgliteTransport(pg, user);
  const engine = new SyncEngine(db, transport, { pageSize: 3 });
  return { db, transport, engine, user };
}

const today = "2026-10-29";

async function trainBench(d: ReturnType<typeof device>, reps: number[]) {
  const sessions = await d.db.sessions.toArray();
  const sets = await d.db.sets.toArray();
  const index = buildHistoryIndex(sessions, sets);
  const template = programTemplate("fullbody-3")!;
  const { content } = generateProgram(
    template,
    { level: "intermediate", goal: "combined", sessionMinutes: 90, owned: new Set(["barbell", "dumbbell", "bench", "jump_rope", "plates"]), scheduleMode: "weekly" },
    systemExercise,
  );
  const day = content.days[0];
  const snapshot = buildSnapshot(null, day, { lookup: systemExercise, index, scope: "any", prefs: {} });
  const session = await startSession(d.db, d.user, {
    programId: null,
    programRevision: null,
    dayId: day.id,
    name: day.name,
    snapshot,
    localDate: today,
    timeZone: "Europe/Amsterdam",
  });
  const benchSlot = snapshot.exercises.find((e) => e.exerciseId === "bench-press")!.slot;
  for (const [i, r] of reps.entries()) {
    await completeSet(d.db, d.user, {
      sessionId: session.id,
      position: { slot: benchSlot, kind: "work", index: i },
      exerciseId: "bench-press",
      tracking: "weight_reps",
      values: { weightKg: 40, reps: r, durationSec: null, jumps: null },
    });
  }
  await setSessionStatus(d.db, session.id, "completed");
  return session;
}

beforeAll(async () => {
  pg = await createTrainingTestDb();
});

describe("synchronisatie", () => {
  it("training op apparaat A staat na sync op apparaat B, met dezelfde volgende opdracht", async () => {
    const a = device(OWNER_A);
    await ensureProfile(a.db, OWNER_A);
    await trainBench(a, [10, 10, 8]);
    const report = await a.engine.sync();
    expect(report.outcome).toBe("ok");
    expect(await a.db.outbox.count()).toBe(0);
    expect((await a.db.sets.toArray()).every((s) => s.syncState === "synced")).toBe(true);

    const b = device(OWNER_A);
    await b.engine.sync(); // paginagrootte 3: meerdere pagina's
    expect(await b.db.sets.count()).toBe(3);
    const index = buildHistoryIndex(await b.db.sessions.toArray(), await b.db.sets.toArray());
    const next = buildPrescription(
      { sets: 3, warmupSets: 0, repMin: 6, repMax: 10, durationSec: null, startWeightKg: null, tracking: "weight_reps" },
      previousPerformance(index, "bench-press", { scope: "any" }),
    );
    expect(next.work.map((s) => `${s.weightKg}×${s.reps}`)).toEqual(["40×10", "40×10", "40×8"]);
  });

  it("geen dubbele sets bij herhaald tikken", async () => {
    const a = device(OWNER_A);
    const session = await startSession(a.db, OWNER_A, {
      programId: null, programRevision: null, dayId: null, name: "Los", snapshot: { programName: null, dayName: null, exercises: [] }, localDate: today, timeZone: null,
    });
    const input = {
      sessionId: session.id,
      position: { slot: 0, kind: "work" as const, index: 0 },
      exerciseId: "db-curl",
      tracking: "weight_reps" as const,
      values: { weightKg: 12, reps: 10, durationSec: null, jumps: null },
    };
    const results = await Promise.all([completeSet(a.db, OWNER_A, input), completeSet(a.db, OWNER_A, input), completeSet(a.db, OWNER_A, input)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await a.db.sets.where("sessionId").equals(session.id).count()).toBe(1);

    // Ongedaan maken en opnieuw: dezelfde rij komt terug, nog steeds één.
    await undoSet(a.db, results[0].set.id);
    const again = await completeSet(a.db, OWNER_A, { ...input, values: { ...input.values, reps: 9 } });
    expect(again.set.id).toBe(results[0].set.id);
    await a.engine.sync();
    const server = await pg.query("select reps, deleted_at from public.training_sets where session_id = $1", [session.id]);
    expect(server.rows).toEqual([{ reps: 9, deleted_at: null }]);
  });

  it("verloren antwoord: opnieuw pushen geeft geen dubbele rij en wordt toch bevestigd", async () => {
    const a = device(OWNER_A);
    const session = await trainBench(a, [8]);
    a.transport.loseNextPushResponse = true;
    expect((await a.engine.sync()).outcome).toBe("offline");
    expect((await a.engine.sync()).outcome).toBe("ok");
    expect(await a.db.outbox.count()).toBe(0);
    const rows = await pg.query("select id from public.training_sessions where id = $1", [session.id]);
    expect(rows.rows).toHaveLength(1);
  });

  it("zonder internet blijft alles lokaal staan en gaat het later alsnog mee", async () => {
    const a = device(OWNER_A);
    a.transport.offline = true;
    const session = await trainBench(a, [10, 10]);
    expect((await a.engine.sync()).outcome).toBe("offline");
    expect(await a.db.outbox.count()).toBe(3);
    expect((await a.db.sessions.get(session.id))?.status).toBe("completed");
    a.transport.offline = false;
    expect((await a.engine.sync()).outcome).toBe("ok");
    const rows = await pg.query("select count(*)::int as n from public.training_sets where session_id = $1", [session.id]);
    expect(rows.rows[0]).toEqual({ n: 2 });
  });

  it("conflict tussen apparaten gaat niet stil verloren", async () => {
    const a = device(OWNER_A);
    const content = { scheduleMode: "weekly" as const, days: [] };
    const program = await createProgram(a.db, OWNER_A, { name: "Gedeeld", content });
    await a.engine.sync();
    const b = device(OWNER_A);
    await b.engine.sync();

    await saveProgram(a.db, program.id, { name: "Versie A", content });
    await saveProgram(b.db, program.id, { name: "Versie B", content });
    await a.engine.sync();
    const report = await b.engine.sync();
    expect(report.conflicts).toBe(1);
    expect((await b.db.programs.get(program.id))?.name).toBe("Versie A");
    const [conflict] = await b.db.conflicts.toArray();
    expect(conflict.local.name).toBe("Versie B");

    await resolveConflict(b.db, program.id, "local");
    await b.engine.sync();
    await a.engine.sync();
    expect((await a.db.programs.get(program.id))?.name).toBe("Versie B");
  });

  it("een automatisch aangemaakt profiel wint stil van de server", async () => {
    const b1 = device(OWNER_B);
    await ensureProfile(b1.db, OWNER_B);
    await updateProfile(b1.db, OWNER_B, (p) => ({ ...p, settings: { ...p.settings, level: "advanced" } }));
    await b1.engine.sync();
    const b2 = device(OWNER_B);
    await ensureProfile(b2.db, OWNER_B); // tweede apparaat, nog niet gesynct
    const report = await b2.engine.sync();
    expect(report.conflicts).toBe(0);
    expect((await b2.db.profiles.get(OWNER_B))?.settings.level).toBe("advanced");
  });

  it("gebruikers zien elkaars gegevens niet", async () => {
    const b = device(OWNER_B);
    await b.engine.sync();
    expect(await b.db.sessions.count()).toBe(0);
    expect(await b.db.sets.count()).toBe(0);
  });
});
