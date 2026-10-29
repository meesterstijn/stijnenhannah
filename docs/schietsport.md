# Schietsport

Persoonlijk schietlogboek binnen stijnenhannah.nl, bereikbaar via
`/#/schietsport` (of `stijnenhannah.nl/schietsport`, dat doorstuurt). Werkt
volledig offline en synchroniseert met Supabase zodra er internet is.

## Opbouw

| Map | Inhoud |
|---|---|
| `src/features/schietsport/domain/` | Schietsportregels, scoring/validatie, statistiek en inzichten. Puur TypeScript, volledig getest. |
| `src/features/schietsport/db/` | IndexedDB (Dexie), schrijfacties met wachtrij, mapping naar Supabase, standaarddisciplines. |
| `src/features/schietsport/sync/` | Sync-engine (push/pull/conflicten) en transport naar Supabase. |
| `src/features/schietsport/entry/` | Invoerformulier "Nieuwe schietbeurt" (kaarten, cijferpad, concepten, dubbelcheck). |
| `src/features/schietsport/filters/` | Filters (wapen, afstand, discipline, type, periode, competitie), opgeslagen in de URL. |
| `src/features/schietsport/backup/` | CSV-export en JSON-back-up/terugzetten. |
| `src/features/schietsport/components/` | Gedeelde UI (thema, kaarten, grafieken, formulieren). |
| `src/pages/schietsport/` | De schermen. |
| `supabase/migrations/20261029000000_schietsport.sql` | Tabellen, RLS, push/pull-functies, fotobucket. |
| `tests/schietsport/` | Database-, sync- en back-uptests (PGlite + fake-indexeddb). |

Tests: `npm test` (draait ook in CI vóór elke deploy).

## Regels (definitief, §4 van de opdracht)

- Afstanden: alleen 10, 12 en 25 meter.
- Elk schot 0–10 hele punten.
- **Officiële wedstrijd**: 30 schoten, max 300, één serie. Invoer als alleen
  totaal, of per kaart met een zelfgekozen indeling (1 × 30, 3 × 10, 6 × 5 of
  eigen, samen altijd 30 schoten), per kaart als kaartscore of losse schoten.
- **Vrije kaart**: 5 schoten, max 50.
- **Oefenwedstrijd**: 6 kaarten × 5 schoten, max 300; telt als één
  schietbeurt en nooit automatisch mee voor een competitie.
- 50- en 300-scores worden nooit samen gemiddeld.

De regels gelden drie keer: in `domain/scoring.ts`, in de database (CHECKs en
validatie in `shooting_push_session`) en bij het terugzetten van een back-up.

## Synchronisatie

- Elke wijziging gaat in één IndexedDB-transactie samen met een
  wachtrij-entry; een record is pas "gesynchroniseerd" als Supabase het
  bevestigt.
- Push gaat via `shooting_push_*` (security definer): eigenaarschap,
  regels en versiecontrole. Herhaald pushen van dezelfde wijziging is
  idempotent (`last_change_id`).
- Conflict (ander apparaat wijzigde hetzelfde record): de serverversie wordt
  de actuele versie, de eigen versie komt bij Instellingen → Conflicten
  te staan om te kiezen. Er gaat nooit stil iets verloren.
- Pull via `shooting_pull` in pagina's, met een cursor die alleen voorbij
  rijen ouder dan 30 seconden schuift (geen gemiste late commits).
- Verwijderen = verwijdermarkering die meesynchroniseert.
- Offline openen: de laatst bekende rol en de opgeslagen sessie worden
  gebruikt bij netwerkfouten (`src/lib/offline-auth.ts`), voor de hele site.

## Competities

Drie soorten (`domain/competition.ts`):

