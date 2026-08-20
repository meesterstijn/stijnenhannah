# Status-update — Photoshop-workflow (na V2.9E)

De automatisch uitgesneden/genormaliseerde V2.9E-pixel-art-batch (sectie
"V2.9E" hieronder) is **afgekeurd en verwijderd**. De bijbehorende
`public/game-night/characters/parts/v2/`-map bestaat niet meer, en alle
catalogus-rijen die ernaar wezen zijn gedeactiveerd (`active = false`, zie
`supabase/migrations/20260917000000_game_night_character_v2_deactivate_extracted_batch.sql`)
— niet hard verwijderd, om bestaande equipment-/unlock-historie van spelers
niet te beschadigen.

Nieuwe artwork wordt vanaf nu **handgetekend in Photoshop** aangeleverd en
1-op-1 als laag gebruikt (geen automatische crop/scale/matting/reconstructie
meer). Elke toekomstige asset is:

- exact **128×128px**, PNG, transparante achtergrond;
- al correct gepositioneerd en pixel-perfect uitgelijnd (geen per-asset
  code-offsets — alignment komt uit het bronbestand zelf, zelfde harde eis
  als de V2.9E-sectie hieronder al stelde).

**Mapstructuur voor deze nieuwe assets** (hergebruikt de bestaande,
slot-gebaseerde indeling — geen tweede assetsysteem):

```
public/game-night/characters/parts/custom/
  base/  clothing/  eyes/  eyebrows/  mouth/  facial-hair/
  hair/  glasses/  headwear/  arms/  props/  foreground-effects/
```

Nog leeg (met `.gitkeep` per map) — plaats hier de PNG's en registreer ze
daarna via een nieuwe, additieve migratie (zelfde patroon als
`20260915010000_game_night_character_v2_seed.sql`, maar met
`asset_path`-waarden onder `.../parts/custom/...` i.p.v. `.../parts/v2/...`).
Zodra een rij `active = true` heeft en het bestand op zijn pad staat, pakt
de app het automatisch op — geen codewijziging nodig. De QA-pagina
(`/game-night/dev/character-qa`, zie `CharacterAssetQaGrid.tsx`) leest de
live catalogus rechtstreeks (ook inactieve rijen) en toont per onderdeel:
los, op de man-base, op de vrouw-base (waar van toepassing), key, slot,
128×128-validatie en actief/inactief-status — zonder dat deze pagina zelf
nog per asset hoeft te worden aangepast.

**Uitzondering — `custom/base/` heeft sinds de asset-automatiseringsronde
géén handmatige migratie per PNG meer nodig.** Een PNG in
`custom/base/` toevoegen (512×512, alfakanaal, bestandsnaam
`body-<slug>.png`) is voldoende: `npm run game-night:generate-assets`
(automatisch via de `predev`/`prebuild`-hooks) scant de map, valideert elk
bestand en genereert `supabase/generated/game_night_custom_bodies.sql` — een
idempotente upsert die je zelf, buiten dit script om, via je bestaande
Supabase-workflow toepast (dit script schrijft nooit rechtstreeks naar de
database). Zie `scripts/generate-custom-body-manifest.mjs` voor de volledige
logica en `supabase/migrations/20260921000000_game_night_character_custom_base_bodies.sql`
voor de al-toegepaste legacy-batch (`manbody*.png`, blijft ondersteund naast
de nieuwe `body-*.png`-conventie). De overige `custom/`-submappen
(`clothing/`, `eyes/`, enz.) volgen dit patroon nog NIET — die blijven op de
handmatige-migratie-workflow hierboven totdat hetzelfde automatiseringspatroon
er expliciet naar wordt uitgebreid.

De onderstaande V2.9D- en V2.9E-secties blijven staan als **historisch
referentiemateriaal** (art-direction-taal, canvas-/anchor-conventies,
laagvolgorde) — de harde technische eisen (128×128, transparant, exacte
laagvolgorde/anchors) gelden onverkort ook voor de nieuwe Photoshop-assets.
De V2.9D-14-onderdelen-set (`parts/base/`, `parts/face/`, enz., zónder
`/v2/`- of `/custom/`-segment) bestond nooit fysiek — dit veroorzaakte
zichtbare broken-image-tegels ("Basis 1"/"Basis 2" en de overige 12) in de
speler-facing Character Creator, inclusief een kapotte stille default-keuze
voor nieuwe spelers. Alle 14 rijen zijn daarom gedeactiveerd (`active =
false`, zelfde patroon als de V2.9E-deactivering hierboven, zie
`supabase/migrations/20260920000000_game_night_character_legacy_starter_deactivate.sql`)
— niet hard verwijderd, equipment-/unlock-historie blijft intact. Ze
verschijnen niet meer in de echte Creator, maar wel (gelabeld "inactief")
in de QA-pagina.

