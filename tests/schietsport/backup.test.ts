import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { SchietsportDatabase } from "@/features/schietsport/db/database";
import {
  createDiscipline,
  createWeapon,
  saveSession,
  softDelete,
} from "@/features/schietsport/db/repository";
import { scoreSession } from "@/features/schietsport/domain/scoring";
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  importBackup,
  parseBackup,
} from "@/features/schietsport/backup/json";
import { cardsToCsv, sessionsToCsv } from "@/features/schietsport/backup/csv";

let n = 0;
const freshDb = () => new SchietsportDatabase(`backup-${++n}`);
const USER = "a0000000-0000-4000-8000-00000000000a";

async function seed(db: SchietsportDatabase) {
  const discipline = await createDiscipline(db, USER, {
    name: "Precisie; 25 m",
    description: null,
  });
  const weapon = await createWeapon(db, USER, {
    name: 'Walther "GSP"',
    brand: null,
    model: null,
    weaponType: "pistool",
    caliber: ".22",
    ownership: "eigen",
    notes: null,
  });
  const practice = scoreSession({
    type: "practice_match",
    totalScore: null,
    cards: [47, 49, 48, 50, 46, 49].map((score, i) => ({
      cardNumber: i + 1,
      shotCount: 5,
      score: i === 2 ? null : score,
      shots: i === 2 ? [10, 10, 9, 10, 9] : null,
    })),
  });
  if (!practice.ok) throw new Error("ongeldig");
  const session = await saveSession(db, USER, {
    sessionDate: "2026-10-29",
    weaponId: weapon.id,
    disciplineId: discipline.id,
    distance: 25,
    notes: "Regel 1\nregel 2",
    score: practice.value,
  });
  return { discipline, weapon, session };
}

describe("JSON-back-up", () => {
  it("exporteren en importeren op een leeg apparaat herstelt alles", async () => {
    const source = freshDb();
    const { session } = await seed(source);
    const backup = await createBackup(source);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(JSON.stringify(backup)).not.toContain("syncState");

    const target = freshDb();
    const report = await importBackup(
      target,
      USER,
      parseBackup(JSON.stringify(backup)),
    );
    expect(report).toEqual({ added: 3, updated: 0, skipped: 0, invalid: 0 });
    const restored = await target.sessions.get(session.id);
    expect(restored).toMatchObject({
      totalScore: 289,
      syncState: "pending",
      version: 0,
    });
    expect(restored!.cards[2].shots).toEqual([10, 10, 9, 10, 9]);
    expect(await target.outbox.count()).toBe(3);
  });

  it("nogmaals importeren verandert niets; verwijderde records gaan niet mee", async () => {
    const db = freshDb();
    const { weapon } = await seed(db);
    await softDelete(db, "weapon", weapon.id);
    const backup = await createBackup(db);
    expect((backup.data.weapons as unknown[]).length).toBe(0);
    const report = await importBackup(db, USER, backup);
    expect(report).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });

  it("weigert vreemde bestanden, nieuwere versies en ongeldige schietbeurten", async () => {
    expect(() => parseBackup("geen json")).toThrow(/geen geldige JSON/);
    expect(() => parseBackup(JSON.stringify({ hallo: 1 }))).toThrow(
      /geen Schietsport-back-up/,
    );
    const db = freshDb();
    await seed(db);
    const backup = await createBackup(db);
    expect(() =>
      parseBackup(
        JSON.stringify({ ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
      ),
    ).toThrow(/nieuwere versie/);
    const tampered = structuredClone(backup);
    (tampered.data.sessions[0] as { totalScore: number }).totalScore = 301;
    const report = await importBackup(freshDb(), USER, tampered);
    expect(report.invalid).toBe(1);
  });
});

describe("CSV-export", () => {
  it("schietbeurten en kaarten, met correcte quoting en decimale komma", async () => {
    const db = freshDb();
    const { weapon, discipline } = await seed(db);
    const sessions = await db.sessions.toArray();
    const lookups = { weapons: [weapon], disciplines: [discipline] };

    const csv = sessionsToCsv(sessions, lookups);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toContain("Datum;Type;Wapen");
    expect(lines[1]).toContain('"Walther ""GSP"""');
    expect(lines[1]).toContain('"Precisie; 25 m"');
    expect(lines[1]).toContain(
      "289;300;96,3;6 × 5;47 | 49 | 48 | 50 | 46 | 49",
    );
    expect(lines[1]).toContain('"Regel 1\nregel 2"');

    const cards = cardsToCsv(sessions, lookups).slice(1).split("\r\n");
    expect(cards).toHaveLength(7);
    expect(cards[3]).toContain(";3;5;48;50;10 10 9 10 9;");
  });
});
