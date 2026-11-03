# Training

Persoonlijke fitness- en trainingscoach binnen Ons Huisje, bereikbaar via
`/#/training` (homepage → Meer → Training). Werkt volledig offline en
synchroniseert met Supabase zodra er internet is.

## Opbouw

| Map | Inhoud |
|---|---|
| `src/features/training/domain/` | Puur TypeScript, volledig getest: types, oefeningenbibliotheek, schema-sjablonen en generator, **vorige prestatie → nieuwe opdracht** (`performance.ts`), planning, schijvencalculator, rusttimer, statistiek/records, export, kleurenpaletten. |
| `src/features/training/db/` | IndexedDB (Dexie, één database per account), schrijfacties met wachtrij, mapping naar Supabase. |
| `src/features/training/sync/` | Sync-engine (push/pull/conflicten) en transport (Supabase-upsert). |
| `src/features/training/hooks/` | Provider, leeshooks, rusttimer, startacties. |
| `src/features/training/components/`, `workout/` | UI-bouwstenen, schijvencalculator, grafieken, stijlknop, trainingsscherm-onderdelen. |
| `src/features/training/training.css` | Alle kleuren als `--tr-*`-tokens (standaardpalet + donker). |
| `src/pages/training/` | De schermen. |
| `supabase/migrations/20261029020000_training.sql` | Tabellen, RLS, versie-/idempotentietrigger. **Toegepast op 29 okt 2026.** |
| `tests/training/` | Database-/RLS-tests en synctests (PGlite + fake-indexeddb), browsertest op telefoonformaat. |

Tests: `npm test` (ook in CI). Browsertest: `npm run build && npm run training:test-browser`
(draait offline tegen de lokale build, raakt nooit productie).

## Vorige prestatie wordt de nieuwe opdracht

Centraal in `domain/performance.ts` (`buildHistoryIndex`, `previousPerformance`, `buildPrescription`):

1. Alleen **voltooide**, niet-verwijderde trainingen tellen. Actieve, onderbroken,
   geannuleerde en overgeslagen trainingen overschrijven nooit de vorige prestatie.
2. Per oefening-id. Een andere variant (dumbbell vs. halterstang) is een eigen id,
   dus historie wordt nooit samengevoegd.
3. Meest recente uitvoering, of (instelling) alleen binnen hetzelfde schema.
4. Per set exact het gewicht en de herhalingen van toen. Een set die je toen niet
   deed, houdt het doel van toen.
5. Aantal sets = wat je toen had staan (inclusief zelf toegevoegde/verwijderde sets);
   is het schema sindsdien aangepast, dan volgt het aantal het schema.
6. Zelf verhoogt de opdracht nooit; dat doet alleen de **trainer** (zie hieronder),
   en alleen als je dat in Instellingen kiest.
7. Correcties achteraf (historie → set aanpassen) werken direct door in records,
   statistiek en de volgende opdracht, omdat alles uit de opgeslagen sets wordt afgeleid.

## Trainer: startgewichten en progressie

- **Startgewicht** (`domain/start-weights.ts`): per oefening een voorzichtig
  startgewicht voor beginner, gevorderd en expert (sets van ~8–12 herhalingen met
  2–3 in reserve). Afgerond op wat je met je schijven exact kunt laden en nooit
  zwaarder dan je voorraad toelaat. Volgorde: startgewicht in het schema → eigen
  startgewicht bij de oefening → trainer. Zodra je de oefening één keer hebt gedaan
  geldt alleen nog je eigen vorige prestatie, dus een verlaging blijft staan tot je
  zelf (of de trainer) weer verhoogt.
- **Advies** (`coachAdvice` in `domain/performance.ts`), dubbele progressie:
  - *verhogen*: alle sets op de bovenkant van het bereik (beginner en gevorderd na
    één keer, expert na twee keer op rij). Stap = 2 × kleinste schijf; beginners
    dubbel bij grote beenoefeningen met de stang. Herhalingen weer onderaan.
  - *afraden*: niet alle sets gedaan, of de ondergrens niet gehaald. Zet je het
    gewicht toch hoger, dan verschijnt "Trainer raadt dit af".
  - *verlagen*: twee keer op rij de meeste sets onder de ondergrens → ~10% lichter.
  - *opbouwen*: zelfde gewicht, één herhaling meer per set.
  - *maximum*: zwaarder kan niet met je schijven → extra set of langzamer zakken.
  - Grote sprong (> 10% en meer dan één stap) t.o.v. vorige keer → waarschuwing.
- **Stand** (Instellingen → Trainer): *Uit*, *Stelt voor* (standaard; één tik om
  over te nemen) of *Verhoogt zelf* (verhoging staat bij de start al klaar, met
  "Terug naar …"). Verlagen is altijd een voorstel.

