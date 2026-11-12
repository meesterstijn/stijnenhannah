# Secret Hitler in Game Night

Kies je in Game Night het spel **Secret Hitler**, dan wordt de Arena een
spelleider in plaats van een puntenteller. De eigen characters blijven de
spelers aan tafel, en de WIN-telling blijft werken: aan het eind krijgt elk
lid van het winnende team één WIN. Daardoor tellen Hall of Fame, stand en
geschiedenis gewoon mee.

Het fysieke spel blijft leidend: de enveloppen, kaarten en stemkaarten
gebruik je zoals altijd. Het scherm houdt bij wat er gebeurt, bewaakt de
regels en maakt er een show van.

## Wat het tafelscherm doet

- **Opzet**: rolverdeling voor het aantal spelers, zitvolgorde (met de klok
  mee aantikken), eerste president (of 🎲). **Nachtfase voorlezen** leest de
  "ogen dicht"-tekst hardop voor met de juiste variant (5-6 spelers: Hitler
  kent de fascist; 7-10: duim omhoog).
- **Verkiezing**: de president schuift automatisch door. Termijnlimieten
  worden afgedwongen (bij 5 levende spelers alleen de vorige kanselier).
  Speciale verkiezingen springen en keren daarna netjes terug in de
  rotatie.
- **Stemmen**: tik op de characters (1× = JA, 2× = NEIN). Invullen is
  optioneel; met stemmen worden de uitslag en awards veel leuker.
- **Hitler-check**: na 3 fascistische wetten vraagt het scherm bij elke
  gekozen kanselier "Is X Hitler?". Nee = badge "✓ Geen Hitler".
- **Wetgeving**: liberaal of fascistisch, plus de claims ("ik trok FFL",
  "ik kreeg FF"). Het scherm vangt tegenspraak en onmogelijke claims
  ("🔥 Eén van hen liegt!"). Veto zodra het ontgrendeld is.
- **Chaos** na drie mislukte verkiezingen: bovenste kaart, termijnlimieten
  vervallen, geen macht.
- **Presidentiële machten** volgens het bord voor dit spelersaantal:
  onderzoeken (met claim), stapel bekijken (met claim), speciale verkiezing,
  executie ("was dit Hitler?").
- **Bord**: beide sporen met de machten, verkiezingsteller, trek- en
  aflegstapel (inclusief schudden) en een ruwe kans op drie rode kaarten.
- **Verteller**: bij elke stap een banner met een (grappige) tekst en een
  eigen geluid; **Verloop** toont alles terug. **Quote** legt uitspraken vast
  voor de uitslag. **Stap terug** maakt de laatste stap ongedaan.
- **Spel afsluiten** (topbalk): winnaar handmatig vaststellen als het spel
  buiten het scherm om is beslist, of stoppen zonder uitslag.
- **Einde**: rollen onthullen (met controle op de verdeling), dan **Uitslag
  opslaan**: één WIN per winnend teamlid, in één databasetransactie.

## Telefoons

Gasten die via de QR aan tafel zitten zien op hun telefoon live het bord en
wat er net gebeurde. Ze kiezen **in het geheim wie zij voor Hitler houden**
(steeds aan te passen). Het tafelscherm toont alleen de anonieme
"tafelverdenking". Na de onthulling ziet iedereen op de telefoon de
uitslag en of hij of zij gelijk had.

## Na afloop

De uitslag toont het winnende team, alle rollen, awards (beste acteur,
naïefste schaap, Hitlers beste vriend, leugenaar ontmaskerd, eigen
doelpunt, scherpschutter, Sherlock, onterecht verdacht, meesterbrein, ...),
de quotes, wie wie verdacht, en **Achteraf bekeken**: elke regering met de
nu bekende rollen erbij, inclusief welke liberalen ja stemden op een
regering met een fascist erin.

Op de spelpagina van Secret Hitler staan statistieken over alle potjes
(alleen potjes met onthulde rollen): teamwinst, records en per speler hoe
vaak liberaal/fascist/Hitler en het winstpercentage.

## Techniek

- Migratie: `supabase/migrations/20261112000000_game_night_secret_hitler.sql`.
  Event-log `game_night_secret_hitler_events` (append-only, `undone_at`),
  `game_night_secret_hitler_suspicions` en de RPC's voor vastleggen,
  ongedaan maken, afronden en de telefoons. Alleen additief.
- Spelmotor (puur, getest): `src/features/game-night/lib/secretHitler.ts`.
  Verteller, awards en statistieken: `secretHitlerStory.ts`.
- UI: `src/features/game-night/v2/secretHitler/`, stijl in
  `src/features/game-night/secret-hitler.css`.
- Herkenning via `game.slug === "secret-hitler"`, net als Mario Kart.

Tests:

```sh
npx vitest run src/features/game-night/lib/secretHitler.test.ts
npm run game-night:test-secret-hitler          # database (PGlite, lokaal)
npm run game-night:test-secret-hitler-browser  # klikt een heel potje door
```

De browsertest heeft Playwright-Chromium nodig, of `CHROMIUM_PATH` naar een
geïnstalleerde Chrome/Edge.

## Openstaande keuzes

- **Stemmen per speler zijn optioneel.** Snel "Gekozen"/"Weggestemd" mag
  altijd; awards die op stemmen leunen verschijnen dan simpelweg niet.
- **Claims zijn optioneel** en worden bewaard als aantal fascistische kaarten
  (FFL = 2). Tegenspraak wordt alleen gemeld als het logisch onmogelijk is;
  "kanselier koos zelf fascistisch" en "president gooide een liberale weg"
  zijn opvallend, geen leugen.
- **Kans op 3× rood** is een ruwe schatting over alle nog niet aangenomen
  wetten (exact direct na het schudden). Het scherm weet niet wat er is
  afgelegd.
- **Rollen worden niet digitaal verdeeld.** De enveloppen van het fysieke
  spel blijven leidend; de app kent de rollen pas bij de onthulling. Een
  digitale rolverdeling via de telefoons kan later, maar dan moet de host
  (die ook speelt) de rollen niet kunnen zien.
- **Winst = één WIN per teamlid**, ook voor een gedode winnaar. Hitler telt
  als fascist.
- **De verdenkingsmeter is live zichtbaar** op het tafelscherm (anoniem,
  te verbergen). Dat beïnvloedt het spel bewust: het maakt het
  spannender. Zet hem uit met "verbergen" als de groep dat niet wil.
- **Speciale verkiezing door een speciaal gekozen president** komt in de
  officiële borden niet voor; de motor zou dan terugkeren naar de rotatie
  van de oorspronkelijke president.
- **Een tweede hostscherm** (bv. tv + telefoon) ververst elke 8 seconden;
  geen realtime-kanaal, omdat de host de enige is die invoert.
