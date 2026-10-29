import "fake-indexeddb/auto";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { SchietsportDatabase } from "@/features/schietsport/db/database";
import {
  createDiscipline,
  createWeapon,
  deleteSession,
  resolveConflict,
  saveSession,
  setWeaponPhoto,
  updateWeapon,
  writeRecord,
} from "@/features/schietsport/db/repository";
import {
  ensureDefaultDisciplines,
  DEFAULT_DISCIPLINES,
} from "@/features/schietsport/db/seed";
import { scoreSession } from "@/features/schietsport/domain/scoring";
import { SyncEngine } from "@/features/schietsport/sync/engine";
import {
  SyncError,
  classifyError,
  type SyncTransport,
} from "@/features/schietsport/sync/transport";
import { OWNER_A, OWNER_B, createSchietsportTestDb, runAs } from "./harness";

// Synchronisatie van begin tot eind: IndexedDB (fake-indexeddb) ↔ de echte
// SQL-functies in PGlite. Elk "apparaat" heeft een eigen lokale database.

let pg: PGlite;
const photoStore = new Map<string, Blob>();

class PgliteTransport implements SyncTransport {
  offline = false;
  loseNextPushResponse = false;
  constructor(private user: string) {}

  private async call<T>(sql: string, params: unknown[]): Promise<T> {
    if (this.offline) throw new SyncError("network", "offline");
    try {
      const rows = await runAs<{ r: T }>(pg, this.user, sql, params);
      return rows[0].r;
    } catch (error) {
      const e = error as { code?: string; message?: string };
      throw classifyError({ code: e.code, message: e.message, status: 400 });
    }
  }

  async push(
    entity: string,
    changeId: string,
    baseVersion: number,
    row: Record<string, unknown>,
  ) {
    const result = await this.call<never>(
      `select public.shooting_push_${entity}($1, $2, $3) as r`,
      [changeId, baseVersion, JSON.stringify(row)],
    );
    if (this.loseNextPushResponse) {
      this.loseNextPushResponse = false;
      throw new SyncError("network", "antwoord kwijt");
    }
    return result;
  }

  pull(since: number, limit: number) {
    return this.call<never>("select public.shooting_pull($1, $2) as r", [
      since,
      limit,
    ]);
  }

  async uploadPhoto(path: string, blob: Blob) {
    if (this.offline) throw new SyncError("network", "offline");
    photoStore.set(path, blob);
  }

  async downloadPhoto(path: string) {
    return photoStore.get(path) ?? null;
  }
}

let deviceCounter = 0;
function device(user = OWNER_A, pageSize = 500) {
  const db = new SchietsportDatabase(`test-${++deviceCounter}`);
  const transport = new PgliteTransport(user);
  const engine = new SyncEngine(db, transport, user, { pageSize });
  return { db, transport, engine, user };
}

const matchScore = (total: number) => {
  const result = scoreSession({ type: "match", totalScore: total, cards: [] });
  if (!result.ok) throw new Error("ongeldig");
  return result.value;
};

const serverCount = async (table: string, user = OWNER_A) =>
  (
    await runAs<{ n: number }>(
      pg,
      user,
      `select count(*)::int as n from public.${table}`,
    )
  )[0].n;

beforeAll(async () => {
  pg = await createSchietsportTestDb();
});

