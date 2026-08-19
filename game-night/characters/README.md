# Game Night — character-portraits (V2.9)

Plaats hier de 12 character-assets. De app laadt ze automatisch zodra ze
op onderstaande paden bestaan — geen codewijziging nodig (zie
`src/features/game-night/lib/characterPresets.ts`). Zolang een bestand
ontbreekt, valt de app netjes terug op een silhouet-icoon.

## Bestanden (exacte paden, hoofdlettergevoelig)

```
public/game-night/characters/knight.webp
public/game-night/characters/wizard.webp
public/game-night/characters/astronaut.webp
public/game-night/characters/pirate.webp
public/game-night/characters/ninja.webp
public/game-night/characters/robot.webp
public/game-night/characters/viking.webp
public/game-night/characters/detective.webp
public/game-night/characters/bard.webp
public/game-night/characters/racer.webp
public/game-night/characters/royal.webp
public/game-night/characters/skeleton.webp
```

## Formaat

- **Bestandstype**: WebP, transparante achtergrond (alpha-kanaal).
- **Afmeting**: 512×512px, vierkant canvas (1:1). Portrait mag het canvas
  niet volledig vullen — laat ~5-8% marge rondom voor een prettige
  `object-fit: contain`-weergave in de ronde character-cirkel.
- **Bestandsgrootte**: richt op < 100KB per bestand (comprimeer WebP op
  kwaliteit ~80).
- **Geen** tekst, badge, ring, of speler-kleur in de afbeelding zelf — die
  worden door de app als losse CSS-laag toegevoegd (ring/glow in de
  gekozen spelerkleur, naam eronder).
- **Geen** game-specifieke achtergrond/rekwisieten die een speler zouden
  laten denken dat het character bij één bepaald spel hoort.

## Art direction

3/4 bust-portrait (hoofd + schouders), dynamische pose, expressief gezicht,
gestileerde 3D/cartoon-look met zachte, premium shading. Duidelijk
silhouet, schone randen. Sfeer: speelse partygame-energie (denk: Mario
Party-achtig plezier) gecombineerd met een moderne, volwassen app-esthetiek
— dus NIET kinderachtig cartoonesk, NIET chibi/extreem groot hoofd, NIET
pixel art, NIET anime, NIET fotorealistisch. Alle 12 characters delen
dezelfde artstyle/renderingtechniek zodat ze als één consistente set ogen.

Geen bestaande IP namaken (geen Mario/Zelda/Fortnite/etc. — eigen/generieke
archetypen, zie onderstaande lijst).

## De 12 archetypen

| id          | label            | archetype-richting                              |
|-------------|------------------|--------------------------------------------------|
| `knight`    | Ridder           | middeleeuwse ridder, harnas, zwaard-vibe          |
| `wizard`    | Tovenaar         | magiër, mantel/hoed, mystieke energie             |
| `astronaut` | Astronaut        | ruimtepak, futuristisch, speels                   |
| `pirate`    | Piraat           | zeerover, hoed/ooglapje-vibe, gedurfd             |
| `ninja`     | Ninja            | gemaskerd, behendig, minimalistisch silhouet       |
| `robot`     | Robot            | vriendelijke mechanische look, geen horror-robot   |
| `viking`    | Viking           | noorse krijger, gevlochten haar/helm-vibe          |
| `detective` | Detective        | trenchcoat/hoed, film-noir-speels                  |
| `bard`      | Bard             | muzikant/entertainer, kleurrijk, expressief        |
| `racer`     | Coureur          | racepak/helm, snelheid/energie                     |
| `royal`     | Koning/Koningin  | genderneutraal vorstelijk archetype, kroon-vibe    |
| `skeleton`  | Skelet           | speels/niet-eng, partygame-achtig skelet           |
