import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Lokale PostgreSQL (PGlite/WASM) met de echte Schietsport-migratie en
// alleen de omliggende Supabase-onderdelen gestubd. Nooit productie.

// Alle Schietsport-migraties, in volgorde.
const SCHIETSPORT_MIGRATIONS = [
  "20261029000000_schietsport.sql",
  "20261029010000_schietsport_competition_rules.sql",
];

export const OWNER_A = "a0000000-0000-4000-8000-00000000000a";
export const OWNER_B = "b0000000-0000-4000-8000-00000000000b";
export const R6_PLAYER = "c0000000-0000-4000-8000-00000000000c";

export async function createSchietsportTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    grant usage on schema public, auth, private, storage to anon, authenticated;
    create table auth.users (id uuid primary key);
    create table public.profiles (id uuid primary key, app_role text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function private.current_app_role() returns text language sql stable
      security definer set search_path = '' as
      $$ select app_role from public.profiles where id = auth.uid() $$;
    create function private.storage_first_segment_uuid(path text) returns uuid
      language plpgsql stable as
      $$ begin return split_part(path, '/', 1)::uuid; exception when others then return null; end $$;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values ('${OWNER_A}'), ('${OWNER_B}'), ('${R6_PLAYER}');
    insert into public.profiles values
      ('${OWNER_A}', 'owner'), ('${OWNER_B}', 'owner'), ('${R6_PLAYER}', 'r6_player');
  `);
  for (const file of SCHIETSPORT_MIGRATIONS) {
    await db.exec(
      await readFile(
        new URL(`../../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  return db;
}

// Voert een query uit als ingelogde gebruiker (of anoniem bij null).
// Queries zijn per test serieel, dus de rol/claim-wissel is veilig.
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
