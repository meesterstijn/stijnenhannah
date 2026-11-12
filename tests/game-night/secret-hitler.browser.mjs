// Secret Hitler end-to-end in de echte app: alle Supabase-verkeer wordt
// lokaal gesimuleerd (spelers uit de echte migraties via PGlite), de host
// klikt een potje door en een gast kijkt mee op de telefoon. Screenshots
// komen in de tijdelijke map die onderaan wordt gemeld.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createGuestTestDb, rpc, SESSION } from "./guest-db.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(tmpdir(), "game-night-secret-hitler-test");
await mkdir(output, { recursive: true });
const PORT = 5181;

const db = await createGuestTestDb();
const uid = "90000000-0000-4000-8000-000000000001";
const now = new Date().toISOString();
const ago = new Date(Date.now() - 3600000).toISOString();
const { rows: parts } = await db.query(
  "select * from public.game_night_character_parts where active and is_starter and slot='base' order by sort_order",
);
const { rows: colors } = await db.query(
  "select * from public.game_night_color_palette order by sort_order",
);
const names = [
  "Stijn",
  "Hannah",
  "Marieke",
  "Joost",
  "Sophie",
  "Daan",
  "Lotte",
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

const players = names.map((n) =>
  data.game_night_players.find((p) => p.name === n),
);
players[0].auth_user_id = uid;
players.forEach((p) =>
  Object.assign(p, { character_id: null, body_shape: "medium" }),
);
const shGame = {
  id: "9a000000-0000-4000-8000-000000000003",
  name: "Secret Hitler",
  slug: "secret-hitler",
  cover_storage_path: null,
  min_players: 5,
  max_players: 10,
  duration_minutes: 45,
  difficulty: "gemiddeld",
  tags: ["Bluffen", "Sociaal", "Verraad"],
  description: null,
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
};
data.game_night_games = [shGame];
data.game_night_sessions[0] = {
  ...data.game_night_sessions[0],
  started_at: now,
};
data.game_night_sessions[1] = {
  ...data.game_night_sessions[1],
  status: "completed",
  started_at: ago,
  ended_at: ago,
};
const gameSession = {
  id: "30000000-0000-4000-8000-000000000009",
  game_night_session_id: SESSION,
  game_id: shGame.id,
  status: "active",
  started_at: ago,
  ended_at: null,
  paused_at: null,
  created_at: ago,
  updated_at: now,
  total_paused_seconds: 0,
  uses_rounds: false,
  track_round_results: false,
  has_session_winner: true,
  result_mode: "winner_only",
  win_source: "win_events",
};
data.game_night_game_sessions = [gameSession];
data.game_night_game_session_players = players.map((p, i) => ({
  game_session_id: gameSession.id,
  player_id: p.id,
  seat_order: i,
  team_id: null,
  created_at: ago,
}));
Object.assign(data, {
  game_night_win_events: [],
  game_night_rounds: [],
  game_night_round_results: [],
  game_night_game_session_results: [],
  game_night_checkpoints: [],
  game_night_checkpoint_photos: [],
  game_night_mario_kart_point_events: [],
  game_night_secret_hitler_events: [],
  game_night_secret_hitler_suspicions: [
    {
      game_session_id: gameSession.id,
      voter_player_id: players[1].id,
      suspect_player_id: players[3].id,
    },
    {
      game_session_id: gameSession.id,
      voter_player_id: players[2].id,
      suspect_player_id: players[3].id,
    },
    {
      game_session_id: gameSession.id,
      voter_player_id: players[4].id,
      suspect_player_id: players[5].id,
    },
  ],
});
let clock = Date.now() - 600000;
const stamp = () => new Date((clock += 1000)).toISOString();

const server = spawn(
  process.execPath,
  [
    root + "/node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--strictPort",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve, reject) => {
  server.stdout.on("data", (b) => {
    if (b.toString().includes(String(PORT))) resolve();
  });
  server.on("exit", (code) => reject(new Error("Vite exit " + code)));
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const errors = [];
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

async function makeContext(viewport, { owner = true } = {}) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  if (owner)
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
  else
    await context.addInitScript(() =>
      localStorage.setItem("game-night-guest-v1", "2".padStart(64, "0")),
    );
  await context.routeWebSocket(/supabase/, (ws) => ws.close());
  await context.route("https://**/*", handle);
  return context;
}

async function handle(route) {
  const req = route.request();
  const url = new URL(req.url());
  const name = url.pathname.split("/").at(-1);
  const q = url.searchParams;
  if (!url.hostname.endsWith(".supabase.co")) return route.abort();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
  if (url.pathname.startsWith("/auth/"))
    return route.fulfill({ json: { user } });
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const body = req.postDataJSON?.() ?? {};
    const events = data.game_night_secret_hitler_events;
    if (name === "game_night_secret_hitler_record") {
      const row = {
        id: crypto.randomUUID(),
        game_session_id: body.p_game_session_id,
        payload: body.p_payload,
        created_at: stamp(),
        undone_at: null,
      };
      events.push(row);
      return route.fulfill({ json: row });
    }
    if (name === "game_night_secret_hitler_undo_last") {
      const last = [...events].reverse().find((e) => e.undone_at == null);
      last.undone_at = stamp();
      return route.fulfill({ json: last });
    }
    if (name === "game_night_secret_hitler_finish") {
      for (const id of body.p_winner_ids)
        data.game_night_win_events.push({
          id: crypto.randomUUID(),
          game_session_id: gameSession.id,
          player_id: id,
          created_at: stamp(),
          undone_at: null,
        });
      gameSession.status = "completed";
      gameSession.ended_at = stamp();
      return route.fulfill({ json: gameSession });
    }
    if (name === "game_night_guest_state")
      return route.fulfill({
        json: {
          valid: true,
          session: {
            id: SESSION,
            name: "Vrijdag met vrienden",
            status: "active",
          },
          me: guestPlayer(players[1]),
          players: players.map(guestPlayer),
          at_table: true,
          game: { name: "Secret Hitler", status: "active" },
        },
      });
    if (name === "game_night_guest_options")
      return route.fulfill({
        json: {
          valid: true,
          palette: colors,
          bodies: parts,
          me: guestPlayer(players[1]),
        },
      });
    if (name === "game_night_guest_secret_hitler") {
      const active = events.filter((e) => e.undone_at == null);
      const revealed = active.some((e) => e.payload.type === "reveal");
      const sus = data.game_night_secret_hitler_suspicions;
      return route.fulfill({
        json: {
          active: true,
          game_session_id: gameSession.id,
          status: gameSession.status,
          me: players[1].id,
          seats: players.map((p) => p.id),
          events: active.map(({ id, created_at, payload }) => ({
            id,
            created_at,
            payload,
          })),
          my_suspect:
            sus.find((s) => s.voter_player_id === players[1].id)
              ?.suspect_player_id ?? null,
          suspicions: revealed ? sus : [],
        },
      });
    }
    if (name === "game_night_guest_secret_hitler_suspect") {
      const sus = data.game_night_secret_hitler_suspicions;
      const mine = sus.find((s) => s.voter_player_id === players[1].id);
      if (mine) mine.suspect_player_id = body.p_suspect_id;
      return route.fulfill({ json: null });
    }
    return route.fulfill({ json: [] });
  }
  if (!url.pathname.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
  let rows = structuredClone(data[name] ?? []);
  if (name === "profiles")
    rows = [{ id: uid, display_name: "Stijn", app_role: "owner" }];
  for (const [key, filter] of q) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const i = filter.indexOf(".");
    const op = filter.slice(0, i);
    const value = filter.slice(i + 1);
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
      game: data.game_night_games.find((g) => g.id === r.game_id),
    }));
  if (select.includes("players:game_night_game_session_players"))
    rows = rows.map((r) => ({
      ...r,
      players: data.game_night_game_session_players.filter(
        (p) => p.game_session_id === r.id,
      ),
    }));
  if (q.has("limit")) rows = rows.slice(0, Number(q.get("limit")));
  return route.fulfill({
    json: req.headers().accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows,
    headers: {
      "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
    },
  });
}

