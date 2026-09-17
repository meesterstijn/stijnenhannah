# Game Night zonder accounts

De host logt in met het bestaande owner-account, opent een avond en toont de
QR-code. Terugkerende gasten kiezen hun opgeslagen speler zonder pincode of
bevestiging. Nieuwe gasten kiezen een naam, kleur, outfit en gezicht. Naam en
avatar worden blijvend opgeslagen; de volgende avond hoeft dit niet opnieuw.
Dezelfde speler-ID behoudt de spelhistorie. Gasten krijgen een eigen telefoonlobby
en kunnen hun speler aanpassen. De host beheert de tafel, spellen en uitslagen.

## Live zetten

1. Voer na de bestaande migraties
   `supabase/migrations/20260926000000_game_night_guests.sql` en daarna
   `supabase/migrations/20260927000000_game_night_player_selection.sql` uit in
   Supabase (SQL Editor, of de gebruikelijke migratiedeploy). Beide bestanden
   zijn een transactie. Is de eerste migratie al uitgevoerd, voer dan alleen
   de tweede uit.
2. Publiceer de nieuwe websitebuild met de gebruikelijke deployprocedure.
3. Open als host een Game Night. Scan de QR met twee verschillende telefoons,
   kies verschillende avatars en ververs beide pagina's. Controleer ook dat
   een gewijzigde naam/avatar op het hostscherm verschijnt. Open een volgende
   avond, scan de nieuwe QR en kies je bestaande speler. Controleer dit ook
   vanuit een andere browser: de speler en avatar moeten hetzelfde blijven.

Er is geen Auth-configuratiewijziging, SMTP, gedeeld account, service-role-key
in de browser of extra Edge Function nodig. Deze wijziging maakt geen
`auth.users`- of `profiles`-rijen aan. Database- en verkeerslimieten blijven gelden.
De deployvolgorde is belangrijk: de oude website blijft met de nieuwe migratie
werken; de nieuwe website heeft de nieuwe RPC's nodig.

De outfitcatalogus blijft dezelfde databasecatalogus als voor de bestaande
creator. Nieuwe bestanden worden met `npm run game-night:generate-assets`
geïnventariseerd; de bestaande `supabase/generated/game_night_custom_bodies.sql`
kan gebruikt worden om de catalogus bij te werken. Dat is geen vereiste voor
gasttoegang: zonder outfits kan een gast nog steeds een gezicht kiezen.

## Identiteit en toegang

- Een cryptografisch willekeurige code van 32 bytes wordt **vóór deelname**
  opgeslagen onder `game-night-guest-v1` in localStorage. Dit is een persoonlijke
  toegangscode, geen deelbare uitnodiging; de code komt niet in de URL.
- De database bewaart alleen een SHA-256-hash in `private.game_night_guests`.
  Rechtstreekse toegang tot die tabel en helpers is ingetrokken voor gasten en
  ingelogde gebruikers. Alleen smalle `SECURITY DEFINER`-RPC's zijn bereikbaar.
- Spelers blijven in `game_night_players`; aanwezigheid, zitplaatsen en outfits
  gebruiken de bestaande tabellen. Bestaande accounts en rollen veranderen niet.
- Een geldige uitnodiging toont de namen en avatars van beschikbare opgeslagen
  spelers. Iedereen met die uitnodiging mag vrij een speler kiezen, conform de
  gekozen werkwijze voor deze vriendengroep. Gearchiveerde spelers staan er niet bij.
- Een uitnodiging geeft alleen toegang tot de bedoelde avond. Gastcodes geven
  alleen toegang tot avonden waarvoor **dat apparaat** via een uitnodiging is
  toegelaten, bijgehouden in `private.game_night_guest_sessions`. Een nieuwe
  telefoon die een bestaande speler kiest krijgt dus geen automatische toegang
  tot andere avonden waarin die speler eerder deelnam.
  De respons bevat geen account-IDs, privéfoto's, scores van andere avonden of
  beheerrechten. Accountspelers krijgen op het gastscherm een initiaal als hun
  gezicht alleen via privé-opslag beschikbaar is.
- Een herhaalde aanvraag is idempotent. Een gast die door de host van tafel is
  gehaald, komt niet automatisch terug door te verversen of opnieuw te scannen.
  De host kan die speler via de bestaande lobby weer toevoegen.
- Nieuwe gasten kunnen tussen spellen aansluiten. Tijdens een lopend spel
  krijgen ze een melding om te wachten, overeenkomstig de bestaande tafelregels.
- De guest RPC begrenst een avond op 64 deelnemers. De sessierij wordt gelockt
  voor capaciteit en zitplaatstoewijzing; gelijktijdige aanvragen met dezelfde
  gastcode worden ook geserialiseerd.
- De gastcode is 180 dagen geldig, verlengd bij deelname aan een nieuwe avond.
  Een verlopen apparaatcode kan via een nieuwe uitnodiging worden vervangen
  door dezelfde speler opnieuw te kiezen. Naam, avatar en historie verlopen niet.
  Archiveren van een speler blokkeert de gastcode. Een host kan een code daarnaast
  via de database intrekken met `revoked_at`. Er is geen nieuw beheerportaal.
- Verversen en een verlopen/vernieuwde QR behouden bestaande deelname. De
  gastlobby haalt iedere vijf seconden alleen de huidige avond op, zolang het
  tabblad zichtbaar is en de avond niet afgelopen is. De host gebruikt de
  bestaande Realtime-verbinding.

Bij gewiste browseropslag, een andere browser of een andere telefoon kan de gast
via de QR gewoon zijn bestaande speler kiezen. Op hetzelfde apparaat staat de
herkende speler bovenaan. De keuze gebruikt de speler-ID, zodat twee spelers met
dezelfde naam nooit automatisch worden samengevoegd. Een expliciete keuze voor
een andere speler krijgt een nieuwe apparaatcode; bestaande codes worden nooit
aan een andere speler gekoppeld. Meerdere apparaten mogen dezelfde speler kiezen,
maar maken samen slechts één aanwezigheid en tafelplek voor die speler aan.
Ook bestaande accountspelers zijn te kiezen; dat wijzigt geen account of rol en
geeft nooit de bijbehorende accountrechten. Opnieuw kiezen wijzigt de bestaande
naam, kleur, outfit en eventuele privéfoto niet.

## Verificatie

```sh
npm ci
npm run game-night:test-guests
npm run build
npx tsc --noEmit
```

De databasetests draaien echte Game Night-migraties in lokaal PostgreSQL/WASM
(PGlite), met minimale vervangers voor Supabase Auth en Storage. Ze schrijven
niets naar Supabase.

Start voor de browsertest `npm run dev`. Installeer een Playwright Chromium met
`npx playwright install chromium`, of wijs naar een bestaande Chromium:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run game-night:test-guests-browser
```

De browsertest onderschept alle Supabase-aanvragen en voert de gast-RPC's uit in
de testdatabase. Hij controleert 320–1280 px, twee telefoons, herstel na een
verloren join-antwoord, verversen, profielbewerking, polling, afgeschermde avonden,
verlopen QR-codes, netwerkfouten en geblokkeerde browseropslag. Daarnaast test hij
vrij kiezen op een andere telefoon en hergebruik tijdens een volgende avond.
Screenshots staan na afloop in `/tmp/game-night-guest-join.png`,
`/tmp/game-night-guest-lobby.png` en `/tmp/game-night-player-picker.png`.