---

# Game Night — modulaire character-onderdelen (definitieve spec, V2.9D)

Dit is de assetmap voor de modulaire Character Creator. **Er staat nog geen
enkel bestand** — alle 14 starter-rijen in de database wijzen al wel naar
de paden hieronder, en de app valt daar overal netjes op terug (per laag
verborgen; als alle lagen ontbreken toont `CharacterVisual` de
spelerinitiaal — nooit een kapot-plaatje-icoon of lege cirkel). Zodra de
14 bestanden hieronder op hun exacte pad staan, pakt de app ze automatisch
op — geen codewijziging nodig.

Dit vervangt NIET `public/game-night/characters/*.webp` (de 12 vaste V2.8/
V2.9-presets) — die blijven bestaan als **secundaire** legacy-fallback
(prioriteit 2, zie sectie 2 van de V2.9D-opdracht); de 14 modulaire
starter-onderdelen hieronder zijn prioriteit 1.

## Art direction (definitief)

Premium party-game character creator. Sfeer: speels, grappig, expressief,
modern, iets overdreven, maar volwassen genoeg voor een vriendengroep —
geen kinderachtige cartoon. Stylized 3D/cartoon-look met zachte, cinematic
shading, clean edges, iets grotere gezichtskenmerken voor leesbaarheid op
klein formaat, duidelijk silhouet. Mario Party is uitsluitend inspiratie
voor ENERGIE en LEESBAARHEID — niet de Nintendo-artstyle zelf overnemen.

**Niet**: extreem chibi, photorealistisch, anime, pixel art, bestaand IP
(personages/artstijlen) nabootsen.

## Canvas- en alignment-spec (harde eis)

- **512×512px**, exact hetzelfde vierkant voor ALLE 14 onderdelen — elke
  laag rendert op precies dezelfde positie over elkaar heen (`inset: 0`,
  zie `.gnv2-character-layer` in `styles.css`). Een verkeerde canvasmaat of
  -verhouding verschuift de hele stapel; er zijn bewust GEEN per-asset
  CSS-offsets in de code — alignment moet uit het bronbestand zelf komen.
- **Gecentreerd**, vaste hoofd-/lichaamspositie en vaste schouderlijn over
  alle 14 bestanden heen (zie "Gedeelde anchor" hieronder).
- **Transparante achtergrond** (alpha-kanaal) — geen achtergrondkleur/
  -vorm/vignet in de laag zelf.
- **Geen** speler-kleur-glow, naam, of badge/frame ingebakken — dat zijn
  losse CSS-lagen (ring/glow om `.gnv2-character-head`, naam eronder). De
  enige uitzondering: als het item ZELF een badge is (de `badge`-slot),
  hoort die badge-vorm natuurlijk wél in dat ene bestand.
- **Geen extra canvas-cropping per asset** — alle 14 bestanden exact
  512×512, ook als de getekende inhoud kleiner is (dan gewoon transparante
  ruimte eromheen, geen kleiner canvas).

### Gedeelde anchor (verplicht identiek voor alle 8 slots)

Beide `base`-varianten gebruiken dezelfde anatomische pose/schedelpositie
(sectie 6) — verschillen mogen zitten in lichaamsvorm/materiaal/subtiele
variant, NIET in hoofdpositie. Elke andere laag ankert op diezelfde
`base`-geometrie:

| slot        | anchor-conventie                                                             |
|-------------|-------------------------------------------------------------------------------|
| `base`      | de referentie zelf — bepaalt hoofdpositie/schouderlijn voor alle andere slots |
| `face`      | exact op de hoofdpositie van `base`, geen nieuw hoofd tekenen                 |
| `hair`      | dezelfde haarlijn-anchor als `base`'s schedel; geen kleding/hoofd in de asset — laat ruimte vrij zodat `headwear` er later overheen past |
| `outfit`    | over lichaam/schouders van `base`, geen hoofd of haar in de asset             |
| `headwear`  | dezelfde head-anchor als `hair`, ligt qua layer_order boven hair             |
| `accessory` | vaste conventie: in-hand/naast-de-schouder-zone (zie sectie 11) — géén vrije x/y per speler, toekomstige extra posities worden hier als nieuwe presets gedocumenteerd, niet in React gehardcode |
| `effect`    | omringt/achter het silhouet — visueel duidelijk te onderscheiden van de bestaande speler-kleur-ring (die blijft een dunne rand/gloed om de cirkel, geen grote gekleurde wolk) |
| `badge`     | vaste anchor rechtsonder binnen de character-bounds — geen positie per asset in code |

