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
// ── Naamconventie-migratie (man/vrouw-canonicalisering) ──────────────────
// Canonical vanaf nu: body-man-<slug>.png / body-vrouw-<slug>.png. Het oude
// manbody<N>.png-patroon wordt nog TIJDELIJK herkend voor backwards-
// compatibility (produceert nog altijd de historische body-manbody-<NN>-key,
// nooit stilzwijgend geremapt naar een canonical key door dit script — die
// eenmalige remap gebeurt bewust via een aparte, expliciete Supabase-
// migratie, zie supabase/migrations/20260923000000_game_night_character_
// manbody_canonical_rename.sql), maar levert een duidelijke waarschuwing op.
// Elk ander `body-*.png`-bestand zonder man-/vrouw-prefix is vanaf nu
// ONGELDIG (harde build-fout) — de oude, gender-loze `body-<slug>.png`-
// conventie is vervangen door de gendered variant.
//
// Beide gegenereerde bestanden zijn GENEREERD — niet handmatig bewerken,
// gewoon opnieuw draaien (npm run game-night:generate-assets, of automatisch
// via de predev/prebuild-hooks in package.json).
//
// Alleen Node-builtins (fs/path/url) — geen nieuwe dependency.

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
// hebben een alfakanaal in de header zelf, geen tRNS-chunk-scan nodig.
const ALPHA_CAPABLE_COLOR_TYPES = new Set([4, 6]);

