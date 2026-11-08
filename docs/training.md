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
8. **Doelen per set** (schema-editor → "Per set instellen", bijv. 10 × 20, 10 × 25,
   8 × 30 kg): gelden de eerste keer, en opnieuw zodra je ze in het schema wijzigt
   (vergeleken met de doelen die bij de vorige training in het schema stonden,
   `plannedTargets` in de momentopname). Daartussen geldt regel 4: per set wat je
   echt deed. De trainer geeft bij zulke oefeningen geen advies.

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
- RLS: alleen eigen rijen, alleen voor de rollen `owner` en `training_user`
  (`private.can_use_training()`),
  geen DELETE-recht (verwijderen = verwijdermarkering), geen security definer, geen
  service-role in de frontend. Systeemoefeningen en sjablonen staan in de app en zijn
  alleen-lezen.
- Gecontroleerd in productie: RLS aan op alle 6 tabellen, 3 policies per tabel, geen
  anon-toegang, geen delete.

## Account alleen voor Training (`training_user`)

Voor iemand buiten het huishouden, bijvoorbeeld een tester. Sinds 7 nov 2026
(`20261107000000_training_user_role.sql`).

- Ziet alleen `/training` en alles daaronder; elke andere pagina stuurt terug naar
  `/training` (`RequireAppAccess`). Geen "Ons Huisje"-link, wel een uitlogknop
  rechtsboven.
- Database: alleen de eigen trainingsrijen. Geen andere `is_*`/`can_*`-helper kent
  deze rol, dus alle andere features blijven dicht. Rol wijzigen kan hij niet
  (alleen owner via `set_profile_role`; kolomrechten staan alleen `display_name` toe).
- Tegelijk gesloten (`20261107000100_close_legacy_open_policies.sql`): oude
  policies die elk ingelogd account toegang gaven tot kalender, taken, boodschappen,
  BBQ en producthistorie (`product_history_upfront` zelfs zonder login), plus het
  inzien van alle profielen. Nu alleen owner.

Account aanmaken:
1. Supabase Dashboard → Authentication → Users → *Add user* (e-mail + wachtwoord,
   of *Send invitation*). Het account begint als `no_access`.
2. In de SQL-editor (als owner, met de uuid uit de gebruikerslijst):
   `select public.set_profile_role('<uuid>', 'training_user');`
3. Weer intrekken: dezelfde regel met `'no_access'`.

Uitgenodigd via e-mail? Na de link vraagt de site eerst om een wachtwoord
(`src/pages/SetPassword.tsx`); op het inlogscherm staat ook "Wachtwoord vergeten?".
Vereist dat in Supabase → Authentication → URL Configuration de Site URL
`https://stijnenhannah.nl` is (niet localhost).

## Feedback (testfase)

Sinds 8 nov 2026 (`20261108000000_training_feedback.sql`).

- Knop **Feedback** rechtsonder op elke trainingspagina, ook tijdens een training.
  Optioneel een soort (Er gaat iets mis / Idee / Onduidelijk), dan een tekst.
- Automatisch mee: de pagina (route + leesbare naam + paginakop, bijv.
  "Oefening · Bankdrukken (halterstang)"), versie (commit + bouwmoment), scherm,
  app-modus, browser, online-status, lopende training en het e-mailadres van de melder.
- Offline: bewaard in een lokale wachtrij (`training:feedback-queue`) en verstuurd
  zodra er weer verbinding is. Het id komt van de app, dus opnieuw versturen geeft
  nooit dubbele meldingen.
- Lezen: **Meer → Feedback** (alleen owner), met filter open/afgehandeld, link naar
  de pagina, details, afvinken en verwijderen. Ook via de CLI:
  `npx supabase db query --linked "select created_at, kind, page_label, message from training_feedback where resolved_at is null order by created_at desc"`
- Uitzetten na de testfase: `FEEDBACK_BUTTON_ENABLED = false` in
  `src/features/training/feedback/feedback.ts`. Het overzicht blijft werken.
- RLS: toevoegen alleen als jezelf en met Training-toegang; lezen eigen meldingen,
  owner alles; afhandelen/verwijderen alleen owner (`tests/training/feedback.test.ts`).

## Updates ("Wat is er nieuw") en reacties op feedback

Sinds 8 nov 2026.

- Updates staan in de code: `src/features/training/updates/updates.ts`, nieuwste
  bovenaan. **Bij elke release voor gebruikers een update bovenaan toevoegen** met een
  nieuw, uniek id (ids nooit wijzigen). Geschreven voor de gebruiker: wat je nu kunt
  en waar je het vindt.
- Venster "Wat is er nieuw": één keer per update per gebruiker, bij het openen van
  Training (niet tijdens een training, en niet in de sessie waarin het profiel net
  is aangemaakt). Laatst gezien staat in de instellingen (`lastSeenUpdate`,
  `lastSeenReplyAt`) en synchroniseert dus mee naar andere toestellen. Wie nog nooit
  iets zag, krijgt alleen de nieuwste update.
- **Meer → Updates**: de laatste 10 updates, plus "Jouw feedback" met de reactie.
- Reageren op feedback: Meer → Feedback → reactie schrijven (kolommen `reply`,
  `replied_at`, migratie `20261108020000_training_feedback_reply.sql`). De melder
  ziet een nieuwe reactie één keer in het venster en altijd onder Updates.

## Eigen oefeningen delen (na goedkeuring)

Sinds 8 nov 2026 (`20261108010000_training_shared_exercises.sql`).

- Een eigen oefening is **privé**: alleen de maker ziet hem (RLS op
  `training_exercises`, ook voor de owner). Bij het aanmaken staat dat erbij.
