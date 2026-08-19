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
