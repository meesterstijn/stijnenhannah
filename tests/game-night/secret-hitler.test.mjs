import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createGuestTestDb,
  rpc,
  SESSION,
  TOKEN_A,
  TOKEN_B,
} from "./guest-db.mjs";

// Secret Hitler-migratie tegen een lokale PGlite-database (nooit productie).
const db = await createGuestTestDb();
const OWNER = "20000000-0000-0000-0000-000000000001";
const GAME = "9a000000-0000-4000-8000-000000000003";
const GAME_SESSION = "30000000-0000-0000-0000-000000000001";

async function migrate(file) {
  await db.exec(
    await readFile(
      new URL(`../../supabase/migrations/${file}`, import.meta.url),
      "utf8",
    ),
  );
}

await db.exec(
  `alter table public.game_night_games add column if not exists slug text unique;`,
);
await migrate("20260912120000_game_night_win_events.sql");
await migrate("20261112000000_game_night_secret_hitler.sql");
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to authenticated;
  insert into public.profiles values ('${OWNER}', 'owner');
  insert into public.game_night_games (id, name, slug, min_players, max_players)
    values ('${GAME}', 'Secret Hitler', 'secret-hitler', 5, 10),
           ('9a000000-0000-4000-8000-000000000001', 'Catan', 'catan', 3, 4);
