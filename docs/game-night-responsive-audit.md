# Game Night: controle van schermformaten en achtergronden

Eerste controle uitgevoerd op 17 september 2026, inclusief de gastfotoflow. De oorspronkelijke bevindingen staan hieronder; de zes punten zijn daarna op verzoek verholpen in de lokale code.

## Uitgevoerde correcties

- De algemene site-layout voegt geen buitenpadding of zwevende huislink meer toe aan Game Night. Contentpagina’s hebben de huislink naast hun eigen titel en terugknop; leden zien deze huislink niet.
- De body gebruikt de nieuwe donkere achtergrond. Mijn profiel gebruikt dezelfde scene, panelen en knoppen als de andere nieuwe pagina’s. Expliciete nieuwe inputstijlen krijgen voorrang op de oude formulierkleuren.
- Speluitslag en avondafsluiting hebben een begrensde hoogte met een werkend scrollvlak. De inhoud wordt niet samengedrukt; de knoppen blijven via normaal scrollen bereikbaar.
- De arena heeft op smalle schermen een aparte knoppenrij. Op telefoons staan de spelers in een raster. Het speelveld scrollt en begrenst de avatarmaat aan de werkelijk beschikbare hoogte.
- De character-editor kan op korte schermen in zijn geheel scrollen. Op hogere schermen blijft de bestaande indeling met afzonderlijk scrollbare onderdelen staan.
- `/game-night/spelen` verwijst nu naar de echte lobby.
- Bestaande spelers veroorzaken bij laden geen aankomstmeldingen. Nieuwe aankomsten worden gebundeld, met maximaal twee meldingen tegelijk en opgeruimde timers.
- Aanvullend gevonden en opgelost: de arena-intro kon door het opruimen van een effect blijven staan. De verdwijn-timer staat nu los van het laden van statistieken; de intro bedekt geen navigatieknoppen.
- De mobiele lobby geeft de navigatie een eigen rij, zodat ook lange maandnamen leesbaar blijven.

De nieuwe browserregressietest staat in `tests/game-night/layout.browser.mjs`, te starten met `npm run game-night:test-layout-browser`. Deze start zelf een lokale Vite-server op poort 5180 en onderschept alle externe verzoeken. Een geïnstalleerde Chromium kan via `CHROMIUM_PATH` worden gekozen.

De test controleert de arena met 2, 4, 8 en 12 spelers op de zes onderstaande schermformaten, echte wielscroll naar alle spelers en vervolgknoppen, vrije navigatie, beide beheerders-/ledeneditors, oude-routeverwijzing en aankomstmeldingen. Hij gebruikt bewust geen `scrollIntoView` om onbereikbare inhoud zichtbaar te maken.

**Validatie afgerond:** 235 layout- en bedieningscontroles geslaagd. Ook TypeScript (`tsc --noEmit`), ESLint op de gewijzigde code, de productiebuild en de bestaande gastbrowsertest zijn geslaagd. Die gasttest omvat foto kiezen/bijsnijden/opslaan, herladen en spelerhergebruik op een ander apparaat. De visuele nacontrole is uitgevoerd in Chromium; fysieke telefoons, native camera en het echte mobiele toetsenbord zijn niet getest.

Screenshots na de correcties: `/tmp/game-night-final/`. Het oorspronkelijke bewijsmateriaal blijft in `/tmp/game-night-audit/`. Er zijn voor deze opmaakcorrecties geen extra SQL-migraties of wijzigingen aan live gegevens nodig. Publicatie van de website valt buiten deze lokale controle.

## Werkwijze en dekking