- **Puntenbord (periodes)**: het jaar in periodes (standaard 5, datums één
  keer per jaar instellen). Een schietbeurt telt voor de periode waarin de
  datum valt; de hoogste score per periode telt. Een afgelopen periode wordt
  vastgezet (`rules.frozen`, gesynchroniseerd) zodra de module na afloop
  open is; daarna veranderen invoer of bewerkingen die score niet meer.
  Wat na het einde van een periode wordt ingevoerd, telt niet meer voor die
  periode.
- **Beste scores (bv. klapschijf)**: de eerste N (standaard 5) scores vullen
  de plekken; daarna vervangt een nieuwe score de laagste als die hoger is.
- **Handmatig**: zelf officiële wedstrijden koppelen.

Per competitie stel je in wat meetelt: officiële wedstrijden óf vrije kaarten,
en optioneel discipline en afstand.

## Privacy en beveiliging

- Elke rij hoort bij één gebruiker; RLS laat alleen eigen rijen lezen, ook
  tussen de twee owner-accounts. Direct schrijven in de tabellen is niet
  toegestaan; alleen via de push-functies.
- Toegang tot de module: rol `owner` (`private.can_use_shooting()`). Voor
  verenigingsleden later een rol als `shooting_member` toevoegen.
- Wapenfoto's in de privé bucket `shooting-weapon-photos`, pad
  `<user_id>/<wapen_id>.webp`. Geen serienummers of vergunningsgegevens.

## Uitbreiden naar leden en verenigingen

Alles hangt aan `user_id`, dus een nieuw lid krijgt automatisch een eigen,
gescheiden logboek zodra de rol is toegevoegd aan `can_use_shooting()` en
`RequireAppAccess`. Verenigingen (`clubs`, `club_members`, gedeelde
resultaten) kunnen als nieuwe tabellen worden toegevoegd zonder bestaande
tabellen te wijzigen. Competitie-eindstanden: de rekenregels toevoegen in
`domain/` zodra de vereniging ze heeft vastgesteld.

## Openstaande keuzes

Beslissingen die ik zelfstandig heb genomen. Allemaal terug te draaien of aan
te passen.

1. **Schoten per kaart als lijstje** (`smallint[]`) in plaats van losse
   `Shot`-rijen: akkoord gegeven. Analyse per schot blijft mogelijk.
2. **Officiële wedstrijd met vrije kaartindeling** (1 × 30, 3 × 10, 6 × 5,
   eigen) en per kaart kiezen tussen score en losse schoten; ook mengen
   binnen één wedstrijd mag. De app onthoudt per discipline de vorige indeling.
3. **Concepten alleen lokaal**: een half ingevulde schietbeurt wordt op het
   apparaat bewaard, niet gesynchroniseerd en telt nergens mee.
4. **Standaarddisciplines**: alle KNSA-klein-kaliberdisciplines op 10/12/25 m
   plus "Karabijn staand" (verenigingsonderdeel, 25 m, 3 × 10). Archiveer wat
   je niet gebruikt. Ze worden direct bij het eerste openen klaargezet.
5. **Tweede owner-account**: krijgt de module met een eigen, leeg logboek
   (keuze b).
6. **Hero-afbeelding**: een getekende schietschijf (SVG, ~2 KB) in plaats van
   een foto, omdat er geen eigen foto beschikbaar was en stockfoto's
   licentievragen oproepen. Een eigen foto (bijv. van de baan) kan erin:
   vervang `src/features/schietsport/assets/hero-target.svg` of geef de foto
   door, dan zet ik 'm verkleind op zijn plek.
7. **Kleuren in grafieken**: koper (wedstrijd), blauw (oefenwedstrijd) en
   groenblauw (vrije kaart). Olijfgroen uit het ontwerp bleek met koper niet
   te onderscheiden voor kleurenblinden en is daarom alleen accentkleur.
8. **Typografie**: de serif-koppen van de site (Fraunces) zijn behouden; het
   ontwerpconcept gebruikte een schreefloze letter.
9. **Gemiddelde en record op het dashboard**: van officiële wedstrijden
   (zoals gevraagd). Staat de typefilter alleen op oefenwedstrijden of
   vrije kaarten, dan tonen ze die (op hun eigen schaal).
