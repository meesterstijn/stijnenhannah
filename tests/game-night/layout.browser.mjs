import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createGuestTestDb, rpc, SESSION, OTHER_SESSION } from "./guest-db.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = "/tmp/game-night-layout-test";
await mkdir(output, { recursive: true });
const db = await createGuestTestDb();
const uid = "90000000-0000-4000-8000-000000000001";
const now = new Date().toISOString(),
  ago = new Date(Date.now() - 86400000).toISOString();
const { rows: parts } = await db.query(
  "select * from public.game_night_character_parts where active and is_starter and slot='base' order by sort_order",
);
const { rows: colors } = await db.query(
  "select * from public.game_night_color_palette order by sort_order",
);
const names = [
  "Stijn",
  "Hannah",
  "Alexander van de lange achternaam",
  "Marieke",
  "Joost",
  "Sophie",
  "Daan",
  "Charlotte",
  "Lotte",
  "Thomas",
  "Emma",
  "SuperlangeSpelersnaamZonderSpaties",
];
for (let i = 0; i < names.length; i++)
  await rpc(db, "game_night_join_as_guest", {
    p_join_token: "invite-one",
    p_guest_token: (i + 1).toString(16).padStart(64, "0"),
    p_name: names[i],
    p_base_part_id: parts[i % parts.length]?.id ?? null,
    p_color_id: colors[i % colors.length].id,
  });
const data = {};
for (const { tablename } of (
  await db.query(
    "select tablename from pg_tables where schemaname='public' and tablename like 'game_night_%'",
  )
).rows)
  data[tablename] = (await db.query(`select * from public.${tablename}`)).rows;
await db.close();
const players = data.game_night_players;
players[0].auth_user_id = uid;
players.forEach((p, i) =>
  Object.assign(p, {
    character_id: null,
    body_shape: "medium",
    guest_face: ["smile", "cool", "fox", "cat"][i % 4],
  }),
);
const gameNames = [
  "Catan",
  "Ticket to Ride Europe",
  "Mario Kart",
  "De kolonisten van Catan: steden en ridders",
  "Azul",
  "Codenames",
  "Carcassonne",
  "30 Seconds",
];
data.game_night_games = gameNames.map((name, i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
  slug: i === 2 ? "mario-kart" : name.toLowerCase().replaceAll(" ", "-"),
  cover_storage_path: null,
  min_players: 2,
  max_players: 8,
  duration_minutes: 45,
  difficulty: "gemiddeld",
  tags: ["Gezelschap", "Strategie"],
  description: "Een gezellige spelavond met vrienden.",
  created_at: ago,
  updated_at: now,
  archived_at: null,
  result_mode: "winner_only",
  uses_rounds: false,
  has_session_winner: true,
  track_round_results: false,
  arena_style: null,
  arena_symbol: null,
  arena_primary_color: null,
  arena_secondary_color: null,
  arena_tagline: null,
  celebration_style: null,
  accent_color_id: null,
  setup_storage_path: null,
}));
const games = data.game_night_games;
data.game_night_sessions[0] = {
  ...data.game_night_sessions[0],
  started_at: now,
};
data.game_night_sessions[1] = {
  ...data.game_night_sessions[1],
  name: "Zaterdagavond met vrienden en familie",
  status: "completed",
  started_at: ago,
  ended_at: now,
};
data.game_night_session_players.push(
  ...players.map((p, i) => ({
    session_id: OTHER_SESSION,
    player_id: p.id,
    active_at_table: true,
    seat_index: i,
    source: "manual",
    joined_at: ago,
    left_at: null,
  })),
);
const makeGameSession = (id, night, game, status) => ({
  id,
  game_night_session_id: night,
  game_id: game.id,
  status,
  started_at: ago,
  ended_at: status === "completed" ? now : null,
  paused_at: null,
  created_at: ago,
  updated_at: now,
  total_paused_seconds: 0,
  uses_rounds: false,
  track_round_results: false,
  has_session_winner: true,
  result_mode: "winner_only",
  win_source: "win_events",
});
const pastGame = makeGameSession(
  "30000000-0000-4000-8000-000000000001",
  OTHER_SESSION,
  games[0],
  "completed",
);
const currentGame = makeGameSession(
  "30000000-0000-4000-8000-000000000002",
  SESSION,
  games[0],
  "active",
);
data.game_night_game_sessions = [pastGame];
data.game_night_game_session_players = [pastGame, currentGame].flatMap((s) =>
  players.map((p, i) => ({
    game_session_id: s.id,
    player_id: p.id,
    seat_order: i,
    team_id: null,
    created_at: ago,
  })),
);
data.game_night_win_events = [pastGame, currentGame].flatMap((s) =>
  [0, 1, 0, 3, 0, 1].map((p, i) => ({
    id: `${s.id}-${i}`,
    game_session_id: s.id,
    player_id: players[p].id,
    created_at: new Date(Date.now() - 600000 + i * 60000).toISOString(),
    undone_at: null,
  })),
);
Object.assign(data, {
  game_night_rounds: [],
  game_night_round_results: [],
  game_night_game_session_results: [],
  game_night_checkpoints: [],
  game_night_checkpoint_photos: [],
  game_night_mario_kart_point_events: [],
});
const server = spawn(
  process.execPath,
  [
    root + "/node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5180",
    "--strictPort",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes("5180")) resolve();
  });
  server.on("exit", (code) => reject(new Error("Vite exit " + code)));
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const errors = [],
  requests = [];
