import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { EntityName } from "@/features/training/db/database";
import { TABLES } from "@/features/training/db/mapping";
import {
  SyncError,
  classifyError,
  type SyncTransport,
} from "@/features/training/sync/transport";

// Lokale PostgreSQL (PGlite/WASM) met de echte trainingsmigratie; alleen de
// omliggende Supabase-onderdelen zijn gestubd. Nooit productie.

export const OWNER_A = "a0000000-0000-4000-8000-00000000000a";
export const OWNER_B = "b0000000-0000-4000-8000-00000000000b";
export const R6_PLAYER = "c0000000-0000-4000-8000-00000000000c";
export const TRAINING_USER = "d0000000-0000-4000-8000-00000000000d";

const MIGRATIONS = [
  "20261029020000_training.sql",
  "20261107000000_training_user_role.sql",
  "20261108000000_training_feedback.sql",
  "20261108010000_training_shared_exercises.sql",
];

export async function createTrainingTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    grant usage on schema public, auth, private to anon, authenticated;
    create table auth.users (id uuid primary key, email text);
    create table public.profiles (
      id uuid primary key, app_role text,
      constraint profiles_app_role_check check (app_role in ('owner', 'r6_player'))
    );
    grant select on public.profiles to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function private.current_app_role() returns text language sql stable
      security definer set search_path = '' as
      $$ select app_role from public.profiles where id = auth.uid() $$;
    create function private.is_owner() returns boolean language sql stable
      security definer set search_path = '' as
      $$ select private.current_app_role() = 'owner' $$;
    insert into auth.users values
      ('${OWNER_A}'), ('${OWNER_B}'), ('${R6_PLAYER}'), ('${TRAINING_USER}');
    insert into public.profiles values
      ('${OWNER_A}', 'owner'), ('${OWNER_B}', 'owner'), ('${R6_PLAYER}', 'r6_player');
  `);
  for (const file of MIGRATIONS) {
    await db.exec(
      await readFile(
        new URL(`../../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  // Nieuw account begint als no_access (zoals handle_new_user); de rol wordt
  // daarna door een owner toegekend via de echte set_profile_role.
  await db.query(
    `insert into public.profiles values ($1, 'no_access') on conflict do nothing`,
    [TRAINING_USER],
  );
  await runAs(
    db,
    OWNER_A,
    `select public.set_profile_role($1, 'training_user')`,
    [TRAINING_USER],
  );
  return db;
}

export async function runAs<T = Record<string, unknown>>(
  db: PGlite,
  user: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user ?? "",
  ]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

// Doet wat PostgREST doet bij .upsert(row, { onConflict: "id" }).select().
export async function upsertAs(
  db: PGlite,
  user: string | null,
  table: string,
  row: Record<string, unknown>,
) {
  const all = Object.keys(row);
  const columns = all.filter((c) => c !== "id");
  const rows = await runAs<{ r: Record<string, unknown> }>(
    db,
    user,
    `insert into public.${table} as t (${all.join(", ")})
       select ${all.join(", ")} from jsonb_populate_record(null::public.${table}, $1::jsonb)
     on conflict (id) do update set ${columns.map((c) => `${c} = excluded.${c}`).join(", ")}
     returning to_jsonb(t.*) as r`,
    [JSON.stringify(row)],
  );
  return rows[0]?.r;
}

// Sync-transport dat rechtstreeks op PGlite werkt, als de ingelogde gebruiker.
export class PgliteTransport implements SyncTransport {
  offline = false;
  loseNextPushResponse = false;
  pushes = 0;
  constructor(
    private pg: PGlite,
    private user: string,
  ) {}

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    if (this.offline) throw new SyncError("network", "offline");
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SyncError) throw error;
      const e = error as { code?: string; message?: string };
      throw classifyError({ code: e.code, message: e.message, status: 400 });
    }
  }

  async push(entity: EntityName, row: Record<string, unknown>) {
    const result = await this.guard(() =>
      upsertAs(this.pg, this.user, TABLES[entity], row),
    );
    this.pushes++;
    if (this.loseNextPushResponse) {
      this.loseNextPushResponse = false;
      throw new SyncError("network", "antwoord kwijt");
    }
    return result!;
  }

  fetch(entity: EntityName, id: string) {
    return this.guard(async () => {
      const rows = await runAs<{ r: Record<string, unknown> }>(
        this.pg,
        this.user,
        `select to_jsonb(t.*) as r from public.${TABLES[entity]} t where id = $1`,
        [id],
      );
      return rows[0]?.r ?? null;
    });
  }

  pull(
    entity: EntityName,
    since: string | null,
    limit: number,
    inclusive: boolean,
  ) {
    return this.guard(async () => {
      const op = inclusive ? ">=" : ">";
      const rows = await runAs<{ r: Record<string, unknown> }>(
        this.pg,
        this.user,
        `select to_jsonb(t.*) as r from public.${TABLES[entity]} t
          where ($1::timestamptz is null or changed_at ${op} $1::timestamptz)
          order by changed_at limit $2`,
        [since, limit],
      );
      return rows.map((r) => r.r);
    });
  }
}