- Chromium op 320×568, 375×812, 667×375, 768×1024, 1280×800 en 1920×1080.
- Beheeraccount, aanvullende controles als Game Night-lid, en de aparte gastpagina’s.
- Lokale testgegevens: twaalf opgeslagen spelers, acht actieve spelers, acht spellen, eerdere resultaten en lange spelersnamen. Supabase-verzoeken zijn onderschept; geen live gegevens of accounts gewijzigd.
- Alle hieronder genoemde gebruikersroutes zijn in de browser geopend. Ook spelkeuze, voorstellen, roulette, spelvoorbeeld, spelstartscherm, QR-popup, winnaarselectie en afsluiting van de avond zijn gecontroleerd.
- 171 combinaties van scherm/toestand/formaat vastgelegd, gevolgd door gerichte scrollcontroles. Geen JavaScript-crashes in deze controles. Dit is geen test op fysieke iPhones/Android-toestellen of met het schermtoetsenbord.
- De ontwikkelroute `/game-night/dev/character-qa` en de oude `win_source=legacy`-speelflow vallen buiten de visuele browsertest. De nog bereikbare oude `/game-night/spelen`-pagina is wel meegenomen.

## Bevindingen, op volgorde van prioriteit

### 1. Houtstrook en deels verdwenen opslaanknop bij de beheerder — hoog

**Waar:** `/game-night/me/character` en `/game-night/me/face`.

De nieuwe achtergrond begint bij de beheerder op y=64, op alle geteste formaten. Daarboven verschijnt de echte houten achtergrond. Op 375×812 staat de knop **Opslaan** in de character-editor op y=804–860: vrijwel de hele knop valt buiten het scherm. Bij een Game Night-lid staat dezelfde knop op y=740–796 en past hij wel.

**Oorzaak:** `gameNightFullBleedNeedsTopClearance` voegt voor de beheerder `pt-16 pb-8 sm:pb-12` toe. Binnen die ruimte krijgt de editor zelf nog steeds `height:100dvh`. De bovenliggende layout kapt de overmaat af met `overflow-hidden`. De houten body-achtergrond blijft actief zolang ergens `.gamenight-theme` staat.

**Aanbeveling:** laat één Game Night-layout de achtergrond, schermhoogte en veilige randen beheren. Verwijder de extra buitenpadding voor pagina’s met een eigen schermvullende scene. Plaats de huislink in de bestaande paginabalk. Zet hout uitsluitend op een expliciete oude schermvariant als die nog nodig is.

**Controle:** een tijdelijke wijziging van alleen de buitenpadding in de testbrowser verplaatste de scene van y=64 naar y=0 en bracht de opslaanknop terug in beeld.

Bronnen: [site-layout.tsx](../src/components/site-layout.tsx), regels 76–105 en 336–340; [styles.css](../src/styles.css), regels 1597 en 8687.

### 2. “Ons Huisje” ligt over de terugknop — hoog

**Waar:** de beheerweergaven van Spellen, Speldetail, Geschiedenis, Geschiedenisdetail, Spelers, Spelerprofiel, Hall of Fame en de finale.

De zwevende huislink staat linksboven op dezelfde plek als de nieuwe terugknop. De browsercontrole bevestigt dat een tik op het midden van de terugknop de huislink raakt. In de finale overlapt hij de sluitknop. Dit gebeurt ook op desktop. Bij leden ontbreekt de zwevende huislink en is deze overlap er niet.

**Aanbeveling:** gebruik één navigatiebalk binnen Game Night, met terug en eventueel huis naast elkaar. Schrap voor die routes de zwevende link uit de algemene site-layout. Meer bovenpadding toevoegen zou probleem 1 opnieuw veroorzaken.

Bron: [site-layout.tsx](../src/components/site-layout.tsx), regel 230; paginabalken binnen `GnV2Scene`.

### 3. Knoppen onder de uitslag verdwijnen op korte schermen — hoog

**Waar:** de uitslag na een spel en de afsluiting van de avond binnen `/game-night`.

Bij acht spelers is de speluitslag circa 898 pixels hoog, maar het bovenliggende scherm wordt op de viewport afgeknipt. Op 667×375 staan **Rematch** en **Ander spel** rond y=649 en y=717. Normaal scrollen verplaatst niets. Op 375×812 en 1280×800 valt ook een deel van **Game Night afsluiten** buiten beeld. De afsluiting van de avond kent dezelfde combinatie van een groeiende scene en een afkappende ouder.

