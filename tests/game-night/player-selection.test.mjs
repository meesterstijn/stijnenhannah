import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createGuestTestDb,
  rpc,
  SESSION,
  OTHER_SESSION,
  TOKEN_A,
  TOKEN_B,
} from "./guest-db.mjs";

const db = await createGuestTestDb({ playerSelection: false });
const cases = [];
const test = (name, run) => cases.push({ name, run });
let playerId;
let saved;
const state = (token, session = SESSION) =>
  rpc(db, "game_night_guest_state", {
    p_guest_token: token,
    p_session_id: session,
  });
const choose = (token, id = playerId, invite = "invite-two") =>
  rpc(db, "game_night_choose_guest_player", {
    p_join_token: invite,
    p_guest_token: token,
    p_player_id: id,
  });

test("upgrading preserves a saved guest's avatar and access", async () => {
  const options = await rpc(db, "game_night_guest_options", {
    p_join_token: "invite-one",
  });
  const joined = await rpc(db, "game_night_join_as_guest", {
    p_join_token: "invite-one",
    p_guest_token: TOKEN_A,
    p_name: "Sam",
    p_guest_face: "fox",
    p_base_part_id: options.bodies[0].id,
    p_color_id: options.palette[0].id,
  });
  playerId = joined.player_id;
  saved = (await state(TOKEN_A)).me;
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20260927000000_game_night_player_selection.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual((await state(TOKEN_A)).me, saved);
});

test("only a valid invitation lists saved players, without private fields", async () => {
  assert.deepEqual(
    await rpc(db, "game_night_guest_players", { p_join_token: "wrong" }),
    { valid: false },
  );
  const listed = await rpc(db, "game_night_guest_players", {
    p_join_token: "invite-two",
  });
  assert.deepEqual(listed.players, [saved]);
  assert.equal(JSON.stringify(listed).includes("auth_user_id"), false);
  assert.equal(JSON.stringify(listed).includes("token_hash"), false);
  assert.equal(JSON.stringify(listed).includes(TOKEN_A), false);
});

test("another phone freely selects the same saved player for a new night", async () => {
  const result = await choose(TOKEN_B);
  assert.equal(result.player_id, playerId);
  assert.equal(result.session_id, OTHER_SESSION);
  assert.deepEqual((await state(TOKEN_B, OTHER_SESSION)).me, saved);
  assert.equal(
    (await state(TOKEN_B)).valid,
    false,
    "selection must not expose previous nights",
  );
  assert.equal(
    (await state(TOKEN_A, OTHER_SESSION)).valid,
    false,
    "one device cannot silently authorize another",
  );
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from auth.users")).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.game_night_session_players where player_id=$1",
        [playerId],
      )
    ).rows[0].n,
    2,
  );
});

test("repeat selections and a second phone do not duplicate attendance", async () => {
  await choose(TOKEN_B);
  await choose("c".repeat(64));
  const seats = await db.query(
    "select * from public.game_night_session_players where session_id=$1",
    [OTHER_SESSION],
  );
  assert.equal(seats.rows.length, 1);
  assert.equal(seats.rows[0].seat_index, 0);
  await choose(TOKEN_A);
  assert.deepEqual((await state(TOKEN_A, OTHER_SESSION)).me, saved);
  assert.equal((await state(TOKEN_A)).valid, true);
});

test("the legacy create RPC also preserves an existing avatar when rejoining", async () => {
  await rpc(db, "game_night_join_as_guest", {
    p_join_token: "invite-two",
    p_guest_token: TOKEN_A,
    p_name: "Do not overwrite",
    p_guest_face: "robot",
  });
  assert.deepEqual((await state(TOKEN_A, OTHER_SESSION)).me, saved);
});

test("invalid invitations and token rebinding cannot change an identity", async () => {
  await assert.rejects(choose("d".repeat(64), playerId, "wrong"));
  const other = (
    await db.query(
      "insert into public.game_night_players(name) values ('Other player') returning id",
    )
  ).rows[0].id;
  await assert.rejects(choose(TOKEN_B, other), /nieuwe gastcode/);
  assert.deepEqual((await state(TOKEN_B, OTHER_SESSION)).me, saved);
});

test("selecting an account-linked player preserves their account and profile", async () => {
  await db.exec(`insert into auth.users values ('20000000-0000-0000-0000-000000000001');
    insert into public.profiles values ('20000000-0000-0000-0000-000000000001', 'owner');`);
  const original = (
    await db.query(
      "insert into public.game_night_players(name,auth_user_id) values ('Host','20000000-0000-0000-0000-000000000001') returning *",
    )
  ).rows[0];
  await choose("e".repeat(64), original.id);
  const after = (
    await db.query("select * from public.game_night_players where id=$1", [
      original.id,
    ])
  ).rows[0];
  assert.deepEqual(after, original);
  assert.equal(
    (await db.query("select app_role from public.profiles")).rows[0].app_role,
    "owner",
  );
  await assert.rejects(
    rpc(db, "game_night_generate_join_token", {
      p_game_night_session_id: OTHER_SESSION,
    }),
  );
});

test("host removal and archiving still control attendance and availability", async () => {
  await db.query(
    "update public.game_night_session_players set active_at_table=false,seat_index=null where session_id=$1 and player_id=$2",
    [OTHER_SESSION, playerId],
  );
  await choose("f".repeat(64));
  assert.equal((await state("f".repeat(64), OTHER_SESSION)).at_table, false);
  await db.query(
    "update public.game_night_players set archived_at=now() where id=$1",
    [playerId],
  );
  const listed = await rpc(db, "game_night_guest_players", {
    p_join_token: "invite-two",
  });
  assert.equal(
    listed.players.some((player) => player.id === playerId),
    false,
  );
  await assert.rejects(choose("1".repeat(64)), /niet meer beschikbaar/);
  assert.equal((await state(TOKEN_B, OTHER_SESSION)).valid, false);
  await db.exec("set role anon");
  try {
    await assert.rejects(
      db.query("select * from private.game_night_guest_sessions"),
    );
  } finally {
    await db.exec("reset role");
  }
});

try {
  for (const check of cases) {
    await check.run();
    console.log(`PASS ${check.name}`);
  }
  console.log(`${cases.length} player selection checks passed.`);
} finally {
  await db.close();
}
