import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  OWNER_A,
  R6_PLAYER,
  TRAINING_USER,
  createTrainingTestDb,
  runAs,
} from "./harness";

// De echte feedbackmigratie in PGlite: wie mag toevoegen, lezen en
// afhandelen.

let pg: PGlite;

beforeAll(async () => {
  pg = await createTrainingTestDb();
});

const insert = (
  user: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string }[]> => {
  const row = {
    id: crypto.randomUUID(),
    kind: "fout",
    message: "Knop doet niks",
    page_path: "/training/workout",
    page_label: "Training",
    context: { viewport: "390x844" },
    ...extra,
  };
  const cols = Object.keys(row);
  return runAs(
    pg,
    user,
    `insert into public.training_feedback (${cols.join(", ")})
       select ${cols.join(", ")} from jsonb_populate_record(null::public.training_feedback, $1::jsonb)
     returning id`,
    [JSON.stringify(row)],
  );
};

describe("training_feedback", () => {
  it("training_user stuurt feedback, user_id volgt uit de sessie", async () => {
    const [row] = await insert(TRAINING_USER);
    const [stored] = await runAs<{ user_id: string }>(
      pg,
      TRAINING_USER,
      "select user_id from public.training_feedback where id = $1",
      [row.id],
    );
    expect(stored.user_id).toBe(TRAINING_USER);
  });

  it("hetzelfde id twee keer geeft een unique-fout (wachtrij = al verstuurd)", async () => {
    const id = crypto.randomUUID();
    await insert(TRAINING_USER, { id });
    await expect(insert(TRAINING_USER, { id })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("geen feedback op naam van een ander, al afgehandeld of zonder Training", async () => {
    await expect(insert(TRAINING_USER, { user_id: OWNER_A })).rejects.toThrow(
      /row-level security/,
    );
    await expect(
      insert(TRAINING_USER, { resolved_at: new Date().toISOString() }),
    ).rejects.toThrow(/row-level security/);
    await expect(insert(R6_PLAYER)).rejects.toThrow(/row-level security/);
  });

  it("lege of te lange berichten en onbekende soorten worden geweigerd", async () => {
    await expect(
      insert(TRAINING_USER, { message: "   " }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      insert(TRAINING_USER, { message: "x".repeat(4001) }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(insert(TRAINING_USER, { kind: "spam" })).rejects.toMatchObject(
      { code: "23514" },
    );
  });

  it("training_user ziet alleen eigen feedback en kan niets afhandelen", async () => {
    const [ownerRow] = await insert(OWNER_A, { message: "Van de owner" });
    const seen = await runAs<{ user_id: string }>(
      pg,
      TRAINING_USER,
      "select user_id from public.training_feedback",
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((r) => r.user_id === TRAINING_USER)).toBe(true);

    const [own] = await insert(TRAINING_USER);
    const updated = await runAs(
      pg,
      TRAINING_USER,
      "update public.training_feedback set resolved_at = now() where id = $1 returning id",
      [own.id],
    );
    expect(updated).toHaveLength(0);
    const deleted = await runAs(
      pg,
      TRAINING_USER,
      "delete from public.training_feedback where id = $1 returning id",
      [ownerRow.id],
    );
    expect(deleted).toHaveLength(0);
  });

  it("owner ziet alles, handelt af en verwijdert", async () => {
    const [row] = await insert(TRAINING_USER, { message: "Voor de owner" });
    const all = await runAs<{ id: string }>(
      pg,
      OWNER_A,
      "select id from public.training_feedback",
    );
    expect(all.map((r) => r.id)).toContain(row.id);
    expect(
      await runAs(
        pg,
        OWNER_A,
        "update public.training_feedback set resolved_at = now() where id = $1 returning id",
        [row.id],
      ),
    ).toHaveLength(1);
    expect(
      await runAs(
        pg,
        OWNER_A,
        "delete from public.training_feedback where id = $1 returning id",
        [row.id],
      ),
    ).toHaveLength(1);
  });

  it("anon kan niets", async () => {
    await expect(
      runAs(pg, null, "select id from public.training_feedback"),
    ).rejects.toThrow(/permission denied/);
  });
});