**Oorzaak:** de algemene site-layout is een vast scherm met `overflow-hidden`, terwijl `.gnv2-recap-scene` en `.gnv2-nightrecap-scene` alleen de algemene minimumhoogte erven. Daardoor groeit de hele scene, in plaats van een begrensd inhoudsvlak te laten scrollen. `overflow-y:auto` op de inhoud alleen lost dat niet op.

**Aanbeveling:** begrens de uitslagscene tot de werkelijk beschikbare hoogte en maak de inhoud binnen dat vlak scrollbaar. Houd de vervolgknoppen bereikbaar in een eigen onderste balk, of laat deze schermen bewust als gewone pagina scrollen. Kies één van beide werkwijzen en pas die consequent toe.

Bronnen: [site-layout.tsx](../src/components/site-layout.tsx), regel 336; [styles.css](../src/styles.css), regels 6470 en 7421.

### 4. Arena verliest bediening en spelers op kleine schermen — hoog

**Waar:** de actieve spelweergave, vooral Mario Kart.

- In de normale arena valt **Spel afsluiten** op 320 pixels breed buiten de rechterrand.
- Bij Mario Kart valt die knop al op 375 pixels breed buiten beeld; op 320 pixels verdwijnt ook **Meer opties**.
- Bij acht spelers op 320×568 steken de bovenste en onderste spelers buiten het speelveld. De arena gebruikt `overflow:hidden`, zodat normaal scrollen ze niet terugbrengt. Het probleem is ook zichtbaar als afsnijding bij 375×812.

**Aanbeveling:** maak op telefoons twee rijen in de bovenbalk: titel bovenaan, acties daaronder. Laat essentiële bediening zichtbaar blijven. Gebruik voor veel spelers een compact, scrollbaar raster of een lijst. De huidige berekening van karaktergroottes houdt onvoldoende rekening met het extra aantal regels dat door smalle schermen ontstaat.

Bronnen: [GameNightV2Arena.tsx](../src/features/game-night/v2/GameNightV2Arena.tsx), regel 356; [styles.css](../src/styles.css), regels 5543, 5736, 5762 en 6667; [ArenaPlayerLayout.tsx](../src/features/game-night/v2/ArenaPlayerLayout.tsx).

### 5. Mijn profiel en een oude speelroute gebruiken nog de oude vormgeving — middel

**Waar:** `/game-night/me` en `/game-night/spelen`.

Mijn profiel heeft nog een volledige houtachtergrond, oude bruine panelen en messingkleurige knoppen. Dit is dus geen losse rand rond een nieuwe pagina. De route `/game-night/spelen` toont bovendien nog “Binnenkort” voor een startflow die op de homepage al bestaat.

**Aanbeveling:** zet Mijn profiel op dezelfde scene, panelen en knoppen als de gastlobby en andere nieuwe pagina’s. Laat de oude speelroute doorverwijzen naar de echte lobby, zoals `/game-night/spel-kiezen` al doet.

Bronnen: [GameNightMe.tsx](../src/pages/game-night/GameNightMe.tsx), [GameNightPlay.tsx](../src/pages/game-night/GameNightPlay.tsx), [GameNightComingSoon.tsx](../src/features/game-night/components/GameNightComingSoon.tsx).

### 6. Bij het openen van de lobby stapelen meldingen zich op — middel

Bij een herladen lobby met acht QR-spelers verschenen acht meldingen “… schuift aan” boven elkaar. Ze bedekken tijdelijk een groot deel van de bovenbalk en spelers. De code probeert de eerste dataset over te slaan, maar registreert eerst de tijdelijke lege lijst als vorige toestand.

**Aanbeveling:** initialiseer de vorige spelerslijst pas na de eerste succesvolle laadactie. Toon bij meerdere echte nieuwkomers één gezamenlijke melding of maximaal twee tegelijk.

Bron: [GameNightV2Lobby.tsx](../src/features/game-night/v2/GameNightV2Lobby.tsx), regels 57 en 79–107.

## Wat al goed werkt