10. **Grafiekvorm**: scores liggen dicht bij elkaar, dus lijnen met punten
    en "bandbreedte + gemiddelde" per groep in plaats van staafdiagrammen
    vanaf nul (die verschillen onzichtbaar maken).
11. **Datum in de toekomst** is bij invoer niet toegestaan (max = vandaag).
12. **Dubbele invoer**: waarschuwing (geen blokkade) bij dezelfde datum,
    type, discipline, afstand, wapen en score binnen 15 minuten.
13. **Verwijderen ongedaan maken** herstelt de schietbeurt, maar niet een
    eventuele competitiekoppeling (die moet je dan opnieuw leggen).
14. **Wapen verwijderen** kan alleen zonder schietbeurten; anders archiveren,
    zodat historie bewaard blijft.
15. **Offline wachttijd**: met een verlopen token en een netwerk dat niet
    reageert, wacht de app 3 seconden voordat hij offline verdergaat (direct
    als de browser al weet dat er geen netwerk is).
16. **CSV**: puntkomma als scheidingsteken en decimale komma (Nederlandse
    Excel). Foto's zitten niet in de JSON-back-up.
17. **Live gezet** op 29 oktober 2026 (main). CI draait vóór elke deploy de
    typecheck en alle tests; faalt er één, dan blijft de oude site staan.
18. **Node 20 in CI** (`deploy.yml`) wordt sinds april 2026 niet meer
    ondersteund. Ongewijzigd gelaten om de bestaande deploy niet te raken;
    overstappen op Node 22 of 24 is een kleine, aanbevolen vervolgstap.
19. **Doorlopende vrije kaarten**: bij een nieuwe vrije kaart staat na elke
    ingevulde kaart een lege volgende klaar; kaart 1 bepaalt Score/Schoten voor
    alle kaarten. Elke ingevulde kaart wordt een eigen vrije kaart in het
    logboek. Wisselen van modus op kaart 1 bewaart volledig ingevulde schoten
    als kaartscore; andere invoer vervalt. Bij losse schoten staat het
    cijferpad vast onderaan, zodat het scherm niet verspringt.
20. **Oefenwedstrijd** staat niet meer bij nieuwe invoer (ook niet als snelle
    actie op het dashboard). Bestaande oefenwedstrijden blijven zichtbaar,
    bewerkbaar en tellen mee in de statistieken.
21. **Standaardwapens Karabijn 6 t/m 9**: type karabijn, eigendom “geleend /
    club”, kaliber leeg gelaten (niet bekend). Ook het tweede owner-account
    krijgt ze in zijn eigen lijst.
22. **Puntenbord-totaal**: de vereniging gaf niet aan hoe de periodes tot één
    eindstand worden gecombineerd; de app toont de som en het gemiddelde per
    periode met score.
23. **Periodes die al voorbij waren bij het aanmaken** van een competitie zijn
    “aan te vullen”: daar tellen ook later ingevoerde oude uitslagen en ze
    worden niet vastgezet. Zo kun je dit jaar alsnog compleet maken.
24. **Vastzetten** gebeurt zodra de module (op een van je apparaten) open is
    na het einde van een periode. Een uitslag die pas ná het einde van de
    periode is ingevoerd, telt niet meer voor die periode (ook zonder dat de
    app open was).
25. **Eén type per competitie** (wedstrijden óf vrije kaarten), omdat 50- en
    300-scores niet te vergelijken zijn. Oefenwedstrijden tellen nooit mee.
26. **Beste scores bij gelijke stand**: een score die gelijk is aan je laagste
    vervangt die niet (alleen hoger telt).
27. **Klapschijfschieten** is toegevoegd als standaarddiscipline (25 m,
    karabijn, later ook pistool). Nieuwe standaarddisciplines verschijnen
    vanzelf bij bestaande gebruikers, zonder verwijderde terug te halen.