## Mapstructuur

```
public/game-night/characters/parts/
  base/
  face/
  hair/
  outfit/
  headwear/
  accessory/
  effect/
  badge/
```

## De 14 starter-onderdelen (exacte bron van waarheid)

Zie `supabase/migrations/20260914030000_game_night_character_starter_seed.sql`
en de TS-spiegel `src/features/game-night/lib/characterStarterManifest.ts`
(dev-tooling, handmatig gesynchroniseerd). `id` is een `gen_random_uuid()`
die pas bij INSERT ontstaat — `key` is de stabiele identifier.

| key                    | slot        | label                    | layer_order | asset_path (relatief aan `public/`)                                  |
|-------------------------|-------------|--------------------------|--------------|------------------------------------------------------------------------|
| `base-default-01`       | `base`      | Basis 1                  | 20           | `game-night/characters/parts/base/base-default-01.webp`               |
| `base-default-02`       | `base`      | Basis 2                  | 20           | `game-night/characters/parts/base/base-default-02.webp`               |
| `face-neutral-01`       | `face`      | Neutraal                 | 40           | `game-night/characters/parts/face/face-neutral-01.webp`               |
| `face-smile-01`         | `face`      | Glimlach                 | 40           | `game-night/characters/parts/face/face-smile-01.webp`                 |
| `hair-short-01`         | `hair`      | Kort haar                | 50           | `game-night/characters/parts/hair/hair-short-01.webp`                 |
| `hair-short-02`         | `hair`      | Kort haar (donker)       | 50           | `game-night/characters/parts/hair/hair-short-02.webp`                 |
| `outfit-casual-01`      | `outfit`    | Casual outfit            | 30           | `game-night/characters/parts/outfit/outfit-casual-01.webp`            |
| `outfit-casual-02`      | `outfit`    | Casual outfit (donker)   | 30           | `game-night/characters/parts/outfit/outfit-casual-02.webp`            |
| `headwear-cap-01`       | `headwear`  | Pet                      | 60           | `game-night/characters/parts/headwear/headwear-cap-01.webp`           |
| `headwear-beanie-01`    | `headwear`  | Muts                     | 60           | `game-night/characters/parts/headwear/headwear-beanie-01.webp`        |
| `accessory-glasses-01`  | `accessory` | Bril                     | 70           | `game-night/characters/parts/accessory/accessory-glasses-01.webp`     |
| `accessory-mug-01`      | `accessory` | Koffiemok                | 70           | `game-night/characters/parts/accessory/accessory-mug-01.webp`         |
| `effect-glow-01`        | `effect`    | Zachte gloed             | 10           | `game-night/characters/parts/effect/effect-glow-01.webp`              |
| `badge-star-01`         | `badge`     | Ster                     | 80           | `game-night/characters/parts/badge/badge-star-01.webp`                |

## Laagvolgorde (bevestigd correct, ongewijzigd sinds V2.9B)

```
effect (10, achter)  →  base (20)  →  outfit (30)  →  face (40)  →
hair (50)  →  headwear (60)  →  accessory (70)  →  badge (80, voorAAN)
```

`layer_order` staat per onderdeel in de database (niet vast per slot) —
een toekomstig "voor-effect" (bv. sparks vóór het character) kan dus altijd
met een hogere waarde worden toegevoegd zonder deze tabel of de code te
wijzigen; vandaag heeft de starterset maar één `effect`-item (achter).

## Bestandsformaat

- WebP, transparant, 512×512. Als transparante WebP in de gebruikte
  toolchain kwaliteitsproblemen geeft: PNG is technisch acceptabel, maar
  wissel niet per losse laag — kies één consistente strategie per
  categorie.
- Richt op < 100KB per laag; visuele kwaliteit gaat vóór die richtlijn.
- Geen 4K-bronbestanden in `public/`.

## Status (V2.9D)

Alle 14 bestanden hierboven ontbreken nog fysiek — geverifieerd via
`scripts`/test-run (`existsSync` per pad, zie het V2.9D-opleverrapport).
Zodra ze hier geplaatst zijn, werkt de Creator/Lobby/Arena zonder verdere
wijziging.

---

# V2.9E — pixel-art assetstandaard (128×128), aanvullend systeem

Dit vervangt de V2.9D-spec hierboven NIET — beide systemen bestaan naast
elkaar (zie `CHARACTER_SLOTS` in `gameNightCharacter.ts`: de 8 oude slots
blijven volledig geldig). De V2.9E-onderdelen staan onder `parts/v2/` in
plaats van rechtstreeks onder `parts/`, en gebruiken een deel van dezelfde
slotnamen (`base`, `hair`, `headwear`) plús 9 nieuwe slots.

