import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { OWNER_A, OWNER_B, R6_PLAYER, createTrainingTestDb, runAs, upsertAs } from "./harness";

// De echte migratie in PGlite: RLS, versiecontrole, idempotentie en CHECKs.

let pg: PGlite;
const SESSION = "11111111-1111-4111-8111-111111111111";
const SET = "22222222-2222-4222-8222-222222222222";

const sessionRow = (extra: Record<string, unknown> = {}) => ({
  id: SESSION,
  user_id: OWNER_A,
  name: "Full Body A",
  status: "active",
  started_at: "2026-10-29T09:00:00Z",
  local_date: "2026-10-29",
  snapshot: { exercises: [] },
  version: 1,
  last_change_id: "c0000000-0000-4000-8000-000000000001",
  ...extra,
});

const setRow = (extra: Record<string, unknown> = {}) => ({
  id: SET,
  user_id: OWNER_A,
  session_id: SESSION,
  exercise_id: "bench-press",
  slot: 0,
  kind: "work",
  set_index: 0,
  weight_kg: 40,
  reps: 10,
  completed_at: "2026-10-29T09:10:00Z",
  version: 1,
  last_change_id: "c0000000-0000-4000-8000-000000000002",
  ...extra,
});

beforeAll(async () => {
  pg = await createTrainingTestDb();
  await upsertAs(pg, OWNER_A, "training_sessions", sessionRow());
  await upsertAs(pg, OWNER_A, "training_sets", setRow());
});

describe("RLS en scheiding van gebruikers", () => {
  it("eigenaar ziet de eigen rijen", async () => {
    const rows = await runAs(pg, OWNER_A, "select id from public.training_sets");
    expect(rows).toHaveLength(1);
  });

  it("andere owner ziet niets en kan niets wijzigen", async () => {
    expect(await runAs(pg, OWNER_B, "select id from public.training_sets")).toHaveLength(0);
    expect(await runAs(pg, OWNER_B, "select id from public.training_sessions")).toHaveLength(0);
    await expect(
      upsertAs(pg, OWNER_B, "training_sets", setRow({ user_id: OWNER_B, weight_kg: 999, version: 2, last_change_id: "c0000000-0000-4000-8000-0000000000ff" })),
    ).rejects.toThrow();
    const [row] = await runAs<{ weight_kg: string }>(pg, OWNER_A, "select weight_kg from public.training_sets");
    expect(Number(row.weight_kg)).toBe(40);
  });

  it("kan geen rij voor een andere gebruiker aanmaken", async () => {
    await expect(
      upsertAs(pg, OWNER_B, "training_sessions", sessionRow({ id: "33333333-3333-4333-8333-333333333333", user_id: OWNER_A })),
    ).rejects.toThrow(/row-level security/);
  });

  it("anoniem en niet-owners hebben geen toegang", async () => {
    await expect(runAs(pg, null, "select id from public.training_sets")).rejects.toThrow(/permission denied/);
    expect(await runAs(pg, R6_PLAYER, "select id from public.training_sessions")).toHaveLength(0);
    await expect(
      upsertAs(pg, R6_PLAYER, "training_sessions", sessionRow({ id: "44444444-4444-4444-8444-444444444444", user_id: R6_PLAYER })),
    ).rejects.toThrow(/row-level security/);
  });

  it("hard verwijderen kan niet", async () => {
    await expect(runAs(pg, OWNER_A, "delete from public.training_sets")).rejects.toThrow(/permission denied/);
  });
});

describe("versiecontrole en idempotentie", () => {
  it("herhaalde push van dezelfde wijziging is een no-op", async () => {
    const again = await upsertAs(pg, OWNER_A, "training_sets", setRow({ weight_kg: 50 }));
    expect(Number(again!.weight_kg)).toBe(40);
    expect(again!.version).toBe(1);
    const count = await runAs(pg, OWNER_A, "select id from public.training_sets");
    expect(count).toHaveLength(1);
  });

  it("geldige volgende versie wordt geaccepteerd", async () => {
    const next = await upsertAs(pg, OWNER_A, "training_sets", setRow({ reps: 9, version: 2, last_change_id: "c0000000-0000-4000-8000-000000000003" }));
    expect(next!.version).toBe(2);
    expect(next!.reps).toBe(9);
  });

  it("verouderde basisversie geeft een expliciet conflict", async () => {
    await expect(
      upsertAs(pg, OWNER_A, "training_sets", setRow({ reps: 1, version: 2, last_change_id: "c0000000-0000-4000-8000-000000000004" })),
    ).rejects.toMatchObject({ code: "TRC01" });
  });

  it("user_id en created_at kunnen niet worden gewijzigd", async () => {
    const row = await upsertAs(
      pg,
      OWNER_A,
      "training_sessions",
      sessionRow({ created_at: "2000-01-01T00:00:00Z", version: 2, last_change_id: "c0000000-0000-4000-8000-000000000005" }),
    );
    expect(String(row!.created_at)).not.toContain("2000");
  });
});

describe("validatie in de database", () => {
  const bad = (extra: Record<string, unknown>) =>
    upsertAs(pg, OWNER_A, "training_sets", setRow({ id: crypto.randomUUID(), set_index: 5, last_change_id: crypto.randomUUID(), ...extra }));

  it("weigert negatieve of onmogelijke waarden", async () => {
    await expect(bad({ reps: -1 })).rejects.toMatchObject({ code: "23514" });
    await expect(bad({ weight_kg: 1000 })).rejects.toThrow();
    await expect(bad({ reps: 2.5 })).rejects.toThrow();
    await expect(bad({ kind: "drop" })).rejects.toMatchObject({ code: "23514" });
    await expect(bad({ reps: null, duration_s: null })).rejects.toMatchObject({ code: "23514" });
  });

  it("slaat gewichten exact op als numeric", async () => {
    const row = await bad({ set_index: 6, weight_kg: 42.25 });
    expect(Number(row!.weight_kg)).toBe(42.25);
  });

  it("maximaal één set per positie (geen dubbele sets)", async () => {
    await expect(bad({ set_index: 0 })).rejects.toMatchObject({ code: "23505" });
  });

  it("set kan alleen bij een eigen sessie", async () => {
    await expect(
      upsertAs(pg, OWNER_B, "training_sets", setRow({ id: crypto.randomUUID(), user_id: OWNER_B, set_index: 9, last_change_id: crypto.randomUUID() })),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("één profiel per gebruiker (id = user_id)", async () => {
    await expect(
      upsertAs(pg, OWNER_A, "training_profiles", { id: crypto.randomUUID(), user_id: OWNER_A, settings: {}, equipment: {}, exercise_prefs: {}, version: 1 }),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
