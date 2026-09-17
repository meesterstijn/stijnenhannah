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

const db = await createGuestTestDb();
const join = (token, name, invite = "invite-one") =>
  rpc(db, "game_night_join_as_guest", {
    p_join_token: invite,
    p_guest_token: token,
    p_name: name,
    p_guest_face: null,
  });
const access = (args) => rpc(db, "game_night_guest_face_access", args);
const save = (token, paths, extra = {}) =>
  rpc(db, "game_night_update_guest_face", {
    p_guest_token: token,
    p_session_id: SESSION,
    p_face_original_path: paths.original,
    p_face_asset_path: paths.face,
    p_face_crop: {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 300,
      sourceHeight: 300,
    },
    ...extra,
  });
const pathsFor = (id, revision = "00000000-0000-4000-8000-000000000001") => ({
  original: `${id}/${revision}/original.webp`,
  face: `${id}/${revision}/face.png`,
});
const upload = (paths) =>
  db.query(
    "insert into storage.objects(bucket_id,name) values ('game-night-player-faces',$1),('game-night-player-faces',$2)",
    [paths.original, paths.face],
  );

try {
  // Rerunnable upgrade, including unchanged grants on replaced helpers.
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20260928000000_game_night_guest_faces.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const a = await join(TOKEN_A, "Foto A");
  const b = await join(TOKEN_B, "Foto B");
  const paths = pathsFor(a.player_id);
  const otherPaths = pathsFor(b.player_id);
  assert.deepEqual(
    await access({
      p_action: "write",
      p_guest_token: TOKEN_A,
      p_session_id: SESSION,
    }),
    { player_id: a.player_id },
  );
  await assert.rejects(
    access({ p_action: "write", p_join_token: "invite-one" }),
    /aan tafel/,
  );
  await assert.rejects(
    access({
      p_action: "write",
      p_guest_token: TOKEN_A,
      p_session_id: OTHER_SESSION,
    }),
    /aan tafel/,
  );
  await assert.rejects(save(TOKEN_A, paths), /geüpload/);
  await upload(paths);
  await upload(otherPaths);
  await assert.rejects(save(TOKEN_A, otherPaths), /fotopad/);
  await assert.rejects(
    save(TOKEN_A, { ...paths, original: otherPaths.original }),
    /jouw speler/,
  );
  await assert.rejects(save(TOKEN_A, paths, { p_face_crop: [] }), /uitsnede/);
  await save(TOKEN_A, paths);
  const state = await rpc(db, "game_night_guest_state", {
    p_guest_token: TOKEN_A,
    p_session_id: SESSION,
  });
  assert.equal(state.me.face_asset_path, paths.face);
  assert.equal(state.me.guest_face, null);
  assert.equal(typeof state.me.face_revision, "string");
  assert.equal("face_original_path" in state.me, false);
  assert.equal("face_crop" in state.me, false);
  for (const args of [
    { p_join_token: "invite-one" },
    { p_guest_token: TOKEN_A, p_session_id: SESSION },
    { p_guest_token: TOKEN_B, p_session_id: SESSION },
  ]) {
    assert.deepEqual(
      await access({ p_action: "read", p_asset_path: paths.face, ...args }),
      { asset_path: paths.face },
    );
    await assert.rejects(
      access({ p_action: "read", p_asset_path: paths.original, ...args }),
      /Geen toegang/,
    );
  }
  await assert.rejects(
    access({ p_action: "read", p_asset_path: paths.face }),
    /Geen toegang/,
  );
  await assert.rejects(
    access({
      p_action: "read",
      p_asset_path: paths.face,
      p_join_token: "invalid",
    }),
    /Geen toegang/,
  );
  await assert.rejects(
    access({
      p_action: "read",
      p_asset_path: paths.face,
      p_guest_token: TOKEN_A,
      p_session_id: OTHER_SESSION,
    }),
    /Geen toegang/,
  );

  // Choosing a player preserves the photo, without granting other nights.
  const newToken = "c".repeat(64);
  await rpc(db, "game_night_choose_guest_player", {
    p_join_token: "invite-two",
    p_guest_token: newToken,
    p_player_id: a.player_id,
  });
  const selected = await rpc(db, "game_night_guest_state", {
    p_guest_token: newToken,
    p_session_id: OTHER_SESSION,
  });
  assert.deepEqual(selected.me, state.me);
  await assert.rejects(
    access({
      p_action: "write",
      p_guest_token: newToken,
      p_session_id: SESSION,
    }),
    /aan tafel/,
  );

  // An incomplete replacement leaves the previous face intact.
  const nextPaths = pathsFor(
    a.player_id,
    "00000000-0000-4000-8000-000000000002",
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('game-night-player-faces',$1)",
    [nextPaths.original],
  );
  await assert.rejects(save(TOKEN_A, nextPaths), /geüpload/);
  assert.equal(
    (
      await rpc(db, "game_night_guest_state", {
        p_guest_token: TOKEN_A,
        p_session_id: SESSION,
      })
    ).me.face_asset_path,
    paths.face,
  );
  await db.query(
    "update public.game_night_session_players set active_at_table = false where player_id=$1 and session_id=$2",
    [b.player_id, SESSION],
  );
  await assert.rejects(
    access({
      p_action: "read",
      p_asset_path: paths.face,
      p_guest_token: TOKEN_B,
      p_session_id: SESSION,
    }),
    /Geen toegang/,
  );
  await assert.rejects(save(TOKEN_B, otherPaths), /aan tafel/);
  await db.exec("update public.game_night_sessions set status='completed'");
  await assert.rejects(save(TOKEN_A, paths), /aan tafel/);
  await assert.rejects(
    access({
      p_action: "read",
      p_asset_path: paths.face,
      p_join_token: "invite-one",
    }),
    /Geen toegang/,
  );
  await db.exec("update private.game_night_guests set revoked_at=now()");
  await assert.rejects(
    access({
      p_action: "read",
      p_asset_path: paths.face,
      p_guest_token: TOKEN_A,
      p_session_id: SESSION,
    }),
    /Geen toegang/,
  );
  assert.equal(
    (await db.query("select count(*)::int n from auth.users")).rows[0].n,
    0,
  );
  console.log(
    "Guest faces: authorization, private originals, completed uploads, recovery and revocation passed.",
  );
} finally {
  await db.close();
}
