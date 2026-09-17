import assert from "node:assert/strict";
import {
  createGuestTestDb,
  rpc,
  SESSION,
  OTHER_SESSION,
  TOKEN_A,
  TOKEN_B,
} from "./guest-db.mjs";

let db;
let first;
const cases = [];
const test = (name, run) => cases.push({ name, run });
const join = (token, extra = {}) =>
  rpc(db, "game_night_join_as_guest", {
    p_join_token: "invite-one",
    p_guest_token: token,
    p_name: "Sam",
    ...extra,
  });
const state = (token, session = SESSION) =>
  rpc(db, "game_night_guest_state", {
    p_guest_token: token,
    p_session_id: session,
  });

test("an invitation is required; invalid submissions create no player", async () => {
  assert.equal(
    (await rpc(db, "game_night_guest_options", { p_join_token: "wrong" }))
      .valid,
    false,
  );
  for (const extra of [
    { p_join_token: "wrong" },
    { p_guest_token: "guess" },
    { p_name: " " },
    { p_guest_face: "<script>" },
    { p_name: "x".repeat(41) },
  ]) {
    await assert.rejects(join(TOKEN_A, extra));
  }
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    0,
  );
});

test("joining stores a hash and avatar without creating an Auth account", async () => {
  const options = await rpc(db, "game_night_guest_options", {
    p_join_token: "invite-one",
  });
  first = await join(TOKEN_A, {
    p_base_part_id: options.bodies[0].id,
    p_color_id: options.palette[0].id,
    p_guest_face: "fox",
  });
  const view = await state(TOKEN_A);
  assert.equal(view.me.guest_face, "fox");
  assert.ok(view.me.body);
  assert.equal(view.players.length, 1);
  assert.equal(view.me.id, first.player_id);
  assert.equal(
    (await db.query("select count(*)::int as n from auth.users")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.profiles")).rows[0]
      .n,
    0,
  );
  const stored = (
    await db.query("select token_hash from private.game_night_guests")
  ).rows[0].token_hash;
  assert.notEqual(stored, TOKEN_A);
  assert.match(stored, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(view).includes(TOKEN_A), false);
  assert.equal(JSON.stringify(view).includes("auth_user_id"), false);
});

test("retry, refresh and separate phones preserve independent identities", async () => {
  assert.deepEqual(await join(TOKEN_A), first);
  const second = await join(TOKEN_B, { p_name: "Sam" });
  assert.notEqual(second.player_id, first.player_id);
  assert.equal((await state(TOKEN_A)).players.length, 2);
  assert.equal(
    (
      await db.query(
        "select count(distinct seat_index)::int as n from public.game_night_session_players",
      )
    ).rows[0].n,
    2,
  );
  assert.equal((await state(TOKEN_A)).me.guest_face, "fox");
});

test("a guest can only read their night and update their own allowed fields", async () => {
  assert.equal((await state(TOKEN_A, OTHER_SESSION)).valid, false);
  assert.equal((await state("c".repeat(64))).valid, false);
  await assert.rejects(
    rpc(db, "game_night_update_guest", {
      p_guest_token: TOKEN_A,
      p_session_id: OTHER_SESSION,
      p_name: "Hacked",
    }),
  );
  await rpc(db, "game_night_update_guest", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
    p_name: "Alex",
    p_guest_face: "robot",
  });
  assert.equal((await state(TOKEN_A)).me.name, "Alex");
  assert.equal((await state(TOKEN_B)).me.name, "Sam");
  await assert.rejects(
    rpc(db, "game_night_generate_join_token", {
      p_game_night_session_id: SESSION,
    }),
  );
  await assert.rejects(
    rpc(
      db,
      "game_night_generate_join_token",
      { p_game_night_session_id: SESSION },
      "authenticated",
    ),
  );
  await assert.rejects(
    rpc(
      db,
      "game_night_remove_from_party",
      { p_session_id: SESSION, p_player_id: first.player_id },
      "authenticated",
    ),
  );
  await db.exec("set role anon");
  try {
    await assert.rejects(db.query("select * from private.game_night_guests"));
    await assert.rejects(db.query("select * from public.game_night_players"));
    await assert.rejects(
      db.query("select private.game_night_guest_player($1)", [TOKEN_A]),
    );
  } finally {
    await db.exec("reset role");
  }
});

test("premium, inactive and wrong-slot avatar parts are rejected atomically", async () => {
  for (const [slot, active, starter] of [
    ["base", true, false],
    ["base", false, true],
    ["hair", true, true],
  ]) {
    const part = (
      await db.query(
        "insert into public.game_night_character_parts(key,slot,label,asset_path,layer_order,active,is_starter) values (gen_random_uuid()::text,$1,'Hidden','/hidden',20,$2,$3) returning id",
        [slot, active, starter],
      )
    ).rows[0].id;
    await assert.rejects(
      rpc(db, "game_night_update_guest", {
        p_guest_token: TOKEN_A,
        p_session_id: SESSION,
        p_name: "Changed",
        p_base_part_id: part,
      }),
    );
    assert.equal((await state(TOKEN_A)).me.name, "Alex");
  }
});