// Legacy — backwards-compat, geen nieuwe assets meer in deze vorm.
const LEGACY_PATTERN = /^manbody(\d+)\.png$/;
// Canonical — body-man-<slug>.png / body-vrouw-<slug>.png.
const CANONICAL_PATTERN = /^body-(man|vrouw)-([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/;
// Puur-numerieke slug (tijdelijke fallback-naam, sectie "temporary" in de
// opdracht, bv. body-man-13.png) — deze krijgen een genderwoord terug in
// hun label ("Man 13"), een beschrijvende slug ("catan") juist niet.
const NUMERIC_SLUG = /^\d+$/;

const GENDER_WORD = { man: "Man", vrouw: "Vrouw" };
const GENDER_VALUE = { man: "male", vrouw: "female" };

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function readPngHeader(filePath) {
  // De IHDR-chunk is altijd de allereerste chunk in een geldige PNG en
  // heeft een vaste layout — 33 bytes volstaan, dus we lezen nooit het hele
  // bestand voor validatie. Het bestand zelf wordt hier alleen GELEZEN,
  // nooit herschreven.
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

// Sectie 6: het technische body-man-/body-vrouw--prefix verdwijnt altijd uit
// het label. Voor een puur-numerieke fallback-slug (nog geen beschrijvende
// naam bedacht) blijft het genderwoord ALSNOG in het label staan ("Man 13"),
// anders zou de tegel in de Creator alleen "13" tonen — voor een
// beschrijvende slug ("catan") verdwijnt het genderwoord volledig, precies
// zoals de opdracht voorschrijft.
function deriveLabel(genderKey, slug) {
  if (NUMERIC_SLUG.test(slug)) {
    return `${GENDER_WORD[genderKey]} ${slug}`;
  }
  return humanizeSlug(slug);
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function main() {
  const errors = [];
  const warnings = [];

  if (!existsSync(SCAN_DIR)) {
    console.error(`Scanmap bestaat niet: ${SCAN_DIR_REL}`);
    process.exit(1);
  }

  const files = readdirSync(SCAN_DIR).filter((name) => {
    if (name.startsWith(".")) return false;
    return name.toLowerCase().endsWith(".png");
  });

  const legacyEntries = [];
  // Canonical wordt in twee subgroepen opgebouwd zodat de sort_order-regels
  // (sectie 11) apart kunnen worden toegepast: numerieke fallback-namen
  // behouden hun nummer als sort_order (net als de oude legacy-rijen),
  // beschrijvende namen krijgen een eigen, ruim gescheiden band.
  const canonicalNumeric = [];
  const canonicalDescriptive = [];

  for (const file of files) {
    const legacyMatch = file.match(LEGACY_PATTERN);
    const canonicalMatch = file.match(CANONICAL_PATTERN);

    if (!legacyMatch && !canonicalMatch) {
      errors.push(
        `Ongeldige bestandsnaam: "${file}" — verwacht "body-man-<slug>.png" ` +
          `of "body-vrouw-<slug>.png" (lowercase, cijfers, koppeltekens). ` +
          `Het oude, gender-loze "body-<slug>.png"-patroon is niet meer ` +
          `geldig; het legacy-patroon "manbody<N>.png" wordt nog tijdelijk ` +
          `herkend (zie de waarschuwing hierboven als dat de oorzaak is).`,
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
      warnings.push(
        `"${file}" gebruikt nog de legacy-naamconventie "manbody<N>.png" ` +
          `— hernoem naar "body-man-${legacyMatch[1]}.png" en pas de ` +
          `canonical-rename-migratie toe zodra dat praktisch uitkomt. ` +
          `Nieuwe assets moeten altijd meteen canonical genoemd worden.`,
      );
      const n = Number(legacyMatch[1]);
      legacyEntries.push({
        key: `body-manbody-${String(n).padStart(2, "0")}`,
        label: `Body ${n}`,
        assetPath: `${ASSET_PATH_PREFIX}/${file}`,
        width: header.width,
        height: header.height,
        isLegacy: true,
        gender: "male", // legacy manbody* was altijd de mannelijke set.
        sortOrder: n,
        file,
      });
      continue;
    }

    const genderKey = canonicalMatch[1]; // "man" | "vrouw"
    const slug = canonicalMatch[2];
    const entry = {
      key: `body-${genderKey}-${slug}`,
      label: deriveLabel(genderKey, slug),
      assetPath: `${ASSET_PATH_PREFIX}/${file}`,
      width: header.width,
      height: header.height,
      isLegacy: false,
      gender: GENDER_VALUE[genderKey],
      sortOrder: null,
      file,
    };
    if (NUMERIC_SLUG.test(slug)) {
      entry.sortOrder = Number(slug);
      canonicalNumeric.push(entry);
    } else {
      canonicalDescriptive.push(entry);
    }
  }

  canonicalDescriptive.sort((a, b) => a.key.localeCompare(b.key));
  canonicalDescriptive.forEach((entry, i) => {
    // Ruim boven het grootste realistische numerieke-fallbackbereik, zodat
    // beschrijvende en numerieke canonical-bodies elkaars sort_order nooit
    // overlappen.
    entry.sortOrder = 10000 + i;
  });

  legacyEntries.sort((a, b) => a.sortOrder - b.sortOrder);
  canonicalNumeric.sort((a, b) => a.sortOrder - b.sortOrder);

  const allEntries = [
    ...legacyEntries,
    ...canonicalNumeric,
    ...canonicalDescriptive,
  ];

  // Duplicate-keydetectie (paranoia — zou kunnen bij bv. zowel
  // manbody02.png als een canonical body-man-02.png tegelijk) en
  // duplicate-assetPath (praktisch onmogelijk binnen één map met unieke
  // bestandsnamen, maar expliciet gecontroleerd i.p.v. aangenomen).
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

  if (warnings.length > 0) {
    console.warn(
      `\ngenerate-custom-body-manifest: ${warnings.length} waarschuwing(en)\n`,
    );
    for (const warning of warnings) console.warn(`  ⚠ ${warning}`);
    console.warn("");
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
    "  // Afgeleid uit de bestandsnaamconventie (body-man-*/body-vrouw-*, of",
    '  // "male" voor legacy manbody*.png) — puur metadata voor filtering/UI,',
    "  // geen aparte DB-kolom nodig zolang dit uit de key af te leiden blijft.",
    '  gender: "male" | "female";',
    "  sortOrder: number;",
    "  // V1: elke custom body is meteen starter/actief. Bewust al hier",
    "  // gemodelleerd als velden i.p.v. een aparte aanname, zodat een latere",
    "  // unlock-uitbreiding (isStarter: false + unlockKey) geen",
    "  // structuurwijziging is.",
    "  isStarter: boolean;",
    "  unlockKey?: string;",
    "};",
    "",
    "export const CUSTOM_BODY_MANIFEST: readonly CustomBodyManifestEntry[] = [",
    ...allEntries.map(
      (e) =>
        `  { key: ${JSON.stringify(e.key)}, label: ${JSON.stringify(e.label)}, slot: "base", assetPath: ${JSON.stringify(e.assetPath)}, width: 512, height: 512, isLegacy: ${e.isLegacy}, gender: ${JSON.stringify(e.gender)}, sortOrder: ${e.sortOrder}, isStarter: true },`,
    ),
    "] as const;",
    "",
  ];
  writeFileSync(TS_OUTPUT, tsLines.join("\n"), "utf8");

  // ── 2. Idempotente upsert-SQL (GEEN migratie, zie bestandskop) ───────────
  // Sectie 9: uitsluitend canonical body-man-*/body-vrouw--rijen worden hier
  // beheerd. Legacy body-manbody-* rijen worden door dit gegenereerde
  // bestand NOOIT aangeraakt (niet opnieuw geactiveerd, niet opnieuw
  // ge-upsert) — die worden ÉÉNMALIG, bewust, door de aparte Supabase-
  // migratie gedeactiveerd (20260923000000_game_night_character_manbody_
  // canonical_rename.sql). Zou dit script legacy-rijen blijven upserten,
  // dan zou een owner die een legacy-rij bewust deactiveerde dat bij een
  // volgende sync weer ongedaan kunnen zien worden — expliciet ongewenst.
  mkdirSync(dirname(SQL_OUTPUT), { recursive: true });
  const layerOrder = 20; // 'base'-conventie, zie gameNightCharacter.ts DEFAULT_SLOT_LAYER_ORDER
  const canonicalEntries = [...canonicalNumeric, ...canonicalDescriptive];
  const valuesLines = canonicalEntries.map((e) => {
    return `  (${sqlString(e.key)}, 'base', ${sqlString(e.label)}, ${sqlString(e.assetPath)}, ${layerOrder}, true, 'common', true, ${e.sortOrder})`;
  });
  const keyListForDeactivation = canonicalEntries
    .map((e) => sqlString(e.key))
    .join(", ");

  const sqlLines = [
    "-- GEGENEREERD BESTAND — niet handmatig bewerken, niet in",
    "-- supabase/migrations/ plaatsen — dit is GEEN Supabase-migratie, geen",
    "-- timestamped historie-entry. Regenereer het opnieuw met",
    "-- `npm run game-night:generate-assets` en pas het daarna handmatig toe",
    "-- via je bestaande Supabase-workflow, bv.:",
    "--   supabase db execute -f supabase/generated/game_night_custom_bodies.sql",
    "-- of plak de inhoud in de Supabase SQL editor. Niets in dit script/",
    "-- bestand schrijft zelf naar de database.",
    "--",
    "-- Scope: raakt UITSLUITEND CANONICAL rijen — key like 'body-man-%' OF",
    "-- 'body-vrouw-%', EN asset_path like '/game-night/characters/parts/",
    "-- custom/base/%'. Legacy 'body-manbody-%'-rijen worden hier NOOIT",
    "-- aangeraakt (niet geupsert, niet gereactiveerd) — die worden eenmalig",
    "-- door supabase/migrations/20260923000000_game_night_character_manbody_",
    "-- canonical_rename.sql gedeactiveerd. Andere slots blijven ongemoeid.",
    "--",
    "-- Managed-by-manifest-velden:",
    "--   bij INSERT:      key, slot, label, asset_path, layer_order,",
    "--                    is_starter, active, rarity, sort_order",
    "--   bij UPDATE:      alleen asset_path, slot, layer_order, sort_order —",
    "--                    label/is_starter/active worden NA de eerste insert",
    "--                    nooit meer overschreven (owner-managed vanaf dan).",
    "--   bij ontbrekend bestand: uitsluitend active = false (zie onderaan) —",
    "--                    nooit een DELETE (FK/equipment-historie blijft intact).",
    "",
  ];

  if (valuesLines.length > 0) {
    sqlLines.push(
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
    );
  } else {
    sqlLines.push(
      "-- Geen canonical body-man-*/body-vrouw--bestanden gevonden — geen insert nodig.",
      "",
    );
  }

  sqlLines.push(
    "-- Bestand-verwijderd-pad: een canonical PNG die niet meer in de huidige",
    "-- scan zit, mag NOOIT een hard delete triggeren (FK/equipment-",
    "-- historie) — uitsluitend deactiveren. Gescopet tot canonical",
    "-- key-prefixen + hetzelfde asset_path-prefix als hierboven.",
    "update public.game_night_character_parts",
    "set active = false",
    "where (key like 'body-man-%' or key like 'body-vrouw-%')",
    `  and asset_path like ${sqlString(`${ASSET_PATH_PREFIX}/%`)}`,
    keyListForDeactivation.length > 0
      ? `  and key not in (${keyListForDeactivation})`
      : "  and true -- (geen enkel canonical bestand meer aanwezig)",
    "  and active = true;",
    "",
    "-- Controle na toepassen (gender is niet in de database opgeslagen,",
    "-- alleen afgeleid uit de key-prefix — zie deriveCustomBodyGender()):",
    "-- select key, label, active, sort_order from public.game_night_character_parts",
    "-- where key like 'body-man-%' or key like 'body-vrouw-%' order by sort_order;",
    "",
  );
  writeFileSync(SQL_OUTPUT, sqlLines.join("\n"), "utf8");

  console.log(
    `generate-custom-body-manifest: ${allEntries.length} custom body(s) gevonden ` +
      `(${legacyEntries.length} legacy, ${canonicalEntries.length} canonical) in ${SCAN_DIR_REL}/`,
  );
  console.log(
    `  → ${TS_OUTPUT.replace(REPO_ROOT + "\\", "").replace(REPO_ROOT + "/", "")}`,
  );
  console.log(
    `  → ${SQL_OUTPUT.replace(REPO_ROOT + "\\", "").replace(REPO_ROOT + "/", "")}`,
  );
}

main();