`);

async function asOwner(sql, params = []) {
  await db.exec("begin");
  try {
    await db.exec(
      `set local role authenticated; set local request.jwt.claim.sub = '${OWNER}';`,
    );
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function guest(name, args) {
  const keys = Object.keys(args);
  await db.exec("set role anon");
  try {
    const { rows } = await db.query(
      `select to_jsonb(public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})) as result`,
      Object.values(args),
    );
    return rows[0].result;
  } finally {
    await db.exec("reset role");
  }
}

// Twee gasten aan tafel.
const options = await rpc(db, "game_night_guest_options", {
  p_join_token: "invite-one",
});
const join = (token, name) =>
  rpc(db, "game_night_join_as_guest", {
    p_join_token: "invite-one",
    p_guest_token: token,
    p_name: name,
    p_guest_face: "fox",
    p_base_part_id: options.bodies[0].id,
    p_color_id: options.palette[0].id,
  });
const alex = (await join(TOKEN_A, "Alex")).player_id;
const bo = (await join(TOKEN_B, "Bo")).player_id;

const cases = [];
const test = (name, run) => cases.push({ name, run });

test("telefoon ziet niets zolang er geen Secret Hitler loopt", async () => {
  const res = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
  });
  assert.deepEqual(res, { active: false });
});

test("host legt events vast en kan de laatste ongedaan maken", async () => {
  await db.exec(`
    insert into public.game_night_game_sessions (id, game_night_session_id, game_id, status, win_source)
      values ('${GAME_SESSION}', '${SESSION}', '${GAME}', 'active', 'win_events');
    insert into public.game_night_game_session_players (game_session_id, player_id, seat_order)
      values ('${GAME_SESSION}', '${alex}', 0), ('${GAME_SESSION}', '${bo}', 1);
  `);
  await asOwner(
    "select public.game_night_secret_hitler_record($1, $2::jsonb)",
    [GAME_SESSION, JSON.stringify({ type: "start", firstPresidentId: alex })],
  );
  await asOwner(
    "select public.game_night_secret_hitler_record($1, $2::jsonb)",
    [GAME_SESSION, JSON.stringify({ type: "nominate", chancellorId: bo })],
  );
  await asOwner("select public.game_night_secret_hitler_undo_last($1)", [
    GAME_SESSION,
  ]);
  const rows = await asOwner(
    "select event_type, undone_at is not null as undone from public.game_night_secret_hitler_events order by created_at",
  );
  assert.deepEqual(rows, [
    { event_type: "start", undone: false },
    { event_type: "nominate", undone: true },
  ]);
  await assert.rejects(
    asOwner("select public.game_night_secret_hitler_record($1, $2::jsonb)", [
      GAME_SESSION,
      JSON.stringify({ type: "hack" }),
    ]),
  );
});

test("anon kan geen events schrijven", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(
      db.query("select public.game_night_secret_hitler_record($1, $2::jsonb)", [
        GAME_SESSION,
        JSON.stringify({ type: "quote", playerId: null, text: "hoi" }),
      ]),
    );
  } finally {
    await db.exec("reset role");
  }
});

test("telefoon kijkt mee en verdenkt in het geheim", async () => {
  const state = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
  });
  assert.equal(state.active, true);
  assert.deepEqual(state.seats, [alex, bo]);
  assert.equal(state.events.length, 1);
  assert.equal(state.my_suspect, null);
  assert.deepEqual(state.suspicions, []);

  await guest("game_night_guest_secret_hitler_suspect", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
    p_suspect_id: bo,
  });
  await assert.rejects(
    guest("game_night_guest_secret_hitler_suspect", {
      p_guest_token: TOKEN_A,
      p_session_id: SESSION,
      p_suspect_id: alex,
    }),
  );
  const again = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
  });
  assert.equal(again.my_suspect, bo);
  // Andermans verdenking blijft geheim tot de onthulling.
  const other = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_B,
    p_session_id: SESSION,
  });
  assert.equal(other.my_suspect, null);
  assert.deepEqual(other.suspicions, []);
});

test("na de onthulling liggen verdenkingen vast en zijn ze zichtbaar", async () => {
  await asOwner(
    "select public.game_night_secret_hitler_record($1, $2::jsonb)",
    [
      GAME_SESSION,
      JSON.stringify({
        type: "reveal",
        roles: { [alex]: "liberal", [bo]: "hitler" },
      }),
    ],
  );
  await assert.rejects(
    guest("game_night_guest_secret_hitler_suspect", {
      p_guest_token: TOKEN_B,
      p_session_id: SESSION,
      p_suspect_id: alex,
    }),
  );
  const state = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_B,
    p_session_id: SESSION,
  });
  assert.deepEqual(state.suspicions, [
    { voter_player_id: alex, suspect_player_id: bo },
  ]);
});

test("afronden geeft WINs aan het winnende team en sluit af", async () => {
  await assert.rejects(
    asOwner("select public.game_night_secret_hitler_finish($1, $2::uuid[])", [
      GAME_SESSION,
      [OWNER],
    ]),
  );
  await asOwner(
    "select public.game_night_secret_hitler_finish($1, $2::uuid[])",
    [GAME_SESSION, [bo]],
  );
  const wins = await asOwner(
    "select player_id from public.game_night_win_events where game_session_id = $1",
    [GAME_SESSION],
  );
  assert.deepEqual(wins, [{ player_id: bo }]);
  const [session] = await asOwner(
    "select status from public.game_night_game_sessions where id = $1",
    [GAME_SESSION],
  );
  assert.equal(session.status, "completed");
  // Idempotent: nogmaals afronden geeft geen dubbele WIN.
  await asOwner(
    "select public.game_night_secret_hitler_finish($1, $2::uuid[])",
    [GAME_SESSION, [bo]],
  );
  const after = await asOwner(
    "select count(*)::int as n from public.game_night_win_events where game_session_id = $1",
    [GAME_SESSION],
  );
  assert.equal(after[0].n, 1);
  await assert.rejects(
    asOwner("select public.game_night_secret_hitler_record($1, $2::jsonb)", [
      GAME_SESSION,
      JSON.stringify({ type: "quote", playerId: null, text: "te laat" }),
    ]),
  );
});

test("een ander spel accepteert geen Secret Hitler-events", async () => {
  await db.exec(`
    insert into public.game_night_game_sessions (id, game_night_session_id, game_id, status, win_source)
      values ('30000000-0000-0000-0000-000000000002', '${SESSION}', '9a000000-0000-4000-8000-000000000001', 'active', 'win_events');
  `);
  await assert.rejects(
    asOwner("select public.game_night_secret_hitler_record($1, $2::jsonb)", [
      "30000000-0000-0000-0000-000000000002",
      JSON.stringify({ type: "quote", playerId: null, text: "x" }),
    ]),
  );
  const state = await guest("game_night_guest_secret_hitler", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
  });
  assert.deepEqual(state, { active: false });
});

try {
  for (const check of cases) {
    await check.run();
    console.log(`PASS ${check.name}`);
  }
  console.log(`${cases.length} Secret Hitler database checks passed.`);
} finally {
  await db.close();
}