- De nieuwe achtergrond zelf schaalt goed mee op de geteste schermformaten. Het zichtbare hout komt uit de bovenliggende layout en de nog oude pagina’s.
- De gastlobby en het terugkiezen van opgeslagen spelers hebben geen houtstrook en geen horizontale pagina-overflow in de geteste formaten.
- De QR-popup blijft binnen de schermbreedte. In liggende stand kan de inhoud intern scrollen; kopiëren en vernieuwen blijven daardoor bereikbaar.
- Spellen, geschiedenis, spelerprofielen en Hall of Fame gebruiken overwegend dezelfde nieuwe componenten. De belangrijkste terugkerende fout daar is de overlappende huislink bij de beheerder.
- De lobby houdt haar onderste acties binnen beeld en heeft een werkende scrollzone voor meer spelers. Dit verschilt van de arena, die inhoud afkapt.
- Spelkeuze, voorstellen en spelvoorbeelden gebruiken een intern scrollvlak. Inhoud onder de eerste schermhoogte is daar niet automatisch een fout.
- Er was geen horizontale scroll van de hele pagina. Dat is geen volledige garantie: in de arena verbergt `overflow:hidden` juist de knoppen die buiten beeld vallen.

## Routeoverzicht

| Pagina/toestand | Uitkomst |
| --- | --- |
| Startscherm | Nieuwe achtergrond, startknop bereikbaar |
| Lobby | Acties bereikbaar; stapelende meldingen bij laden |
| Spelkeuze, voorstellen, roulette, voorbeeld, startscherm | Nieuwe stijl, interne scroll |
| Arena / Mario Kart | Afgesneden bediening en spelers op smalle schermen |
| Speluitslag / avondafsluiting | Hoogte- en scrollprobleem |
| Spellen / speldetail | Nieuwe stijl; overlappende terugknop voor beheerder |
| Geschiedenis / detail / finale | Nieuwe stijl; overlappende terug-/sluitknop voor beheerder |
| Hall of Fame | Nieuwe stijl; overlappende terugknop voor beheerder |
| Spelers / spelerprofiel | Nieuwe stijl; overlappende terugknop voor beheerder |
| Mijn profiel | Nog oude achtergrond en panelen |
| Character-editor / gezichtsfoto | Houtstrook en verkeerde beschikbare hoogte voor beheerder |
| Gastspeler kiezen / gastlobby | Geen gevonden layoutblokkade in deze controle |
| Oude route `/spelen` | Verouderde placeholder |
| Oude route `/spel-kiezen` | Verwijst correct naar de homepage |

## Aanpak

1. Eerst de gedeelde layout, achtergrond en navigatie samen oplossen. Dat verhelpt meerdere pagina’s tegelijk.
2. Daarna de scroll- en hoogteverdeling van editor, uitslagen en arena herstellen.
3. Mijn profiel en de laatste oude routes gelijk trekken met de bestaande nieuwe stijl.
4. Meldingen begrenzen en dezelfde controles herhalen met 2, 4, 8 en 12 spelers, lange namen, browserzoom en een geopend mobiel toetsenbord.

De bron van de meeste problemen is de combinatie van oude site-layoutregels met nieuwe schermvullende pagina’s. Een nieuw ontwerp of extra achtergrondafbeeldingen zijn hiervoor niet nodig.

## Lokaal bewijsmateriaal

Screenshots, metingen en de herhaalbare browsercontrole staan in `/tmp/game-night-audit/`.

Voorbeelden:
- `creator-375x812.png`: houtstrook en afgesneden opslaanknop.
- `member-creator-375x812.png`: dezelfde editor als lid, zonder de extra bovenruimte.
- `games-375x812.png`: huislink boven op de terugknop.
- `mario-375x812.png`: afsluitknop buiten de rechterrand.
- `recap-landscape-wheel-667x375.png`: uitslag na een echte scrollpoging.
- `creator-preview-no-padding-375x812.png`: alleen in de testbrowser gecontroleerd effect van het weghalen van de buitenpadding.
- `results.json`, `results-extra.json`, `results-scroll.json` en `scroll.log`: geometrie, rol, schermtoestand en scrollgedrag.
