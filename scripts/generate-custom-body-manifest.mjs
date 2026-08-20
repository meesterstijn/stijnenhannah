#!/usr/bin/env node
// Game Night — automatische assetdiscovery voor custom bodies (slot 'base').
//
// Scant uitsluitend public/game-night/characters/parts/custom/base/ (geen
// recursie), valideert elk PNG-bestand (512×512, alfakanaal via de PNG-
// IHDR-header, geen sharp/image-processing nodig), en genereert twee
// bestanden:
//   1. src/features/game-night/generated/customBodyManifest.ts
//      — dev-tooling-spiegel (CharacterAssetQaGrid.tsx), NIET de bron voor
//        de live Creator (die blijft uitsluitend useCharacterParts()/
//        Supabase lezen — zie het opleverrapport, "geen tweede catalogus").
//   2. supabase/generated/game_night_custom_bodies.sql
//      — idempotente upsert-SQL, GEEN Supabase-migratie, GEEN databaseschrijf-
//        actie vanuit dit script zelf. De eigenaar past dit bestand handmatig
//        toe via zijn bestaande Supabase-workflow (SQL editor / CLI) — dit
//        script schrijft nooit rechtstreeks naar de database.
//
// Beide bestanden zijn GENEREERD — niet handmatig bewerken, gewoon opnieuw
// draaien (npm run game-night:generate-assets, of automatisch via de
// predev/prebuild-hooks in package.json).
//
// Alleen Node-builtins (fs/path/url) — geen nieuwe dependency, zie sectie
// 17 van de opdracht.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const SCAN_DIR_REL = "public/game-night/characters/parts/custom/base";
const SCAN_DIR = join(REPO_ROOT, SCAN_DIR_REL);
const ASSET_PATH_PREFIX = "/game-night/characters/parts/custom/base";

const TS_OUTPUT = join(
  REPO_ROOT,
  "src/features/game-night/generated/customBodyManifest.ts",
);
const SQL_OUTPUT = join(
  REPO_ROOT,
  "supabase/generated/game_night_custom_bodies.sql",
);

const EXPECTED_SIZE = 512;
// PNG-colorType: 6 = truecolor+alpha (RGBA), 4 = grayscale+alpha — beide
// hebben een alfakanaal in de header zelf, geen tRNS-chunk-scan nodig
// (zelfde check als handmatig gedaan voor de bestaande manbody*.png-batch,
// zie 20260921000000_game_night_character_custom_base_bodies.sql).
const ALPHA_CAPABLE_COLOR_TYPES = new Set([4, 6]);

