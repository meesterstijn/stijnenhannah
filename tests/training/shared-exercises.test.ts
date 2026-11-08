import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  OWNER_A,
  OWNER_B,
  R6_PLAYER,
  TRAINING_USER,
  createTrainingTestDb,
  runAs,
  upsertAs,
} from "./harness";

// Eigen oefeningen blijven privé tot de owner ze goedkeurt.

let pg: PGlite;

const exercise = (user: string, name: string) => ({
  id: crypto.randomUUID(),
  user_id: user,
  name,
  data: { tracking: "weight_reps", loadMode: "none", primary: ["chest"] },
  version: 1,
  last_change_id: crypto.randomUUID(),
});

type Submission = {
  id: string;
  email: string | null;
  name: string;
  status: string | null;
  shared_name: string | null;
};

const submissions = () =>
  runAs<Submission>(
    pg,
    OWNER_A,
    "select * from public.training_exercise_submissions()",
  );
const sharedNames = (user: string) =>
  runAs<{ name: string }>(
    pg,
    user,
    "select name from public.training_shared_exercises order by name",
  ).then((rows) => rows.map((r) => r.name));
const review = (user: string, id: string, approve: boolean, name?: string) =>
  runAs(pg, user, "select public.training_review_exercise($1, $2, $3)", [
    id,
    approve,
    name ?? null,
  ]);

beforeAll(async () => {
  pg = await createTrainingTestDb();
  await pg.query(
    "update auth.users set email = 'tester@example.com' where id = $1",
    [TRAINING_USER],
  );
});

describe("gedeelde oefeningen", () => {
  it("een eigen oefening blijft privé, ook voor de owner via de tabel", async () => {
    const row = exercise(TRAINING_USER, "Leg press");
    await upsertAs(pg, TRAINING_USER, "training_exercises", row);
    expect(
      await runAs(
        pg,
        OWNER_A,
        "select id from public.training_exercises where id = $1",
        [row.id],
      ),
    ).toHaveLength(0);
    expect(await sharedNames(OWNER_B)).toEqual([]);
  });

  it("owner ziet ingediende oefeningen van anderen, niet de eigen", async () => {
    await upsertAs(
      pg,
      OWNER_A,
      "training_exercises",
      exercise(OWNER_A, "Eigen van owner"),
    );
    const list = await submissions();
    const names = list.map((s) => s.name);
    expect(names).toContain("Leg press");
    expect(names).not.toContain("Eigen van owner");
    const leg = list.find((s) => s.name === "Leg press")!;
    expect(leg).toMatchObject({ email: "tester@example.com", status: null });
  });

  it("alleen de owner kan beoordelen en indieningen zien", async () => {
    const [leg] = (await submissions()).filter((s) => s.name === "Leg press");
    for (const user of [TRAINING_USER, R6_PLAYER]) {
      await expect(review(user, leg.id, true)).rejects.toThrow(/Alleen owner/);
      await expect(
        runAs(pg, user, "select * from public.training_exercise_submissions()"),
      ).rejects.toThrow(/Alleen owner/);
    }
    await expect(
      runAs(
        pg,
        TRAINING_USER,
        "insert into public.training_shared_exercises (id, name, status) values ($1, 'x', 'approved')",
        [crypto.randomUUID()],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("goedkeuren maakt hem zichtbaar voor iedereen met Training, met nieuwe naam", async () => {
    const [leg] = (await submissions()).filter((s) => s.name === "Leg press");
    await review(OWNER_A, leg.id, true, "  Leg press (machine) ");
    expect(await sharedNames(OWNER_B)).toEqual(["Leg press (machine)"]);
    expect(await sharedNames(TRAINING_USER)).toEqual(["Leg press (machine)"]);
    expect(await sharedNames(R6_PLAYER)).toEqual([]);
    const [after] = (await submissions()).filter((s) => s.id === leg.id);
    expect(after).toMatchObject({
      status: "approved",
      shared_name: "Leg press (machine)",
    });
  });

  it("afwijzen of intrekken verbergt hem weer, de owner ziet hem nog", async () => {
    const [leg] = (await submissions()).filter((s) => s.name === "Leg press");
    await review(OWNER_A, leg.id, false);
    expect(await sharedNames(TRAINING_USER)).toEqual([]);
    expect(await sharedNames(OWNER_A)).toEqual(["Leg press (machine)"]);
  });

  it("intrekken werkt ook als de maker de oefening verwijderde", async () => {
    const row = exercise(TRAINING_USER, "Kabel row");
    await upsertAs(pg, TRAINING_USER, "training_exercises", row);
    await review(OWNER_A, row.id, true);
    await upsertAs(pg, TRAINING_USER, "training_exercises", {
      ...row,
      deleted_at: new Date().toISOString(),
      version: 2,
      last_change_id: crypto.randomUUID(),
    });
    await review(OWNER_A, row.id, false);
    expect(await sharedNames(TRAINING_USER)).not.toContain("Kabel row");
    await expect(review(OWNER_A, row.id, true)).rejects.toThrow(/bestaat niet/);
  });
});