let mode = "lobby",
  role = "owner",
  count = 8,
  delaySeats = false;
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  serviceWorkers: "block",
  reducedMotion: "reduce",
});
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "audit@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: ago,
};
const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: uid, exp: Math.floor(Date.now() / 1000) + 7200, aud: "authenticated", role: "authenticated" })}.audit-signature`;
await context.addInitScript(
  ({ user, jwt }) =>
    localStorage.setItem(
      "sb-lrqivcfuiuskqkpmyxfo-auth-token",
      JSON.stringify({
        access_token: jwt,
        refresh_token: "audit-local",
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: "bearer",
        user,
      }),
    ),
  { user, jwt },
);
await context.routeWebSocket(/supabase/, (ws) => ws.close());
await context.route("https://**/*", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    name = url.pathname.split("/").at(-1),
    q = url.searchParams;
  if (!url.hostname.endsWith(".supabase.co")) return route.abort();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
  if (url.pathname.startsWith("/auth/"))
    return route.fulfill({ json: { user } });
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    if (name === "game_night_guest_options")
      return route.fulfill({
        json: {
          valid: true,
          invitation: { valid: true, game_night_name: "Vrijdag met vrienden" },
          palette: colors,
          bodies: parts,
          me: null,
        },
      });
    const guestPlayer = (p) => ({
      id: p.id,
      name: p.name,
      guest_face: p.guest_face,
      face_asset_path: null,
      face_revision: null,
      color_id: p.color_id,
      color: colors.find((c) => c.id === p.color_id)?.hex,
      body: parts[0],
    });
    if (name === "game_night_guest_players")
      return route.fulfill({
        json: { valid: true, players: players.map(guestPlayer) },
      });
    if (name === "game_night_guest_state")
      return route.fulfill({
        json: {
          valid: true,
          session: {
            id: SESSION,
            name: "Vrijdag met vrienden",
            status: "active",
          },
          me: guestPlayer(players[0]),
          players: players.slice(0, count).map(guestPlayer),
          at_table: true,
          game: null,
        },
      });
    if (name === "game_night_complete_session")
      return route.fulfill({
        json: {
          ...data.game_night_sessions[0],
          status: "completed",
          ended_at: now,
        },
      });
    requests.push({ type: "RPC", name });
    return route.fulfill({ json: [] });
  }
  if (!url.pathname.startsWith("/rest/v1/")) {
    requests.push({ type: "other", path: url.pathname });
    return route.fulfill({ json: [] });
  }
  let rows = structuredClone(data[name] ?? []);
  if (name === "profiles")
    rows = [{ id: uid, display_name: "Stijn", app_role: role }];
  if (name === "game_night_sessions" && mode === "idle")
    rows = rows.map((s) => ({ ...s, status: "completed", ended_at: now }));
  if (
    name === "game_night_game_sessions" &&
    ["arena", "recap", "mario", "legacy"].includes(mode)
  )
    rows.push({
      ...currentGame,
      status: mode === "recap" ? "completed" : "active",
      game_id: mode === "mario" ? games[2].id : games[0].id,
      win_source: mode === "legacy" ? "legacy" : "win_events",
    });
  if (name === "game_night_session_players" && delaySeats)
    await new Promise((resolve) => setTimeout(resolve, 250));
  if (name === "game_night_session_players")
    rows = rows.map((r) => ({
      ...r,
      active_at_table: r.session_id === SESSION ? r.seat_index < count : true,
    }));
  if (name === "game_night_game_session_players")
    rows = rows.filter((r) => r.seat_order < count);
  for (const [key, filter] of q) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const i = filter.indexOf("."),
      op = filter.slice(0, i),
      value = filter.slice(i + 1);
    if (op === "eq") rows = rows.filter((r) => String(r[key]) === value);
    if (op === "neq") rows = rows.filter((r) => String(r[key]) !== value);
    if (op === "is")
      rows = rows.filter((r) =>
        value === "null" ? r[key] == null : String(r[key]) === value,
      );
    if (op === "in")
      rows = rows.filter((r) =>
        value.slice(1, -1).split(",").includes(String(r[key])),
      );
    if (op === "gt") rows = rows.filter((r) => String(r[key]) > value);
  }
  const order = q.get("order");
  if (order) {
    const [field, direction] = order.split(".");
    rows.sort(
      (a, b) =>
        String(a[field] ?? "").localeCompare(String(b[field] ?? "")) *
        (direction === "desc" ? -1 : 1),
    );
  }
  const select = q.get("select") ?? "";
  if (select.includes("player:game_night_players"))
    rows = rows.map((r) => ({
      ...r,
      player: players.find((p) => p.id === r.player_id),
    }));
  if (select.includes("game:game_night_games"))
    rows = rows.map((r) => ({
      ...r,
      game: games.find((g) => g.id === r.game_id),
    }));
  if (q.has("limit")) rows = rows.slice(0, Number(q.get("limit")));
  if (req.method() !== "GET" && req.method() !== "HEAD")
    requests.push({ type: "mutation-blocked", name });
  return route.fulfill({
    json: req.headers().accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows,
    headers: {
      "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
    },
  });
});
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push({ mode, route: page.url(), error: e.message }),
);

// Render the actual app; all remote HTTP/WebSocket traffic is mocked locally.
// Wheel input is intentional: scrollIntoView can make overflow:hidden appear
// usable even though a player cannot reach it with normal scrolling.
let navigation = 0,
  checks = 0;
async function open(path = "", view = "lobby", as = "owner") {
  mode = view;
  role = as;
  await page.goto(
    `http://127.0.0.1:5180/?layout=${++navigation}#/game-night${path}`,
  );
  await page.locator(".gnv2-scene").first().waitFor();
  await page.waitForTimeout(650);
}
async function frame() {
  const layout = await page.evaluate(() => ({
    wood: getComputedStyle(document.body).backgroundImage.includes(
      "table-wood",
    ),
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    top: document.querySelector(".gnv2-scene").getBoundingClientRect().top,
  }));
  assert.equal(layout.wood, false);
  assert.ok(layout.width <= layout.viewport, "No horizontal page overflow");
  assert.equal(layout.top, 0, "Scene starts at the viewport edge");
  checks++;
}
async function reachable(locator) {
  const result = await locator.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.x >= 0 &&
      r.y >= 0 &&
      r.right <= innerWidth + 1 &&
      r.bottom <= innerHeight + 1 &&
      (hit === e || e.contains(hit))
    );
  });
  assert.ok(
    result,
    `Control visible and unobstructed: ${await locator.textContent()}`,
  );
  checks++;
}
async function wheelToBottom(selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.height > 0, selector);
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(box.height / 2, 200),
  );
  await page.mouse.wheel(0, 10000);
  await page.waitForTimeout(100);
}
async function allSeatsReachable() {
  const stage = page.locator(".gnv2-arena-scene-stage");
  const box = await stage.boundingBox();
  const seen = new Set();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -10000);
  await page.waitForTimeout(80);
  for (let i = 0; i < 40 && seen.size < count; i++) {
    const visible = await stage.evaluate((e) => {
      const clip = e.getBoundingClientRect();
      return [...e.querySelectorAll(".gnv2-arena-seat")].flatMap(
        (seat, index) => {
          const r = seat.getBoundingClientRect();
          return r.top >= clip.top - 1 &&
            r.bottom <= clip.bottom + 1 &&
            r.left >= clip.left - 1 &&
            r.right <= clip.right + 1
            ? [index]
            : [];
        },
      );
    });
    visible.forEach((index) => seen.add(index));
    if (seen.size < count) {
      await page.mouse.wheel(0, Math.max(40, box.height / 3));
      await page.waitForTimeout(80);
    }
  }
  assert.equal(
    seen.size,
    count,
    `All ${count} players reachable at ${JSON.stringify(page.viewportSize())}`,
  );
  checks++;
}
const viewports = [
  [320, 568],
  [375, 812],
  [667, 375],
  [768, 1024],
  [1280, 800],
  [1920, 1080],
];
try {
  // Loading a populated lobby must not emit arrival notifications.
  delaySeats = true;
  await open();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".gnv2-stage-grid .gnv2-party-character")
        .length === 8,
  );
  assert.equal(await page.locator(".gnv2-toast").count(), 0);
  delaySeats = false;
  // Refocus causes React Query to load the changed snapshot, like realtime.
  const refetch = async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      window.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".gnv2-stage-grid .gnv2-party-character")
          .length === n,
      count,
      { timeout: 5000 },
    );
  };
  count = 10;
  await refetch();
  assert.match(
    await page.locator(".gnv2-toasts").innerText(),
    /2 spelers schuiven aan/,
  );
  count = 11;
  await refetch();
  count = 12;
  await refetch();
  assert.equal(
    await page.locator(".gnv2-toast").count(),
    2,
    "At most two arrival notices",
  );
  await page.waitForTimeout(8700);
  assert.equal(await page.locator(".gnv2-toast").count(), 0);
  await page.clock.install();
  checks += 4;

  for (const n of [2, 4, 8, 12]) {
    count = n;
    for (const [width, height] of viewports) {
      console.log(`Arena: ${n} players, ${width}x${height}`);
      await page.setViewportSize({ width, height });
      await open("", "arena");
      await frame();
      // Even the temporary introduction may not cover the toolbar.
      await reachable(
        page.getByRole("button", { name: "Spel afsluiten", exact: true }),
      );
      await page.clock.fastForward(9000);
      await page.locator(".gnv2-arena-intro").waitFor({ state: "hidden" });
      await allSeatsReachable();
      await reachable(
        page.getByRole("button", { name: "Win registreren", exact: true }),
      );
    }
  }
  count = 8;
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await open("", "mario");
    await frame();
    for (const name of [
      "Checkpoint / foto",
      "Muziek",
      "Meer opties",
      "Spel afsluiten",
    ])
      await reachable(page.getByRole("button", { name, exact: true }));
    await open("", "recap");
    await frame();
    await wheelToBottom(".gnv2-recap-root");
    for (const name of ["Rematch", "Ander spel", "Game Night afsluiten"])
      await reachable(page.getByRole("button", { name, exact: true }));
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Game Night afsluiten", exact: true })
      .click();
    await page.locator(".gnv2-nightrecap-root").waitFor();
    await wheelToBottom(".gnv2-nightrecap-root");
    await reachable(
      page.getByRole("button", { name: "Nieuwe Game Night", exact: true }),
    );
  }
  for (const as of ["owner", "game_night_member"]) {
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const path of ["/me/character", "/me/face"]) {
        await open(path, "lobby", as);
        await frame();
        if (path.endsWith("character")) {
          if (height <= 600) await wheelToBottom(".gnv2-creator-scene");
          await reachable(
            page.getByRole("button", { name: "Opslaan", exact: true }),
          );
        } else {
          await wheelToBottom(".gnv2-creator-scene > div:last-child");
          await reachable(
            page.getByRole("button", { name: "Foto kiezen", exact: true }),
          );
        }
      }
    }
  }
  for (const path of [
    "/spellen",
    `/spellen/${games[0].id}`,
    "/geschiedenis",
    `/geschiedenis/${OTHER_SESSION}`,
    `/geschiedenis/${OTHER_SESSION}/finale`,
    "/hall-of-fame",
    "/spelers",
    `/spelers/${players[0].id}`,
    "/me",
  ]) {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(path);
    await frame();
    await reachable(page.locator(".gnv2-topbar a").first());
    await reachable(
      page.getByRole("link", { name: "Ons Huisje", exact: true }),
    );
  }
  await open("/spelen");
  assert.equal(new URL(page.url()).hash, "#/game-night");
  assert.equal(await page.getByText("Binnenkort", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(`PASS: ${checks} layout and interaction checks`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      {
        url: page.url(),
        viewport: page.viewportSize(),
        mode,
        role,
        count,
        errors,
        requests,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  server.kill();
}