describe("offline-first", () => {
  it("offline opgeslagen gegevens blijven bewaard en gaan later mee", async () => {
    const phone = device();
    phone.transport.offline = true;
    const discipline = await createDiscipline(phone.db, phone.user, {
      name: "Precisie",
      description: null,
    });
    const weapon = await createWeapon(phone.db, phone.user, {
      name: "Walther GSP",
      brand: "Walther",
      model: "GSP",
      weaponType: "pistool",
      caliber: ".22 LR",
      ownership: "eigen",
      notes: null,
    });
    await saveSession(phone.db, phone.user, {
      sessionDate: "2026-10-29",
      weaponId: weapon.id,
      disciplineId: discipline.id,
      distance: 25,
      notes: null,
      score: matchScore(287),
    });

    const offline = await phone.engine.sync();
    expect(offline.outcome).toBe("offline");
    expect(await phone.db.outbox.count()).toBe(3);
    expect((await phone.db.sessions.toArray())[0].syncState).toBe("pending");

    // Na herstart van de app (nieuwe verbinding met dezelfde IndexedDB).
    phone.db.close();
    const reopened = new SchietsportDatabase(phone.db.name);
    expect(await reopened.sessions.count()).toBe(1);
    expect(await reopened.outbox.count()).toBe(3);

    const engine = new SyncEngine(
      reopened,
      new PgliteTransport(OWNER_A),
      OWNER_A,
    );
    const online = await engine.sync();
    expect(online).toMatchObject({
      outcome: "ok",
      pushed: 3,
      conflicts: 0,
      rejected: 0,
    });
    expect(await reopened.outbox.count()).toBe(0);
    const session = (await reopened.sessions.toArray())[0];
    expect(session).toMatchObject({
      syncState: "synced",
      version: 1,
      totalScore: 287,
    });
  });

  it("een nieuwe telefoon haalt na inloggen alles terug", async () => {
    const newPhone = device();
    const report = await newPhone.engine.sync();
    expect(report.outcome).toBe("ok");
    expect(await newPhone.db.sessions.count()).toBe(1);
    expect(await newPhone.db.weapons.count()).toBe(1);
    expect((await newPhone.db.sessions.toArray())[0].totalScore).toBe(287);
  });
});

describe("betrouwbaarheid", () => {
  it("antwoord kwijt na een geslaagde push: opnieuw proberen maakt geen dubbel record", async () => {
    const phone = device();
    await phone.engine.sync();
    const before = await serverCount("shooting_weapons");
    const weapon = await createWeapon(phone.db, phone.user, {
      name: "Pardini SP",
      brand: null,
      model: null,
      weaponType: "pistool",
      caliber: null,
      ownership: "geleend",
      notes: null,
    });
    phone.transport.loseNextPushResponse = true;
    expect((await phone.engine.sync()).outcome).toBe("offline");
    expect((await phone.db.weapons.get(weapon.id))!.syncState).toBe("pending");

    expect((await phone.engine.sync()).outcome).toBe("ok");
    expect(await serverCount("shooting_weapons")).toBe(before + 1);
    expect(await phone.db.weapons.get(weapon.id)).toMatchObject({
      syncState: "synced",
      version: 1,
    });
  });

  it("antwoord kwijt én daarna lokaal aangepast: de laatste versie komt aan, zonder conflict", async () => {
    const phone = device();
    await phone.engine.sync();
    const weapon = await createWeapon(phone.db, phone.user, {
      name: "Eerste naam",
      brand: null,
      model: null,
      weaponType: "pistool",
      caliber: null,
      ownership: "eigen",
      notes: null,
    });
    phone.transport.loseNextPushResponse = true;
    await phone.engine.sync();
    await updateWeapon(phone.db, weapon.id, { name: "Tweede naam" });

    const report = await phone.engine.sync();
    expect(report).toMatchObject({ outcome: "ok", conflicts: 0 });
    expect(await phone.db.conflicts.count()).toBe(0);
    const server = await runAs<{ name: string; version: number }>(
      pg,
      OWNER_A,
      "select name, version from public.shooting_weapons where id = $1",
      [weapon.id],
    );
    expect(server[0]).toEqual({ name: "Tweede naam", version: 2 });
  });

  it("conflict tussen twee apparaten: niets gaat stilzwijgend verloren", async () => {
    const phone = device();
    const laptop = device();
    await phone.engine.sync();
    const weapon = await createWeapon(phone.db, phone.user, {
      name: "Origineel",
      brand: null,
      model: null,
      weaponType: "karabijn",
      caliber: null,
      ownership: "eigen",
      notes: null,
    });
    await phone.engine.sync();
    await laptop.engine.sync();

    await updateWeapon(phone.db, weapon.id, { notes: "Vizier bijgesteld" });
    await updateWeapon(laptop.db, weapon.id, { notes: "Nieuwe kolf" });
    await phone.engine.sync();
    const report = await laptop.engine.sync();

    expect(report.conflicts).toBe(1);
    const conflict = await laptop.db.conflicts.get(weapon.id);
    expect(conflict?.local.notes).toBe("Nieuwe kolf");
    expect((await laptop.db.weapons.get(weapon.id))!.notes).toBe(
      "Vizier bijgesteld",
    );

    // Gebruiker kiest de eigen (laptop)versie.
    await resolveConflict(laptop.db, weapon.id, "local");
    expect((await laptop.engine.sync()).conflicts).toBe(0);
    await phone.engine.sync();
    expect((await phone.db.weapons.get(weapon.id))!.notes).toBe("Nieuwe kolf");
    expect(await laptop.db.conflicts.count()).toBe(0);
  });

  it("verwijderen komt op het andere apparaat aan als verwijdermarkering", async () => {
    const phone = device();
    const laptop = device();
    await phone.engine.sync();
    const sessionId = (await phone.db.sessions.toArray())[0].id;
    await laptop.engine.sync();
    await deleteSession(phone.db, sessionId);
    await phone.engine.sync();
    await laptop.engine.sync();
    expect((await laptop.db.sessions.get(sessionId))!.deletedAt).not.toBeNull();
  });

  it("een door de server geweigerde wijziging blijft lokaal staan; de rest gaat door", async () => {
    const phone = device();
    await phone.engine.sync();
    const disciplineId = (await phone.db.disciplines.toArray())[0].id;
    const good = await saveSession(phone.db, phone.user, {
      sessionDate: "2026-10-28",
      weaponId: null,
      disciplineId,
      distance: 12,
      notes: null,
      score: matchScore(270),
    });
    // Corrupte lokale invoer die de domeinvalidatie omzeilt.
    await writeRecord(phone.db, "session", {
      ...good,
      id: crypto.randomUUID(),
      version: 0,
      totalScore: 999,
      syncState: "pending",
    });

    const report = await phone.engine.sync();
    expect(report).toMatchObject({ outcome: "ok", rejected: 1 });
    expect((await phone.db.sessions.get(good.id))!.syncState).toBe("synced");
    const rejected = (
      await phone.db.sessions.where("syncState").equals("rejected").toArray()
    )[0];
    expect(rejected.syncError).toBeTruthy();
    expect(await phone.db.outbox.count()).toBe(1);
  });
});