## Niveaus en trainingsduur (generator)

| | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Sets uit sjabloon | −1 (min. 2) | zoals sjabloon | +1 basis/tweede oefening |
| Max sets per oefening (basis/isolatie) | 3 / 3 | 4 / 3 | 5 / 4 |
| Max werksets per training | 16 | 22 | 26 |
| Opwarmsets basisoefening | 1 | 2 | 2 |
| Herhalingsbereik | nooit 5–8 (eerst techniek) | volgens doel/dag | volgens doel/dag |
| Inspanning | 2–3 in reserve | 1–3 in reserve | 1–2, isolatie tot vlak bij falen |

Te weinig tijd: eerst optionele oefeningen weg, dan isolatiesets, dan ook de kern
(min. 2 sets). Tijd over: sets erbij (eerst basisoefeningen) tot de tijd vol is of
het plafond van het niveau bereikt is. PPL 6 dagen, ongeveer: beginner ~30–40 min,
gevorderd ~45–50 min, expert ~60–65 min; daarboven voegt extra tijd bewust niets toe.

## Synchronisatie en beveiliging

- Alles gaat eerst in IndexedDB, samen met een wachtrij-entry, in één transactie.
- Push = upsert op id (ids worden op het apparaat gemaakt). De trigger
  `training_touch` controleert de versie (conflict = SQLSTATE `TRC01`, nooit stil
  overschrijven) en herkent een herhaalde push aan `last_change_id` (idempotent).
- Eén set per positie (sessie, slot, soort, setnummer), zowel lokaal als in de
  database: dubbel tikken of netwerkherhaling geeft nooit dubbele sets.
- Conflict tussen apparaten: de andere versie wordt actief en jouw versie staat bij
  Instellingen → Synchronisatie om te kiezen.
- RLS: alleen eigen rijen, alleen voor de rol `owner` (`private.can_use_training()`),
  geen DELETE-recht (verwijderen = verwijdermarkering), geen security definer, geen
  service-role in de frontend. Systeemoefeningen en sjablonen staan in de app en zijn
  alleen-lezen.
- Gecontroleerd in productie: RLS aan op alle 6 tabellen, 3 policies per tabel, geen
  anon-toegang, geen delete.

## Wat werkt

- Schema's: Full Body 3×/week (A/B/C), vijfdaagse split (Upper/Lower/Push/Pull/Legs),
  PPL 6×/week (A kracht, B spiermassa), plus in de bibliotheek Full Body beginners 2×
  en Upper/Lower 4×. Afgestemd op niveau, doel, duur en apparatuur.
- Vaste weekplanning of doorlopende volgorde; gemist = inhalen, overslaan, andere dag kiezen.
- Schema-editor: dagen, weekdagen, oefeningen (toevoegen/vervangen/volgorde), sets,
  opwarmsets, herhalingsbereik of duur, rust, startgewicht; dupliceren, archiveren.
- Actieve training: grote setknop (opslaan + rust starten in één tik), ongedaan maken,
  plus/min en exact typen, schijvenknop, set toevoegen/verwijderen, opwarmsets,
  oefening vervangen/toevoegen/overslaan/verplaatsen, notities, onderbreken/hervatten,
  voortijdig afronden, annuleren.
- Rusttimer op deadline: pauze, hervatten, overslaan, ±15 s, rust per oefening,
  geluid, trillen, optionele melding, scherm aan houden, correct na herladen.
- Oefeningenbibliotheek (51 oefeningen) met techniek, fouten, veiligheid, filters,
  favorieten, eigen oefeningen.
- Historie met kalender, sessiedetail met correcties, opnieuw doen, verwijderen.
- Voortgang: trainingen per week/maand, volume per week, sets per spiergroep, records,
  grafieken per oefening (gewicht, herhalingen, volume, geschatte 1RM).
- Lichaamsgewicht per datum + omtrekmaten, met grafiek.
- Schijvencalculator met eigen voorraad (stang, 2 of 1 dumbbell, sluitingen, belastbaarheid).
- Export JSON en CSV. Eigen stijlknop met kleurenpaletten.

## Voorbereid, nog zonder UI

Supersets/dropsets (`groupId` in het schema), RPE/RIR (kolommen `rpe`, `rir`),
deloads/periodisering en import (nieuwe sjablonen/functies in `domain/`), extra media
(`link` per oefening), nieuwe apparatuur (vrije tekst in Instellingen).

## Beperkingen

- Meldingen na de rust werken alleen als de browser de pagina nog laat draaien. Op
  Android met vergrendeld scherm kan de melding vertraagd of overgeslagen worden; er
  is geen gegarandeerde achtergrondmelding (geen push vanaf de server). "Scherm aan
  houden" voorkomt dit tijdens het trainen.