test("the authenticated owner can still manage invitations and seats", async () => {
  await db.exec(`begin;
    insert into auth.users(id) values ('20000000-0000-0000-0000-000000000001');
    insert into public.profiles values ('20000000-0000-0000-0000-000000000001', 'owner');
    set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';`);
  try {
    const invite = await rpc(
      db,
      "game_night_generate_join_token",
      { p_game_night_session_id: OTHER_SESSION },
      "authenticated",
    );
    assert.match(invite.token, /^[0-9a-f]{64}$/);
    await rpc(
      db,
      "game_night_remove_from_party",
      { p_session_id: SESSION, p_player_id: first.player_id },
      "authenticated",
    );
    assert.equal((await state(TOKEN_A)).at_table, false);
    await rpc(
      db,
      "game_night_add_to_party",
      { p_session_id: SESSION, p_player_id: first.player_id },
      "authenticated",
    );
    assert.equal((await state(TOKEN_A)).at_table, true);
  } finally {
    await db.exec("rollback");
  }
});

test("a running game blocks new joins but allows existing guests to reconnect", async () => {
  const game = (
    await db.query(
      "insert into public.game_night_games(name) values ('Mario Kart') returning id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.game_night_game_sessions(game_night_session_id,game_id) values ($1,$2)",
    [SESSION, game],
  );
  assert.equal((await state(TOKEN_A)).game.name, "Mario Kart");
  assert.deepEqual(await join(TOKEN_A), first);
  await assert.rejects(join("c".repeat(64)), /Er wordt nu gespeeld/);
  await db.exec(
    "update public.game_night_game_sessions set status='completed'",
  );
});

test("the participant limit rejects creation without orphan players", async () => {
  const before = (
    await db.query("select count(*)::int as n from public.game_night_players")
  ).rows[0].n;
  await db.exec(`begin;
    insert into public.game_night_players(name) select 'Seat ' || i from generate_series(1, 64) i;
    insert into public.game_night_session_players(session_id,player_id)
    select '${OTHER_SESSION}', id from public.game_night_players where name like 'Seat %';`);
  try {
    await assert.rejects(
      join("d".repeat(64), { p_join_token: "invite-two" }),
      /zit vol/,
    );
  } finally {
    await db.exec("rollback");
  }
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    before,
  );
});

test("host removal is never undone by rescanning or retrying", async () => {
  await db.query(
    "update public.game_night_session_players set active_at_table=false, seat_index=null where player_id=$1",
    [first.player_id],
  );
  assert.deepEqual(await join(TOKEN_A), first);
  const view = await state(TOKEN_A);
  assert.equal(view.at_table, false);
  assert.deepEqual(view.players, []);
  await assert.rejects(
    rpc(db, "game_night_update_guest", {
      p_guest_token: TOKEN_A,
      p_session_id: SESSION,
      p_name: "Changed",
    }),
  );
  await db.query(
    "update public.game_night_session_players set active_at_table=true, seat_index=0 where player_id=$1",
    [first.player_id],
  );
});

test("expired QR blocks new joins but preserves membership and QR recovery", async () => {
  await db.exec(
    "update public.game_night_join_tokens set expires_at=now()-interval '1 minute' where token='invite-one'",
  );
  await assert.rejects(join("c".repeat(64)));
  assert.equal((await state(TOKEN_A)).valid, true);
  const recovered = await rpc(db, "game_night_guest_state", {
    p_guest_token: TOKEN_A,
    p_join_token: "invite-one",
  });
  assert.equal(recovered.me.id, first.player_id);
  await db.exec(
    "update public.game_night_join_tokens set expires_at=now()+interval '12 hours', revoked_at=now() where token='invite-one'",
  );
  await assert.rejects(join("c".repeat(64)));
  assert.equal((await state(TOKEN_A)).valid, true);
});

test("completed nights are read-only; a new invite reuses the same player", async () => {
  await db.query(
    "update public.game_night_sessions set status='completed' where id=$1",
    [SESSION],
  );
  assert.equal((await state(TOKEN_A)).session.status, "completed");
  await assert.rejects(
    rpc(db, "game_night_update_guest", {
      p_guest_token: TOKEN_A,
      p_session_id: SESSION,
      p_name: "Changed",
    }),
  );
  const next = await join(TOKEN_A, {
    p_join_token: "invite-two",
    p_name: "Alex",
  });
  assert.equal(next.player_id, first.player_id);
  assert.equal(next.session_id, OTHER_SESSION);
});

test("expired, revoked or archived guests cannot access or rejoin", async () => {
  await db.exec("update private.game_night_guests set revoked_at=now()");
  assert.equal((await state(TOKEN_A)).valid, false);
  await assert.rejects(join(TOKEN_A, { p_join_token: "invite-two" }));
  await db.exec(
    "update private.game_night_guests set revoked_at=null, expires_at=now()-interval '1 day'",
  );
  assert.equal((await state(TOKEN_A)).valid, false);
  await db.exec(
    "update private.game_night_guests set expires_at=now()+interval '1 day'; update public.game_night_players set archived_at=now()",
  );
  assert.equal((await state(TOKEN_A)).valid, false);
});

db = await createGuestTestDb();
try {
  for (const check of cases) {
    await check.run();
    console.log(`PASS ${check.name}`);
  }
  console.log(`${cases.length} guest database checks passed.`);
} finally {
  await db.close();
}