## Art direction

Modern Clean Pixel — warme, cozy RPG-sfeer (Stardew-achtig, gemoderniseerd),
front-facing bust, crisp pixel art. **Geen** smoothing/blur bij schalen:
`image-rendering: pixelated` staat op elke `.gnv2-character-layer` en
`.gnv2-part-tile-img` (`src/styles.css`).

## Canvas- en anchor-spec (harde eis, ongewijzigd voor élk onderdeel)

- **128×128px**, transparante PNG, voor ELK onderdeel — ook een bril of mond
  is een volledig 128×128 canvas met het zichtbare element op de juiste
  positie, nooit een klein bijgesneden sprite'je.
- **Geen automatische per-asset scaling/cropping tijdens het renderen** —
  alle schaal-/positielogica gebeurt ÉÉNMALIG bij het genereren van de
  assets (zie `ANCHORS` in het extractie-script, niet in de React/CSS-laag).
  De render-laag zelf is bewust dom: `inset:0; object-fit:contain`.
- **Twee bases**: `male` en `female` — expliciet GEEN derde neutrale/unisex
  base.

## Mapstructuur

```
public/game-night/characters/parts/v2/
  base/  clothing/  eyes/  eyebrows/  mouth/  facial-hair/
  hair/  glasses/  headwear/  arms/  props/  foreground-effects/
```

## Slots en laagvolgorde

`base(20) → clothing(25) → eyes(32) → eyebrows(34) → mouth(36) →
facial-hair(38) → hair(50) → glasses(55) → headwear(60) → arms(65) →
props(75) → foreground-effects(95)` — zie `DEFAULT_SLOT_LAYER_ORDER` in
`gameNightCharacter.ts`. `base`/`hair`/`headwear` zijn HERGEBRUIKTE
slotnamen uit het V2.9D-systeem; het daadwerkelijke `layer_order`-veld per
part (niet deze tabel) bepaalt de uiteindelijke stapelvolgorde.

## Lichaamsbouw (female-only)

`game_night_players.body_shape` (`small`/`medium`/`large`, default in de
UI: `medium`, GEEN cupmaten) bepaalt welke female-base-tegel en welke
kleding-/armvariant renderen. Drie mechanismen, gescheiden per doel:

- **Base**: 3 aparte catalogusrijen (`base-female-small/medium/large`),
  elk met een eigen `body_shape`-kolom — dit zijn de tegels die de
  "Lichaamsbouw"-picker toont.
- **Kleding/armen die op meerdere vormen moeten passen**: ÉÉN rij met
  `body_shape_variants` (`{small?, medium?, large?: asset_path}`) — de
  speler kiest ÉÉN tegel, `resolveBodyShapeAssetPath()` kiest de asset.
- Ontbrekende sleutel in `body_shape_variants` = needs_asset_revision voor
  die vorm; valt terug op `medium`, dan op `asset_path` — kleding verdwijnt
  nooit stilzwijgend.

## Pose/prop-compatibiliteit

Een prop met `requires_pose_key` (bv. `prop-mug` → `"hold-mug"`) koppelt
automatisch aan de bijpassende `arms`-rij (`pose_key` `"hold-mug-f"` of
`"hold-mug-m"`, geslacht afgeleid uit de actieve base-key) — zie
`resolveCompatibleArmsPart()`/`applyPoseOverride()` in
`gameNightCharacter.ts`. De speler kiest in de UI maar ÉÉN voorwerp-tegel;
de arm-laag wisselt automatisch mee. Props zonder `requires_pose_key`
(controller/headphones) zijn bewust decoratief — de brondata bevat geen
bijpassende hand-sprite voor die twee.

## Status (V2.9E)

Uitgesneden en genormaliseerd uit de aangeleverde "Game Night Character
Assets V1"-spritesheet. Zie
`supabase/migrations/20260915010000_game_night_character_v2_seed.sql` en de
TS-spiegel `src/features/game-night/lib/characterV2Manifest.ts` voor de
exacte, geseedde lijst. Secties die GEEN enkele bruikbare rij opleverden
(huidskleur, wenkbrauwen, gezichtsbeharing) staan NIET in de seed — geen
geforceerde slechte crops, zie het V2.9E-opleverrapport voor de volledige
tally en `V2_NEEDS_ASSET_REVISION_SLOTS` in `characterV2Manifest.ts` voor de
machine-leesbare samenvatting.