- Lokale data staat per account in een aparte IndexedDB-database; wie het apparaat
  zelf bedient kan die technisch via de ontwikkelaarstools inzien.

## Openstaande keuzes

Beslissingen die ik zelfstandig heb genomen. Allemaal aan te passen.

1. **Toegang**: alleen de rol `owner`; elk owner-account krijgt een eigen, leeg logboek.
2. **Training valt buiten het sitebrede themasysteem** (op jouw verzoek), net als
   Schietsport. Eigen keuze Licht/Donker en eigen kleurenpaletten via de paletknop
   rechtsboven. Inter als lettertype, ook op koppen.
3. **Rollen in een eigen palet**: donkerste = tekst, lichtste = achtergrond, meest
   kleurrijke = hoofdactie, daarna = secundair, grijste = details; kleuren worden
   waar nodig lichter/donkerder gemaakt voor contrast. Maximaal 20 eigen paletten.
4. **Systeemoefeningen en sjablonen in de app**, niet in de database: alleen-lezen voor
   iedereen en zonder migratie uitbreidbaar. Eigen oefeningen staan wel in de database.
5. **Apparatuur, schijven en per-oefening-instellingen** (favoriet, notitie, rusttijd,
   startgewicht) staan als JSON in het profiel in plaats van aparte tabellen.
6. **Geen aparte programmaversietabel**: elke training bewaart een momentopname; het
   schema heeft een revisienummer. Oude trainingen veranderen daardoor nooit.
7. **Records worden berekend**, niet opgeslagen, zodat correcties altijd kloppen.
8. **Nieuwe oefening zonder historie**: startgewicht van de trainer voor je niveau
   (zie boven); bij lichaamsgewicht, tijd en eigen oefeningen geen gewicht.
   Herhalingen = ondergrens van het bereik.
9. **Opwarmsets** zonder historie: ~50% en ~75% van de eerste werkset (als die een
   gewicht heeft), 8 en 5 herhalingen. Rust na een opwarmset: maximaal 1 minuut.
10. **Gewicht aanpassen** bij een set zet de wijziging door naar de volgende nog niet
    gedane sets met dezelfde waarde (één keer +2 kg geldt voor alle sets).
11. **Plus/min-stap** = 2 × de kleinste schijf (nu 2 kg); exact typen kan altijd.
12. **Volume** = ingevoerd gewicht × herhalingen; bij dumbbells het gewicht per
    dumbbell (niet × 2); bij lichaamsgewicht alleen het extra gewicht.
13. **Geschatte 1RM**: Epley, alleen bij 1–12 herhalingen, uit te zetten.
14. **Sets per spiergroep**: primair 1, secundair ½, opwarmsets tellen niet.
15. **Progressie**: zie "Trainer". De oude hint (drie keer alles gehaald) geldt alleen
    nog voor lichaamsgewicht- en tijdsoefeningen.
16. **Overslaan** maakt een training met status "overgeslagen"; die telt als gedaan
    voor de planning, maar niet in statistiek of vorige prestaties.
17. **Trainingsduur** loopt vanaf de start, ook tijdens een onderbreking.
18. **Stanggewichten onbekend**: de calculator vraagt erom en bewaart het (weeg de
    stangen eens). Sluitingen standaard 0 kg en uit.
19. **Geen back squat, deadlift vanaf de vloer of step-up** in de standaardschema's
    (geen rek; kleine schijven geven een lage stang; step-up vraagt een stabiele
    verhoging). Bankdrukken met de waarschuwing niet tot falen te trainen.
20. **Lichaamsgewicht**: één meting per datum; opnieuw invullen past die aan.
21. **Een training starten terwijl er nog één open staat** opent de lopende training.
22. **Live zetten**: migratie is toegepast. De code staat op branch `training-module`
    en is samengevoegd met `main` (zie commitgeschiedenis); CI deployt daarna.
23. **Niveaunamen** Beginner / Gevorderd / Expert (was Beginner / Gemiddeld / Gevorderd);
    intern nog `beginner` / `intermediate` / `advanced`.
24. **Startgewichten** zijn vaste, voorzichtige waarden, niet afhankelijk van
    lichaamsgewicht of geslacht. Is het stang-/handvatgewicht nog onbekend, dan wordt
    afgerond op 2 kg en begrensd op wat de schijven alleen al kunnen.
25. **Trainerstand standaard "Stelt voor"**, omdat je eerder zelf je progressie wilde
    bepalen. Wie de hints had uitgezet krijgt "Uit".
26. **Startgewicht volgt het niveau van het schema** (niet het profiel), zodat een
    later gewijzigd profielniveau een bestaand schema niet verandert.
27. **Na een schema altijd een overzicht** met wat er is aangepast en de
    inspanningsrichtlijn van je niveau.
