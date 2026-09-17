import assert from "node:assert/strict";
import { chromium } from "playwright";
import { guestFaceEdge } from "./guest-face-edge.mjs";
import { createGuestTestDb, rpc, SESSION, OTHER_SESSION } from "./guest-db.mjs";

// Run a dev server first. Every Supabase request is intercepted and executed
// against the same real SQL as the database tests, with anon privileges.
const db = await createGuestTestDb();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const base = process.env.GAME_NIGHT_TEST_URL ?? "http://127.0.0.1:5173";
let queue = Promise.resolve();
let lostResponse = false;
let failOptions = false;
let faceFunctionMissing = false;
let authCalls = 0;
const errors = [];
function enqueue(action) {
  const result = queue.then(action);
  queue = result.catch(() => {});
  return result;
}
const faceEdge = await guestFaceEdge(
  (name, args) => enqueue(() => rpc(db, name, args)),
  (sql, args) => enqueue(() => db.query(sql, args)),
);

async function newPhone() {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    serviceWorkers: "block",
  });
  await context.route(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm/*",
    (route) => {
      const filename = new URL(route.request().url()).pathname
        .split("/")
        .at(-1);
      return route.fulfill({
        path: `node_modules/@mediapipe/tasks-vision/wasm/${filename}`,
      });
    },
  );
  await context.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.startsWith("/auth/")) authCalls++;
    if (
      path.startsWith("/functions/v1/game-night-guest-faces") &&
      faceFunctionMissing
    ) {
      return route.fulfill({
        status: 404,
        json: {
          code: "NOT_FOUND",
          message: "Requested function was not found",
        },
      });
    }
    if (
      path.startsWith("/functions/v1/game-night-guest-faces") ||
      path.startsWith("/storage/v1/")
    ) {
      const input = new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        ...(request.method() === "GET"
          ? {}
          : { body: request.postDataBuffer() }),
      });
      const response = path.startsWith("/functions/")
        ? await faceEdge.handle(input)
        : await faceEdge.storageRequest(input);
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    }
    const name = path.split("/").at(-1);
    if (!path.startsWith("/rest/v1/rpc/")) return route.fulfill({ json: [] });
    if (name === "game_night_guest_options" && failOptions)
      return route.abort("failed");
    // Serialize test role changes on the one WASM connection.
    const result = queue.then(() =>
      rpc(db, name, request.postDataJSON() ?? {}),
    );
    queue = result.catch(() => {});
    try {
      const data = await result;
      if (
        ["game_night_join_as_guest", "game_night_choose_guest_player"].includes(
          name,
        ) &&
        lostResponse
      ) {
        lostResponse = false;
        return route.abort("failed");
      }
      await route.fulfill({ json: data });
    } catch (error) {
      await route.fulfill({
        status: 400,
        json: { message: error.message, code: error.code },
      });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page };
}

async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "horizontal overflow",
  );
}

async function waitForFace(container) {
  const img = container.locator("img.gnv2-character-layer-photo").first();
  await img.waitFor();
  await img.evaluate((img) => img.decode());
  assert.equal(await img.evaluate((img) => img.naturalWidth), 512);
  assert.equal(await container.locator(".gnv2-guest-face").count(), 0);
}

async function addPhoto(page) {
  await page.getByRole("button", { name: "Foto maken of kiezen" }).click();
  await page
    .getByRole("button", { name: "Foto kiezen", exact: true })
    .waitFor();
  await page
    .locator('input[type="file"]:not([capture])')
    .setInputFiles("public/S&H-14-square.jpg");
  await page.getByRole("slider", { name: "Zoom" }).waitFor();
  for (const [width, height] of [
    [320, 568],
    [667, 375],
    [375, 812],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    await page
      .getByRole("button", { name: "Doorgaan", exact: true })
      .scrollIntoViewIfNeeded();
  }
  await page.getByRole("button", { name: "Doorgaan", exact: true }).click();
  await page
    .getByText("Pas je hoofdcontour aan (optioneel)", { exact: true })
    .waitFor({ timeout: 60000 });
  await noOverflow(page);
  await page.getByRole("button", { name: "Gebruiken", exact: true }).click();
  await page.getByText("Zo ziet je character eruit", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/game-night-guest-face-preview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Deze gebruiken", exact: true })
    .click();
  await page.getByRole("button", { name: "Gezichtsfoto aanpassen" }).waitFor();
  assert.equal(
    await page.locator('.gnv2-guest-preview img[src^="blob:"]').count(),
    1,
  );
}

try {
  const { page, context } = await newPhone();
  await page.goto(`${base}/#/game-night/join/invite-one`);
  await page.getByLabel("Hoe heet je?").waitFor();
  assert.equal(
    await page.locator('input[type="email"], input[type="password"]').count(),
    0,
  );
  await page.getByLabel("Hoe heet je?").fill("Stijn");
  assert.equal(await page.locator('input[name="guest-face"]').count(), 0);
  await page.getByRole("button", { name: "Foto maken of kiezen" }).click();
  await page.getByRole("button", { name: "Foto maken", exact: true }).waitFor();
  assert.equal(await page.locator('input[capture="user"]').count(), 1);
  await page.getByRole("button", { name: "Terug", exact: true }).click();
  assert.equal(await page.getByLabel("Hoe heet je?").inputValue(), "Stijn");
  await page.getByRole("radio", { name: "Blauw", exact: true }).check();
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [667, 375],
    [768, 1024],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    await page
      .getByRole("button", { name: "Aan tafel!", exact: true })
      .scrollIntoViewIfNeeded();
    assert.equal(await page.getByLabel("Hoe heet je?").inputValue(), "Stijn");
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "/tmp/game-night-guest-join.png",
    fullPage: true,
  });
  // The DB commits but the phone loses the response: reload must recover.
  lostResponse = true;
  await page.getByRole("button", { name: "Aan tafel!", exact: true }).click();
  await page.getByRole("alert").waitFor();
  const token = await page.evaluate(() =>
    localStorage.getItem("game-night-guest-v1"),
  );
  assert.match(token, /^[0-9a-f]{64}$/);
  await page.reload();
  await page.getByText("Je zit aan tafel", { exact: true }).waitFor();
  assert.equal(page.url(), `${base}/#/game-night/guest/${SESSION}`);
  await noOverflow(page);
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    1,
  );
  await page.reload();
  await page.getByRole("heading", { name: "Stijn", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("game-night-guest-v1")),
    token,
  );
  await page.getByRole("button", { name: "Naam en avatar aanpassen" }).click();
  await page.getByLabel("Hoe heet je?").fill("Stijn speelt mee");
  await addPhoto(page);
  // Match the production gateway response when the function is not deployed.
  // Activating it must allow retrying the same prepared photo, without a retake.
  faceFunctionMissing = true;
  await page.getByRole("button", { name: "Mijn speler opslaan" }).click();
  await page.getByRole("alert").waitFor();
  assert.match(
    await page.getByRole("alert").innerText(),
    /Gezichtsfoto’s zijn nog niet beschikbaar/,
  );
  assert.equal(faceEdge.files.size, 0, "no uploads before function deployment");
  assert.equal(
    await page.getByLabel("Hoe heet je?").inputValue(),
    "Stijn speelt mee",
  );
  faceFunctionMissing = false;
  faceEdge.failNextFaceUpload = true;
  await page.getByRole("button", { name: "Mijn speler opslaan" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: /uploaden mislukt/ })
    .waitFor();
  assert.match(await page.getByRole("alert").innerText(), /uploaden mislukt/);
  await page.getByRole("button", { name: "Mijn speler opslaan" }).click();
  await page
    .getByRole("heading", { name: "Stijn speelt mee", exact: true })
    .waitFor();
  await waitForFace(page.locator(".gnv2-guest-my-avatar"));
  await page.reload();
  await waitForFace(page.locator(".gnv2-guest-my-avatar"));

  const second = await newPhone();
  await second.page.goto(`${base}/#/game-night/join/invite-one`);
  await second.page
    .getByRole("button", { name: "Nieuwe speler maken" })
    .click();
  await second.page.getByLabel("Hoe heet je?").fill("Hannah");
  await addPhoto(second.page);
  await second.page
    .getByRole("button", { name: "Aan tafel!", exact: true })
    .click();
  await second.page.getByText("Je zit aan tafel", { exact: true }).waitFor();
  await waitForFace(second.page.locator(".gnv2-guest-my-avatar"));
  await page
    .locator(".gnv2-guest-roster")
    .getByText("Hannah", { exact: true })
    .waitFor({ timeout: 12000 });
  await page.screenshot({
    path: "/tmp/game-night-guest-lobby.png",
    fullPage: true,
  });
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    2,
  );
  assert.equal(authCalls, 0, "guest flow must not call Supabase Auth");

  await page.goto(`${base}/#/game-night/guest/${OTHER_SESSION}`);
  await page
    .getByRole("heading", { name: "Scan de QR-code om mee te doen" })
    .waitFor();
  assert.equal(await page.getByText("Hannah", { exact: true }).count(), 0);

  // An unrelated browser can select the existing player without a PIN,
  // while preserving exactly the same avatar, player ID and history.
  const recovery = await newPhone();
  await recovery.page.goto(`${base}/#/game-night/join/invite-one`);
  await recovery.page
    .getByRole("heading", { name: "Wie speelt er mee?" })
    .waitFor();
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [768, 1024],
    [1280, 800],
  ]) {
    await recovery.page.setViewportSize({ width, height });
    await noOverflow(recovery.page);
  }
  await recovery.page.setViewportSize({ width: 375, height: 812 });
  await waitForFace(
    recovery.page.getByRole("button", {
      name: "Verder als Stijn speelt mee",
      exact: true,
    }),
  );
  await recovery.page.screenshot({
    path: "/tmp/game-night-player-picker.png",
    fullPage: true,
  });
  lostResponse = true;
  await recovery.page
    .getByRole("button", { name: "Verder als Stijn speelt mee", exact: true })
    .click();
  await recovery.page.getByRole("alert").waitFor();
  await recovery.page.reload();
  await recovery.page.getByText("Je zit aan tafel", { exact: true }).waitFor();
  await waitForFace(recovery.page.locator(".gnv2-guest-my-avatar"));
  const recoveredToken = await recovery.page.evaluate(() =>
    localStorage.getItem("game-night-guest-v1"),
  );
  assert.notEqual(recoveredToken, token);
  const originalPlayer = await rpc(db, "game_night_guest_state", {
    p_guest_token: token,
    p_session_id: SESSION,
  });
  const recoveredPlayer = await rpc(db, "game_night_guest_state", {
    p_guest_token: recoveredToken,
    p_session_id: SESSION,
  });
  assert.deepEqual(recoveredPlayer.me, originalPlayer.me);
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    2,
  );
  // Next evening: one tap, no repeated form or overwritten avatar.
  await page.goto(`${base}/#/game-night/join/invite-two`);
  await page.getByText("Op dit apparaat", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Verder als Stijn speelt mee", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Andere avond", exact: true })
    .waitFor();
  await page.getByText("Je zit aan tafel", { exact: true }).waitFor();
  const nextNight = await rpc(db, "game_night_guest_state", {
    p_guest_token: token,
    p_session_id: OTHER_SESSION,
  });
  assert.deepEqual(nextNight.me, originalPlayer.me);
  await recovery.page.goto(`${base}/#/game-night/guest/${OTHER_SESSION}`);
  await recovery.page
    .getByRole("heading", { name: "Scan de QR-code om mee te doen" })
    .waitFor();
  assert.equal(authCalls, 0, "selection must not call Auth");
  await db.exec(
    "update public.game_night_join_tokens set revoked_at=now() where token='invite-one'",
  );
  await page.goto(`${base}/#/game-night/join/invite-one`);
  await page.getByText("Je zit aan tafel", { exact: true }).waitFor();
  const third = await newPhone();
  await third.page.goto(`${base}/#/game-night/join/invite-one`);
  await third.page
    .getByRole("heading", { name: "Deze uitnodiging is verlopen" })
    .waitFor();
  failOptions = true;
  await third.page.goto(`${base}/#/game-night/join/invite-two`);
  await third.page.getByRole("alert").waitFor();
  assert.equal(
    await third.page
      .getByRole("heading", { name: "Deze uitnodiging is verlopen" })
      .count(),
    0,
  );
  failOptions = false;
  await third.page.getByRole("button", { name: "Opnieuw proberen" }).click();
  await third.page.getByRole("button", { name: "Nieuwe speler maken" }).click();
  await third.page.getByLabel("Hoe heet je?").waitFor();
  // Denied storage must block joining before sending a create request.
  await third.page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await third.page.getByLabel("Hoe heet je?").fill("Blocked browser");
  await third.page
    .getByRole("button", { name: "Aan tafel!", exact: true })
    .click();
  await third.page.getByText(/Sta websiteopslag toe/).waitFor();
  assert.equal(
    (await db.query("select count(*)::int as n from public.game_night_players"))
      .rows[0].n,
    2,
  );
  assert.deepEqual(errors, []);
  await context.close();
  await second.context.close();
  await third.context.close();
  await recovery.context.close();
  console.log(
    "PASS mobile/desktop layout, saved player selection on another phone, next-night reuse, lost-response recovery, reload, avatar editing, polling, scoped access, expired QR, network retry and denied storage; no Auth calls.",
  );
} finally {
  await browser.close();
  await db.close();
}
