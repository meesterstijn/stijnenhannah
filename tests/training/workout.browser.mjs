// Browsertest van de trainingsmodule op telefoonformaat, volledig offline:
// Supabase is geblokkeerd en de app draait op een opgeslagen (verlopen)
// owner-sessie, dus alles gaat via de lokale database. Raakt nooit
// productie. Vereist een build: `npm run build && npm run training:test-browser`.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(tmpdir(), "training-browser-test");
await mkdir(output, { recursive: true });
const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const UID = "e0000000-0000-4000-8000-0000000000e1";

const server = spawn(
  "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  {
    cwd: root,
    shell: true,
    stdio: "ignore",
  },
);
const stop = () => {
  if (process.platform === "win32")
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      shell: true,
    });
  else server.kill();
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // nog niet klaar
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview-server start niet");
}

const steps = [];
const step = (name) => {
  steps.push(name);
  console.log(`✓ ${name}`);
};

try {
  await waitForServer();
  // Eigen Playwright-browser als die er is, anders de geïnstalleerde Chrome.
  const browser = await chromium
    .launch()
    .catch(() => chromium.launch({ channel: "chrome" }));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  await context.route(/supabase\.co/, (route) => route.abort());
  await context.addInitScript(
    ([uid]) => {
      if (localStorage.getItem("test-init")) return;
      localStorage.setItem("test-init", "1");
      localStorage.setItem(
        "sb-lrqivcfuiuskqkpmyxfo-auth-token",
        JSON.stringify({
          access_token: "x",
          refresh_token: "y",
          expires_at: 1,
          token_type: "bearer",
          user: { id: uid },
        }),
      );
      localStorage.setItem(
        `auth:last-profile:${uid}`,
        JSON.stringify({ id: uid, display_name: "Test", app_role: "owner" }),
      );
    },
    [UID],
  );
  const page = await context.newPage();
  globalThis.__page = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const noHorizontalScroll = async (label) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(overflow <= 1, `${label}: horizontale scroll (${overflow}px)`);
  };

  await page.goto(`${BASE}/#/training`);
  await page.getByRole("heading", { name: "Vandaag" }).waitFor();
  await page.getByRole("link", { name: "Schema kiezen" }).waitFor();
  await noHorizontalScroll("dashboard leeg");
  step("dashboard zonder schema");

  await page.goto(`${BASE}/#/training/schemas`);
  await page
    .getByRole("button", { name: "Kiezen", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Dit schema gebruiken" }).click();
  await page.getByRole("button", { name: "Start training" }).waitFor();
  await page.screenshot({
    path: join(output, "1-dashboard.png"),
    fullPage: true,
  });
  await noHorizontalScroll("dashboard");
  step("programma selecteren");

  await page.getByRole("button", { name: "Start training" }).click();
  await page.waitForURL(/#\/training\/workout/);
  const setButton = page.locator(".tr-set-button");
  await setButton.waitFor();
  assert.match(await setButton.innerText(), /Kies eerst een gewicht/);
  assert.equal(await setButton.isDisabled(), true);
  step("training starten (nieuwe oefening vraagt eerst een gewicht)");

  // Gewicht handmatig verhogen
  const plus = page.getByRole("button", { name: /^Gewicht plus/ });
  for (let i = 0; i < 6; i++) await plus.click();
  await page.waitForFunction(() =>
    /12 kg/.test(document.querySelector(".tr-set-button")?.textContent ?? ""),
  );
  assert.match(await setButton.innerText(), /OPWARMSET 1 VOLTOOID/);
  await page.screenshot({
    path: join(output, "2-workout.png"),
    fullPage: true,
  });
  await noHorizontalScroll("workout");
  step("gewicht verhogen met plusknop");

  // Eén tik: set opgeslagen + rusttimer
  await setButton.dblclick(); // dubbel tikken mag maar één set opleveren
  await page.getByRole("timer").waitFor();
  await page.screenshot({ path: join(output, "3-rust.png"), fullPage: true });
  const timer1 = await page.getByRole("timer").innerText();
  await page.waitForTimeout(2100);
  const timer2 = await page.getByRole("timer").innerText();
  assert.notEqual(timer1, timer2, "timer loopt af");
  step(`set met één tik + rusttimer (${timer1} → ${timer2})`);

  await page.getByRole("button", { name: "15 seconden langer" }).click();
  await page.getByRole("button", { name: "Pauzeren" }).click();
  await page.getByText("Gepauzeerd").waitFor();
  await page.getByRole("button", { name: "Hervatten" }).click();
  step("rusttimer pauzeren, hervatten, +15");

  // Herladen: training en timer blijven
  await page.reload();
  await page.getByRole("timer").waitFor();
  step("herladen tijdens rust: timer correct hersteld");
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  await setButton.waitFor();
  assert.match(await setButton.innerText(), /OPWARMSET 2/);
  const progressText = await page.locator("header").first().innerText();
  step(
    `volgende set klaar na rust (${progressText.split("\n").find((l) => l.includes("werksets"))})`,
  );

  // Werksets van de eerste oefening: nog geen historie, dus eerst zelf een
  // gewicht kiezen (de app verzint niets). Daarna gaat het vanzelf mee.
  await setButton.click(); // opwarmset 2
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  assert.match(await setButton.innerText(), /Kies eerst een gewicht/);
  for (let i = 0; i < 10; i++) await plus.click();
  await page.waitForFunction(() =>
    /20 kg/.test(document.querySelector(".tr-set-button")?.textContent ?? ""),
  );
  for (let i = 0; i < 3; i++) {
    assert.match(await setButton.innerText(), /20 kg/);
    await setButton.click();
    const skip = page.getByRole("button", { name: "Rust overslaan" });
    await skip.waitFor();
    await skip.click();
  }
  const doneDots = await page.locator('.tr-set-row[data-state="done"]').count();
  step(`sets afronden (${doneDots} voltooid zichtbaar)`);

  // Sitebreed thema mag Training niet veranderen
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-ht-scheme", "dark"),
  );
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(() =>
      document.querySelector(".training-theme")?.getAttribute("data-tr-scheme"),
    ),
    "light",
  );
  await page.evaluate(() =>
    document.documentElement.removeAttribute("data-ht-scheme"),
  );
  step("sitebreed thema verandert Training niet");

  // Afronden
  await page.getByRole("button", { name: "Trainingsmenu" }).click();
  await page.getByRole("button", { name: "Training afronden" }).first().click();
  await page.getByRole("button", { name: "Opslaan en afronden" }).click();
  await page.getByText("Training opgeslagen.").waitFor();
  await page.screenshot({
    path: join(output, "5-samenvatting.png"),
    fullPage: true,
  });
  step("training opslaan");

  // Volgende keer: vorige prestaties zijn de opdracht
  await page
    .getByRole("button", { name: "Deze training opnieuw doen" })
    .click();
  await page.waitForURL(/#\/training\/workout/);
  await page.getByText("Vorige keer").first().waitFor();
  const previous = await page
    .locator(".tr-card-flat")
    .filter({ hasText: "Vorige keer" })
    .first()
    .innerText();
  assert.match(previous, /20 kg × 6/);
  assert.match(await setButton.innerText(), /12 kg × 8/); // opwarmset zoals vorige keer
  step("volgende training neemt vorige gewichten en reps over");

  await page.goto(`${BASE}/#/training/schijven`);
  await page.getByLabel("Doelgewicht totaal").fill("60");
  await page.getByText(/nog onbekend/).waitFor();
  await page.getByLabel("Gewicht lange stang").fill("20");
  await page.getByRole("button", { name: "Bewaar" }).click();
  await page
    .getByText(/1 × 10 kg \+ 2 × 5 kg/)
    .first()
    .waitFor();
  await noHorizontalScroll("schijven");
  await page.screenshot({
    path: join(output, "6-schijven.png"),
    fullPage: true,
  });
  step("schijvencalculator (stanggewicht vragen en verdeling)");

  // Eigen donkere weergave van Training
  await page.goto(`${BASE}/#/training/instellingen`);
  await page.getByRole("button", { name: "Donker", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".training-theme")
        ?.getAttribute("data-tr-scheme") === "dark",
  );
  await page.goto(`${BASE}/#/training`);
  await page.screenshot({
    path: join(output, "8-dashboard-donker.png"),
    fullPage: true,
  });
  await page.goto(`${BASE}/#/training/instellingen`);
  await page.getByRole("button", { name: "Licht", exact: true }).click();
  step("eigen donkere weergave in Training");

  for (const path of [
    "voortgang",
    "oefeningen",
    "historie",
    "lichaam",
    "instellingen",
    "bibliotheek",
    "meer",
  ]) {
    await page.goto(`${BASE}/#/training/${path}`);
    await page.locator("h1").first().waitFor();
    await noHorizontalScroll(path);
  }
  await page.goto(`${BASE}/#/training/voortgang`);
  await page.screenshot({
    path: join(output, "7-voortgang.png"),
    fullPage: true,
  });
  step("alle pagina's laden zonder horizontale scroll");

  await page.goto(`${BASE}/#/`);
  await page
    .getByRole("link", { name: /Training/ })
    .first()
    .waitFor();
  step("tegel Training op de homepage");

  assert.deepEqual(errors, [], `paginafouten: ${errors.join("\n")}`);
  await browser.close();
  console.log(`\n${steps.length} stappen geslaagd. Screenshots: ${output}`);
} catch (error) {
  await globalThis.__page
    ?.screenshot({ path: join(output, "fout.png"), fullPage: true })
    .catch(() => {});
  console.log("Screenshot bij fout:", join(output, "fout.png"));
  console.log(
    (
      await globalThis.__page
        ?.locator("main, body")
        .first()
        .innerText()
        .catch(() => "")
    )?.slice(0, 1500),
  );
  throw error;
} finally {
  stop();
}