const LEGACY_PATTERN = /^manbody(\d+)\.png$/;
const NEW_PATTERN = /^body-([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function readPngHeader(filePath) {
  // De IHDR-chunk is altijd de allereerste chunk in een geldige PNG en
  // heeft een vaste layout — 33 bytes volstaan (8 signature + 4 length +
  // 4 "IHDR" + 4 width + 4 height + 1 bitdepth + 1 colortype), dus we lezen
  // nooit het hele bestand voor validatie. Het bestand zelf wordt hier
  // alleen GELEZEN, nooit herschreven (sectie 16 van de opdracht).
  const fd = readFileSync(filePath).subarray(0, 33);
  if (fd.length < 33 || !fd.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { valid: false };
  }
  const chunkType = fd.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    return { valid: false };
  }
  const width = fd.readUInt32BE(16);
  const height = fd.readUInt32BE(20);
  const colorType = fd.readUInt8(25);
  return { valid: true, width, height, colorType };
}

function humanizeSlug(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const errors = [];

  if (!existsSync(SCAN_DIR)) {
    console.error(`Scanmap bestaat niet: ${SCAN_DIR_REL}`);
    process.exit(1);
  }

  const files = readdirSync(SCAN_DIR).filter((name) => {
    if (name.startsWith(".")) return false;
    return name.toLowerCase().endsWith(".png");
  });

  const legacyEntries = [];
  const newEntries = [];

  for (const file of files) {
    // Bestandsnaamconventie (sectie 4): body-<slug>.png (nieuw) of
    // manbody<N>.png (legacy, backwards-compat, niet automatisch hernoemd).
    const legacyMatch = file.match(LEGACY_PATTERN);
    const newMatch = file.match(NEW_PATTERN);

    if (!legacyMatch && !newMatch) {
      errors.push(
        `Ongeldige bestandsnaam: "${file}" — verwacht "body-<slug>.png" ` +
          `(lowercase, cijfers, koppeltekens) of het legacy-patroon ` +
          `"manbody<N>.png". Geen automatische hernoeming toegepast.`,
      );
      continue;
    }

    const filePath = join(SCAN_DIR, file);
    const header = readPngHeader(filePath);
    if (!header.valid) {
      errors.push(`"${file}" is geen geldig PNG-bestand (IHDR niet gevonden).`);
      continue;
    }
    if (header.width !== EXPECTED_SIZE || header.height !== EXPECTED_SIZE) {
      errors.push(
        `"${file}" is ${header.width}×${header.height}, expected ${EXPECTED_SIZE}×${EXPECTED_SIZE}.`,
      );
      continue;
    }
    if (!ALPHA_CAPABLE_COLOR_TYPES.has(header.colorType)) {
      errors.push(
        `"${file}" heeft geen alfakanaal (PNG colorType ${header.colorType}, ` +
          `verwacht 6 = RGBA of 4 = grayscale+alpha).`,
      );
      continue;
    }

    if (legacyMatch) {
      const n = Number(legacyMatch[1]);
      legacyEntries.push({
        key: `body-manbody-${String(n).padStart(2, "0")}`,
        label: `Body ${n}`,
        assetPath: `${ASSET_PATH_PREFIX}/${file}`,
        width: header.width,
        height: header.height,
        isLegacy: true,
        sortOrder: n,
        file,
      });
    } else {
      const slug = newMatch[1];
      newEntries.push({
        key: `body-${slug}`,
        label: humanizeSlug(slug),
        assetPath: `${ASSET_PATH_PREFIX}/${file}`,
        width: header.width,
        height: header.height,
        isLegacy: false,
        sortOrder: null, // hieronder toegekend na alfabetisch sorteren
        file,
      });
    }
  }

  newEntries.sort((a, b) => a.key.localeCompare(b.key));
  newEntries.forEach((entry, i) => {
    // Ruim boven het legacy-bereik (2–12 vandaag) zodat nieuwe en legacy
    // bodies elkaars sort_order nooit overlappen, ook als er ooit een
    // manbody50.png bijkomt.
    entry.sortOrder = 1000 + i;
  });

  legacyEntries.sort((a, b) => a.sortOrder - b.sortOrder);

  const allEntries = [...legacyEntries, ...newEntries];

  // Duplicate-keydetectie (paranoia — zou alleen kunnen bij bv. zowel
  // manbody02.png als manbody2.png tegelijk, die tot dezelfde key
  // herleiden) en duplicate-assetPath (praktisch onmogelijk binnen één
  // map met unieke bestandsnamen, maar expliciet gecontroleerd i.p.v.
  // aangenomen).
  const seenKeys = new Map();
  const seenPaths = new Map();
  for (const entry of allEntries) {
    if (seenKeys.has(entry.key)) {
      errors.push(
        `Duplicate key "${entry.key}": zowel "${seenKeys.get(entry.key)}" als "${entry.file}" leiden tot dezelfde key.`,
      );
    } else {
      seenKeys.set(entry.key, entry.file);
    }
    if (seenPaths.has(entry.assetPath)) {
      errors.push(`Duplicate asset_path "${entry.assetPath}".`);
    } else {
      seenPaths.set(entry.assetPath, entry.file);
    }
  }

  if (errors.length > 0) {
    console.error(
      `\ngenerate-custom-body-manifest: ${errors.length} fout(en) gevonden in ${SCAN_DIR_REL}\n`,
    );
    for (const err of errors) console.error(`  ✗ ${err}`);
    console.error("\nBuild afgebroken — geen bestanden gegenereerd.\n");
    process.exit(1);
  }

  // ── 1. TS-manifest (dev-tooling-spiegel, zie bestandskop) ────────────────
  mkdirSync(dirname(TS_OUTPUT), { recursive: true });
  const tsLines = [
    "// GEGENEREERD BESTAND — niet handmatig bewerken.",
    "// Bron: scripts/generate-custom-body-manifest.mjs, gescande map:",
    `// ${SCAN_DIR_REL}/`,
    "//",
    "// Uitsluitend dev-tooling (CharacterAssetQaGrid.tsx, manifest/DB-",
    "// mismatchrapport) — de live Character Creator blijft de catalogus",
    "// exclusief via useCharacterParts()/Supabase lezen, dit bestand is GEEN",
    "// tweede databron voor de app zelf.",
    "",
    "export type CustomBodyManifestEntry = {",
    "  key: string;",
    "  label: string;",
    '  slot: "base";',
    "  assetPath: string;",
    "  width: 512;",
    "  height: 512;",
    "  isLegacy: boolean;",
    "  sortOrder: number;",
    "  // V1: elke custom body is meteen starter/actief (zie opleverrapport",
    "  // sectie 13/15). Bewust al hier gemodelleerd als velden i.p.v. een",
    "  // aparte aanname, zodat een latere unlock-uitbreiding (isStarter:",
    "  // false + unlockKey) geen structuurwijziging is.",
    "  isStarter: boolean;",
    "  unlockKey?: string;",
    "};",
    "",
    "export const CUSTOM_BODY_MANIFEST: readonly CustomBodyManifestEntry[] = [",
    ...allEntries.map(
      (e) =>
        `  { key: ${JSON.stringify(e.key)}, label: ${JSON.stringify(e.label)}, slot: "base", assetPath: ${JSON.stringify(e.assetPath)}, width: 512, height: 512, isLegacy: ${e.isLegacy}, sortOrder: ${e.sortOrder}, isStarter: true },`,
    ),
    "] as const;",
    "",
  ];
  writeFileSync(TS_OUTPUT, tsLines.join("\n"), "utf8");

  // ── 2. Idempotente upsert-SQL (GEEN migratie, zie bestandskop) ───────────
  mkdirSync(dirname(SQL_OUTPUT), { recursive: true });
  const layerOrder = 20; // 'base'-conventie, zie gameNightCharacter.ts DEFAULT_SLOT_LAYER_ORDER
  const valuesLines = allEntries.map((e) => {
    return `  (${sqlString(e.key)}, 'base', ${sqlString(e.label)}, ${sqlString(e.assetPath)}, ${layerOrder}, true, 'common', true, ${e.sortOrder})`;
  });
  const keyListForDeactivation = allEntries
    .map((e) => sqlString(e.key))
    .join(", ");

  const sqlLines = [
    "-- GEGENEREERD BESTAND — niet handmatig bewerken, niet in",
    "-- supabase/migrations/ plaatsen (zie opleverrapport sectie 7/8: dit is",
    "-- GEEN Supabase-migratie, geen timestamped historie-entry — regenereer",
    "-- het opnieuw met `npm run game-night:generate-assets` en pas het",
    "-- daarna handmatig toe via je bestaande Supabase-workflow, bv.:",
    "--   supabase db execute -f supabase/generated/game_night_custom_bodies.sql",
    "-- of plak de inhoud in de Supabase SQL editor. Niets in dit script/",
    "-- bestand schrijft zelf naar de database.",
    "--",
    "-- Scope (sectie 11): raakt UITSLUITEND rijen met key like 'body-%' EN",
    "-- asset_path like '/game-night/characters/parts/custom/base/%' — nooit",
    "-- andere slots of andere starter-rijen.",
    "--",
    "-- Managed-by-manifest-velden (sectie 9):",
    "--   bij INSERT:      key, slot, label, asset_path, layer_order,",
    "--                    is_starter, active, rarity, sort_order",
    "--   bij UPDATE:      alleen asset_path, slot, layer_order, sort_order —",
    "--                    label/is_starter/active worden NA de eerste insert",
    "--                    nooit meer overschreven (owner-managed vanaf dan),",
    "--                    zodat een handmatige labelverbetering of bewuste",
    "--                    deactivatie nooit stilzwijgend teruggedraaid wordt.",
    "--   bij ontbrekend bestand: uitsluitend active = false (zie onderaan) —",
    "--                    nooit een DELETE (FK/equipment-historie blijft intact).",
    "",
    "insert into public.game_night_character_parts",
    "  (key, slot, label, asset_path, layer_order, is_starter, rarity, active, sort_order)",
    "values",
    valuesLines.join(",\n") + "",
    "on conflict (key) do update set",
    "  asset_path = excluded.asset_path,",
    "  slot = excluded.slot,",
    "  layer_order = excluded.layer_order,",
    "  sort_order = excluded.sort_order;",
    "",
    "-- Bestand-verwijderd-pad (sectie 10): een PNG die niet meer in de",
    "-- huidige scan zit, mag NOOIT een hard delete triggeren (FK/equipment-",
    "-- historie) — uitsluitend deactiveren. Gescopet tot exact dezelfde",
    "-- key-prefix + asset_path-prefix als hierboven.",
    "update public.game_night_character_parts",
    "set active = false",
    "where key like 'body-%'",
    `  and asset_path like ${sqlString(`${ASSET_PATH_PREFIX}/%`)}`,
    keyListForDeactivation.length > 0
      ? `  and key not in (${keyListForDeactivation})`
      : "  and true -- (geen enkel bestand meer aanwezig, dus alle managed rijen deactiveren)",
    "  and active = true;",
    "",
    "-- Controle na toepassen:",
    "-- select key, label, active, sort_order from public.game_night_character_parts",
    "-- where key like 'body-%' order by sort_order;",
    "",
  ];
  writeFileSync(SQL_OUTPUT, sqlLines.join("\n"), "utf8");

  console.log(
    `generate-custom-body-manifest: ${allEntries.length} custom body(s) gevonden ` +
      `(${legacyEntries.length} legacy, ${newEntries.length} nieuw) in ${SCAN_DIR_REL}/`,
  );
  console.log(
    `  → ${TS_OUTPUT.replace(REPO_ROOT + "\\", "").replace(REPO_ROOT + "/", "")}`,
  );
  console.log(
    `  → ${SQL_OUTPUT.replace(REPO_ROOT + "\\", "").replace(REPO_ROOT + "/", "")}`,
  );
}

main();
