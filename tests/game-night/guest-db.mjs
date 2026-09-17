import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real Game Night migrations, with just the surrounding Supabase services
// stubbed. All SQL below runs in local PostgreSQL/WASM, never production.
export async function createGuestTestDb({ playerSelection = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema storage;
    grant usage on schema public, auth, private to anon, authenticated;
    create table auth.users (id uuid primary key);
    create table public.profiles (id uuid primary key, app_role text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function private.is_owner() returns boolean language sql stable security definer as
      $$ select exists(select 1 from public.profiles where id = auth.uid() and app_role = 'owner') $$;
    create function private.is_game_night_member_or_owner() returns boolean language sql stable security definer as
      $$ select exists(select 1 from public.profiles where id = auth.uid() and app_role in ('owner','game_night_member')) $$;
    create function private.storage_first_segment_uuid(text) returns uuid language sql as $$ select null::uuid $$;
    create function public.set_updated_at() returns trigger language plpgsql as
      $$ begin new.updated_at = now(); return new; end $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid, bucket_id text, name text);
    create publication supabase_realtime;
  `);
  const migrations = [
    "20260911000000_game_night_games.sql",
    "20260912000000_game_night_players.sql",
    "20260912010000_game_night_sessions_and_attendance.sql",
    "20260912020000_game_night_games_result_config.sql",
    "20260912030000_game_night_game_sessions.sql",
    "20260912130000_game_night_identity_foundations.sql",
    "20260912170000_game_night_party_model.sql",
    "20260912180000_game_night_join_tokens.sql",
    "20260914000000_game_night_character_parts.sql",
    "20260914010000_game_night_character_equipment.sql",
    "20260915000000_game_night_character_v2_slots.sql",
    "20260918000000_game_night_player_face.sql",
    "20260919000000_game_night_join_token_rpc_security_definer_fix.sql",
    "20260921000000_game_night_character_custom_base_bodies.sql",
    "20260923000000_game_night_character_manbody_canonical_rename.sql",
    "20260926000000_game_night_guests.sql",
    ...(playerSelection
      ? [
          "20260927000000_game_night_player_selection.sql",
          "20260928000000_game_night_guest_faces.sql",
        ]
      : []),
  ];
  for (const migration of migrations) {
    try {
      await db.exec(
        await readFile(
          new URL(`../../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      throw new Error(`Migration ${migration}: ${error.message}`);
    }
  }
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into public.game_night_sessions(id, name) values
      ('10000000-0000-0000-0000-000000000001', 'Vrijdag met vrienden'),
      ('10000000-0000-0000-0000-000000000002', 'Andere avond');
    insert into public.game_night_join_tokens(game_night_session_id, token, expires_at) values
      ('10000000-0000-0000-0000-000000000001', 'invite-one', now() + interval '12 hours'),
      ('10000000-0000-0000-0000-000000000002', 'invite-two', now() + interval '12 hours');
    insert into public.game_night_color_palette(hex,label) values ('#dd8855','Oranje'), ('#5588dd','Blauw');
  `);
  return db;
}

export const SESSION = "10000000-0000-0000-0000-000000000001";
export const OTHER_SESSION = "10000000-0000-0000-0000-000000000002";
export const TOKEN_A = "a".repeat(64);
export const TOKEN_B = "b".repeat(64);

const FUNCTIONS = new Set([
  "game_night_guest_options",
  "game_night_guest_players",
  "game_night_choose_guest_player",
  "game_night_guest_state",
  "game_night_join_as_guest",
  "game_night_update_guest",
  "game_night_guest_face_access",
  "game_night_update_guest_face",
  "game_night_generate_join_token",
  "game_night_add_to_party",
  "game_night_remove_from_party",
]);

export async function rpc(db, name, args = {}, role = "anon") {
  if (!FUNCTIONS.has(name) || !["anon", "authenticated"].includes(role))
    throw new Error("Unknown test RPC");
  const names = Object.keys(args);
  if (names.some((key) => !/^p_[a-z_]+$/.test(key)))
    throw new Error("Unknown argument");
  await db.exec(`set role ${role}`);
  try {
    const { rows } = await db.query(
      `select to_jsonb(public.${name}(${names.map((key, index) => `${key} => $${index + 1}`).join(", ")})) as result`,
      Object.values(args),
    );
    return rows[0].result;
  } finally {
    // An expected error inside an enclosing test transaction aborts it;
    // preserve that original error. The test's ROLLBACK restores the role.
    await db.exec("reset role").catch((error) => {
      if (error.code !== "25P02") throw error;
    });
  }
}