describe("standaarddisciplines", () => {
  it("twee apparaten die allebei seeden maken geen dubbele disciplines", async () => {
    const phone = device(OWNER_B);
    const tablet = device(OWNER_B);
    await ensureDefaultDisciplines(phone.db, OWNER_B);
    await ensureDefaultDisciplines(tablet.db, OWNER_B);
    await phone.engine.sync();
    const report = await tablet.engine.sync();
    expect(report.conflicts).toBe(0);
    expect(await serverCount("shooting_disciplines", OWNER_B)).toBe(
      DEFAULT_DISCIPLINES.length,
    );
    expect(await tablet.db.disciplines.count()).toBe(
      DEFAULT_DISCIPLINES.length,
    );
    expect(await tablet.db.outbox.count()).toBe(0);
  });
});

describe("pull in pagina's", () => {
  it("haalt meer dan één pagina op, ook voor net gemaakte rijen", async () => {
    const fresh = device(OWNER_B, 4);
    const report = await fresh.engine.sync();
    expect(report.outcome).toBe("ok");
    expect(await fresh.db.disciplines.count()).toBe(DEFAULT_DISCIPLINES.length);
  });
});

describe("wapenfoto's", () => {
  it("foto offline bewaren, later uploaden en op een ander apparaat ophalen", async () => {
    const phone = device();
    await phone.engine.sync();
    const weapon = (await phone.db.weapons.toArray())[0];
    phone.transport.offline = true;
    await setWeaponPhoto(
      phone.db,
      weapon.id,
      new Blob(["foto"], { type: "image/webp" }),
    );
    await phone.engine.sync();
    expect((await phone.db.photos.get(weapon.id))!.uploaded).toBe(false);

    phone.transport.offline = false;
    await phone.engine.sync();
    expect((await phone.db.photos.get(weapon.id))!.uploaded).toBe(true);
    expect((await phone.db.weapons.get(weapon.id))!.photoPath).toBe(
      `${OWNER_A}/${weapon.id}.webp`,
    );

    const laptop = device();
    await laptop.engine.sync();
    const photo = await laptop.db.photos.get(weapon.id);
    expect(await photo!.blob.text()).toBe("foto");
  });
});