let shot = 0;
const openPages = [];
async function snap(page, label) {
  const file = join(output, `${String(++shot).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  assert.equal(overflow, false, `${label}: geen horizontale overloop`);
}
const seat = (page, n) =>
  page
    .locator(".sh-seats")
    .getByRole("button", { name: new RegExp(`^${n}(:|$)`) });
const click = async (page, text) => {
  await page.getByRole("button", { name: text }).first().click();
  await page.waitForTimeout(250);
};

try {
  // ── Host op een tablet in liggende stand ─────────────────────────────
  const host = await makeContext({ width: 1180, height: 820 });
  const page = await host.newPage();
  openPages.push(page);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/#/game-night`);
  await page.locator(".sh-root").waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  assert.ok(await page.getByText("7 spelers:").isVisible());
  await snap(page, "setup");

  await seat(page, "Stijn").click();
  await click(page, "Start het spel");
  await page.getByText("is president").waitFor();
  await snap(page, "nominate");

  // Regering 1: Stijn + Marieke, gekozen, fascistisch met tegenspraak.
  await seat(page, "Marieke").click();
  await click(page, "Draag Marieke voor");
  await click(page, "Iedereen ja");
  await seat(page, "Joost").click(); // ja -> nein
  await seat(page, "Joost").click();
  await snap(page, "vote");
  await click(page, "✅ Gekozen");
  await click(page, "💀 Fascistisch");
  await page.getByRole("button", { name: "FFF" }).click();
  await page.getByRole("button", { name: "FL", exact: true }).click();
  await snap(page, "claims");
  await click(page, "Fascistische wet aannemen");
  await page.locator(".sh-banner").waitFor();
  assert.match(await page.locator(".sh-banner").textContent(), /liegt/);
  await snap(page, "banner-lie");
  await page.locator(".sh-banner").click();

  // Ongedaan maken en opnieuw: de wet verdwijnt en komt terug.
  await click(page, "Stap terug");
  await page.getByText("Welke wet komt er?").waitFor();
  await click(page, "💀 Fascistisch");
  await click(page, "Fascistische wet aannemen");
  await page.getByText("Wie wordt kanselier?").waitFor();

  // Regering 2 (Hannah): Hannah + Sophie, fascistisch -> 7p: onderzoek.
  await seat(page, "Sophie").click();
  await click(page, "Draag Sophie voor");
  await click(page, "✅ Gekozen");
  await click(page, "💀 Fascistisch");
  await click(page, "Fascistische wet aannemen");
  await page.getByText("Partij onderzoeken").first().waitFor();
  await seat(page, "Joost").click();
  await click(page, "💀 Fascist");
  await snap(page, "investigate");
  await click(page, "Bevestig: Joost");

  // Twee keer wegstemmen: verkiezingsteller loopt op.
  for (const c of ["Daan", "Lotte"]) {
    await page.getByText("Wie wordt kanselier?").waitFor();
    await seat(page, c).click();
    await click(page, `Draag ${c} voor`);
    await click(page, "❌ Weggestemd");
  }
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".sh-tracker-dot-on").count(), 2);
  await snap(page, "tracker");

  // Regering 5 (Sophie): + Stijn, fascistisch -> speciale verkiezing.
  await seat(page, "Stijn").click();
  await click(page, "Draag Stijn voor");
  await click(page, "✅ Gekozen");
  await click(page, "💀 Fascistisch");
  await click(page, "Fascistische wet aannemen");
  await seat(page, "Hannah").click();
  await click(page, "Bevestig: Hannah");
  // 3 F: na de verkiezing volgt de Hitler-vraag.
  await seat(page, "Joost").click();
  await click(page, "Draag Joost voor");
  await click(page, "✅ Gekozen");
  await page.getByText("Is Joost Hitler?", { exact: false }).waitFor();
  await snap(page, "hitler-check");
  await click(page, "🦎 Ja, ik ben Hitler");
  await page.getByText("De fascisten winnen!").first().waitFor();
  await page.locator(".sh-banner").click();
  await snap(page, "game-over");

  // Rollen onthullen en uitslag opslaan.
  await click(page, "🎭 Rollen onthullen");
  const row = (n) => page.locator(".sh-reveal-row", { hasText: n });
  await row("Sophie")
    .getByRole("button", { name: /Fascist/ })
    .click();
  await row("Stijn")
    .getByRole("button", { name: /Fascist/ })
    .click();
  await snap(page, "reveal");
  await click(page, "Onthullen!");
  await page.getByText("Uitslag opslaan").waitFor();
  await snap(page, "revealed");

  // ── Gast op de telefoon kijkt mee (na onthulling: uitslag) ───────────
  const phone = await makeContext(
    { width: 390, height: 844 },
    { owner: false },
  );
  const guestPage = await phone.newPage();
  openPages.push(guestPage);
  guestPage.on("pageerror", (e) => errors.push(e.message));
  await guestPage.goto(
    `http://127.0.0.1:${PORT}/#/game-night/guest/${SESSION}`,
  );
  await guestPage.locator(".sh-guest").first().waitFor({ timeout: 20000 });
  await guestPage.waitForTimeout(500);
  assert.match(
    await guestPage.locator(".sh-recap-me").textContent(),
    /Jij had het goed/,
  );
  await snap(guestPage, "guest-recap");
  await guestPage.screenshot({
    path: join(output, "guest-recap-full.png"),
    fullPage: true,
  });

  await click(page, "🏆 Uitslag opslaan");
  await page.locator(".sh-recap").waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  assert.equal(data.game_night_win_events.length, 3);
  await snap(page, "recap");
  await page.locator(".sh-govs").scrollIntoViewIfNeeded();
  await snap(page, "recap-hindsight");

  // Spelpagina: statistieken over alle potjes.
  await page.goto(
    `http://127.0.0.1:${PORT}/#/game-night/spellen/secret-hitler`,
  );
  await page.locator(".sh-stats").waitFor({ timeout: 20000 });
  await page.locator(".sh-stats").scrollIntoViewIfNeeded();
  assert.match(await page.locator(".sh-stats").textContent(), /Vaakst Hitler/);
  await snap(page, "game-stats");

  // ── Midden in een potje op een telefoon (host) en de gastweergave ───
  gameSession.status = "active";
  gameSession.ended_at = null;
  data.game_night_win_events = [];
  data.game_night_secret_hitler_events = data.game_night_secret_hitler_events
    .filter(
      (e) =>
        !["hitler_check", "reveal", "declare_winner"].includes(e.payload.type),
    )
    .slice(0, -2);
  const small = await makeContext({ width: 390, height: 844 });
  const smallPage = await small.newPage();
  openPages.push(smallPage);
  smallPage.on("pageerror", (e) => errors.push(e.message));
  await smallPage.goto(`http://127.0.0.1:${PORT}/#/game-night`);
  await smallPage.locator(".sh-root").waitFor({ timeout: 20000 });
  await smallPage.waitForTimeout(600);
  await snap(smallPage, "phone-host");
  await guestPage.reload();
  await guestPage.locator(".sh-guest-suspects").waitFor({ timeout: 20000 });
  await snap(guestPage, "guest-live");
  await guestPage.screenshot({
    path: join(output, "guest-live-full.png"),
    fullPage: true,
  });

  assert.deepEqual(errors, []);
  console.log(`Secret Hitler browser flow passed. Screenshots: ${output}`);
} catch (error) {
  for (const [i, p] of openPages.entries())
    await p.screenshot({ path: join(output, `fail-${i}.png`) }).catch(() => {});
  console.error("Pagina-fouten:", errors, "Screenshots:", output);
  throw error;
} finally {
  await browser.close();
  server.kill();
}