- De owner ziet ze onder **Meer → Nieuwe oefeningen** (via de functie
  `training_exercise_submissions()`, niet via de tabel, zodat de sync van de owner
  geen oefeningen van anderen binnenhaalt). Daar: naam aanpassen, **Goedkeuren voor
  iedereen** of **Afwijzen**; later **Niet meer delen** of opnieuw delen.
- Goedkeuren maakt een kopie in `training_shared_exercises` (naam en gegevens op
  dat moment, zelfde id). Iedereen met Training laadt die bij het openen (gecachet in
  localStorage, dus ook offline) en ziet ze tussen de gewone oefeningen; niet
  bewerkbaar. De maker blijft zijn eigen versie zien.
- Past de maker de oefening na goedkeuring aan, dan meldt de beoordelingspagina dat
  en kun je die versie opnieuw delen.
- Tests: `tests/training/shared-exercises.test.ts`.


- Schema's: Full Body 3×/week (A/B/C), vijfdaagse split (Upper/Lower/Push/Pull/Legs),
  PPL 6×/week (A kracht, B spiermassa), plus in de bibliotheek Full Body beginners 2×
  en Upper/Lower 4×. Afgestemd op niveau, doel, duur en apparatuur.
- Vaste weekplanning of doorlopende volgorde; gemist = inhalen, overslaan, andere dag kiezen.
- Schema-editor: dagen, weekdagen, oefeningen (toevoegen/vervangen/volgorde), sets,
  opwarmsets, herhalingsbereik of duur, rust, startgewicht; dupliceren, archiveren.
- Na elke werkset, ook tijdens de rust: "Hoeveel herhalingen deed je?" met een rij
  getallen rond het doel (4 lager tot 2 hoger). Eén tik past de set aan, het doel met
  vinkje bevestigt, "Anders…" opent de set (ook gewicht), plus ongedaan maken.
  Eenmalige uitleg "Zo werkt een training" bij de eerste training (`workoutIntroSeen`).
- Actieve training: grote setknop (opslaan + rust starten in één tik), ongedaan maken,
  plus/min en exact typen, schijvenknop, set toevoegen/verwijderen, opwarmsets,
  oefening vervangen/toevoegen/overslaan/verplaatsen, notities, onderbreken/hervatten,
  voortijdig afronden, annuleren.
- Rusttimer op deadline: pauze, hervatten, overslaan, ±15 s, rust per oefening,
  geluid, trillen, optionele melding, scherm aan houden, correct na herladen.
- Oefeningenbibliotheek (51 oefeningen) met techniek, fouten, veiligheid, filters,
  favorieten, eigen oefeningen. Een eigen oefening kan ook direct vanuit het
  kiesvenster (schema of lopende training): zoek, en kies "… als eigen oefening
  toevoegen" (naam, waarmee, spiergroep; de rest later via Oefeningen).
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

1. **Toegang**: de rollen `owner` en `training_user`; elk account krijgt een eigen,
   leeg logboek. Rollen toekennen gaat (nog) via één regel SQL, er is geen beheerscherm.
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
28. **Feedback zonder melding naar de owner**: er is (nog) geen push of mail bij een
    nieuwe melding; het aantal open meldingen staat bij Meer → Feedback. Een push via
    de bestaande web-push-functies kan later.
29. **Feedback zonder screenshot**: alleen tekst plus context. Een schermafbeelding
    vraagt opslag (bucket) en is lastig betrouwbaar te maken op telefoons.
30. **Snelle eigen oefening "Machine of kabel"** heeft geen apparatuureis, zodat hij
    niet als "Apparatuur ontbreekt" onderaan komt; gewicht in kg zonder schijven.
31. **Sheet-focus**: `Sheet` gebruikt `onClose` via een ref; voorheen sprong de
    focus terug bij elke nieuwe `onClose` (de workout rendert elke seconde), wat
    typen in een sheet tijdens een training onmogelijk maakte.
32. **Eigen oefeningen van de owner** staan niet in de beoordelingslijst (alleen die
    van anderen). Wil je er zelf één delen, dan kan dat nu nog niet via de app.
33. **Geen melding aan de maker** over goedkeuring of afwijzing; na goedkeuring
    verandert er voor de maker niets zichtbaars (hij houdt zijn eigen versie).
34. **Goedgekeurd = kopie**: latere wijzigingen van de maker gaan pas mee als je ze
    opnieuw deelt. Na intrekken blijven gelogde sets bewaard, maar de oefening is
    voor anderen niet meer te kiezen (niet uitgebreid getest hoe oude trainingen
    hem dan tonen).
35. **Knop "Eigen oefening toevoegen" bovenaan** in het kiesvenster (onder zoeken),
    omdat hij onderaan een lijst van 50+ oefeningen niet te vinden was.
36. **Doelen per set**: aanleiding was feedback van de eerste tester (8 nov). Een
    gewijzigde piramide in het schema gaat voor op de vorige prestatie, net als een
    gewijzigd aantal sets. Trainer zwijgt bij deze oefeningen, omdat dubbele
    progressie gelijke sets veronderstelt.
37. **Updates in de code, niet in de database**: horen bij een release, dus bij de
    commit. Nadeel: een update toevoegen vraagt een deploy.
38. **Nieuwe gebruiker ziet alleen de nieuwste update**, niet de hele geschiedenis;
    alles staat wel onder Meer → Updates.
39. **Herhalingen bevestigen is optioneel**: niets tikken = het doel geldt als gehaald
    (zoals voorheen). Bewust geen verplichte vraag na elke set, om het tempo erin te
    houden.
40. **Wie nog nooit een update zag**, krijgt alle updates van de nieuwste dag (niet
    alleen de allernieuwste), zodat een release met meerdere updates compleet is.
