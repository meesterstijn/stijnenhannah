# Game Night zonder accounts

De host logt in met het bestaande owner-account, opent een avond en toont de
QR-code. Terugkerende gasten kiezen hun opgeslagen speler zonder pincode of
bevestiging. Nieuwe gasten kiezen een naam, kleur en outfit, en maken of kiezen
een gezichtsfoto met dezelfde foto-, crop- en contourbewerker als accountspelers. Naam en
avatar worden blijvend opgeslagen; de volgende avond hoeft dit niet opnieuw.
Dezelfde speler-ID behoudt de spelhistorie. Gasten krijgen een eigen telefoonlobby
en kunnen hun speler aanpassen. De host beheert de tafel, spellen en uitslagen.

## Live zetten

1. Voer na de bestaande migraties
   `supabase/migrations/20260926000000_game_night_guests.sql` en daarna
   `supabase/migrations/20260927000000_game_night_player_selection.sql` uit in
   Supabase (SQL Editor, of de gebruikelijke migratiedeploy).
   **Zijn die twee al uitgevoerd? Voer ze niet opnieuw uit.** Voer voor de
   gezichtsfoto's alleen het nieuwe bestand
   `supabase/migrations/20260928000000_game_night_guest_faces.sql` uit.
   Plak de volledige inhoud van het bestand in een lege SQL-query, zonder
   Markdown-codebloktekens. Deze nieuwe migratie is heruitvoerbaar.
2. Deploy de Edge Function `game-night-guest-faces`:

   ```sh
   npx supabase functions deploy game-night-guest-faces --project-ref lrqivcfuiuskqkpmyxfo
   ```

   De CLI moet hiervoor ingelogd zijn op het juiste Supabase-account.
   Zonder CLI kan dit via **Supabase → Edge Functions → Deploy a new function
   → Via Editor**: noem de functie `game-night-guest-faces`, vervang `index.ts`
   door de volledige inhoud van
   `supabase/functions/game-night-guest-faces/index.ts` en deploy.
   Zet bij deze functie **Verify JWT / Enforce JWT Verification uit**.
   Bij CLI-deploy regelt `supabase/config.toml` dit al. De functie controleert
   zelf de bestaande gastcode of geldige QR-uitnodiging via de database.
   `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zijn standaard beschikbaar in
   Supabase Edge Functions; zet deze geheime sleutel nooit in de website.
3. Publiceer de nieuwe websitebuild met de gebruikelijke deployprocedure.
4. Open als host een Game Night. Scan de QR met twee verschillende telefoons,
   kies verschillende avatars en ververs beide pagina's. Controleer ook dat
   een gewijzigde naam/avatar op het hostscherm verschijnt. Open een volgende
   avond, scan de nieuwe QR en kies je bestaande speler. Controleer dit ook
   vanuit een andere browser: de speler en avatar moeten hetzelfde blijven.

Er is geen Auth-configuratiewijziging, SMTP, gedeeld account of service-role-key
in de browser nodig. Deze wijziging maakt geen
`auth.users`- of `profiles`-rijen aan. Database- en verkeerslimieten blijven gelden.
De deployvolgorde is belangrijk: de oude website blijft met de nieuwe migratie
werken; de nieuwe website heeft de nieuwe RPC's nodig.

### Foto opslaan meldt een fout

Geeft `/functions/v1/game-night-guest-faces` HTTP **404** met
`{"code":"NOT_FOUND","message":"Requested function was not found"}`? Dan is de
Edge Function nog niet gedeployed onder die exacte naam in dit project.
Het uitvoeren van de SQL of publiceren van de website maakt deze functie niet
aan. Voer stap 2 hierboven uit. De fotomigratie hoeft daarvoor niet opnieuw.

De website herkent deze fout nu als “Gezichtsfoto’s zijn nog niet beschikbaar”.
Laat het formulier open: de gekozen en bijgesneden foto blijft in het formulier
staan. Na het deployen kan dezelfde opslaanknop opnieuw worden gebruikt.
Verversen vóór het opslaan verliest de nog niet geüploade foto.

Deze oorzaak is op 17 september 2026 bevestigd met een live, niet-mutatieve
controle: de fotofunctie gaf `404 NOT_FOUND`, terwijl de databasefunctie
`game_night_guest_face_access` wel aanwezig was en toegang zonder gastcode correct
weigerde. Beheerderstoegang tot Supabase is nodig om de Edge Function te deployen.

De outfitcatalogus blijft dezelfde databasecatalogus als voor de bestaande
creator. Nieuwe bestanden worden met `npm run game-night:generate-assets`
geïnventariseerd; de bestaande `supabase/generated/game_night_custom_bodies.sql`
kan gebruikt worden om de catalogus bij te werken. Dat is geen vereiste voor
gasttoegang: zonder outfits kan een gast nog steeds een gezichtsfoto kiezen.

## Gezichtsfoto's

- **Foto maken of kiezen** opent de bestaande bewerker: systeemcamera/galerij,
  positioneren en zoomen, lokale achtergrondverwijdering, handmatige hoofdcontour
  en een voorbeeld op de gekozen outfit. De emoji-keuzelijst is verwijderd.
- De foto wordt voorbereid op het apparaat en samen met **Aan tafel!** of
  **Mijn speler opslaan** bewaard. Annuleren van de fotobewerker behoudt de
  ingevoerde naam, kleur, outfit en eerder gekozen foto. Zonder foto kan iemand
  ook aansluiten en later via **Naam en avatar aanpassen** een foto toevoegen.
- Het origineel en de transparante 512×512 PNG blijven in de bestaande privébucket
  `game-night-player-faces`. De functie geeft tijdelijke upload- en leesrechten,
  na controle van de gasttoegang. Gasten kunnen alleen hun eigen foto opslaan
  zolang zij aan tafel zitten in een niet-afgelopen avond.
- Een geldige QR geeft toegang tot de uitgesneden gezichten in de spelerkiezer.
  Een toegelaten apparaat kan de gezichten in zijn eigen lobby zien. Het
  oorspronkelijke fotobestand wordt niet aan andere gasten verstrekt.
- Een upload gebruikt nieuwe paden. Pas wanneer beide bestanden bestaan, wordt
  de spelersrij bijgewerkt. Een mislukte vervanging beschadigt zo de vorige foto
  niet; opnieuw proberen vereist geen nieuwe foto of nieuw spelersprofiel.
  Oude/afgebroken uploads worden niet automatisch verwijderd.
- Naam, outfit en gezicht blijven gekoppeld aan dezelfde speler-ID, ook na
  verversen of vrij terugkiezen op een ander apparaat. Het bestaande hostscherm
  gebruikt dezelfde foto via de bestaande opslagrechten.

De gedeelde bewerker staat in `src/features/game-night/components/FacePhotoEditor.tsx`.
`GameNightFaceSetup.tsx` blijft de ingang voor accountspelers; `GuestProfileForm.tsx`
gebruikt dezelfde bewerker voor gasten. De uploadhulpfunctie staat in
`src/features/game-night/lib/guestFaceStorage.ts`. De aanpak volgt Supabase's
[toegangscontrole voor Edge Functions](https://supabase.com/docs/guides/functions/auth).

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
  De respons bevat geen account-IDs, originele foto's, scores van andere avonden of
  beheerrechten. Voor gezichten bevat hij alleen het opslagpad van de uitgesneden
  avatar en de wijzigingsdatum; de Edge Function controleert toegang opnieuw
  voordat hij een tijdelijke lees-URL verstrekt.
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
niets naar Supabase. De fototests controleren ook privé-originelen, eigen
uploadpaden, ontbrekende uploads, ingetrokken toegang en behoud van oude foto's.

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
Hij doorloopt ook de echte foto-/crop-/MediaPipe-/contourpipeline, controleert
het resultaat van 512×512 pixels en herstelt na een onderbroken foto-upload.
De werkelijke Edge Function draait lokaal tegen de SQL-testdatabase; alleen
Supabase Storage wordt nagebootst. De MediaPipe-runtime komt uit de lokaal
geïnstalleerde package. Dit controleert de integratie zonder productieaanvragen;
controleer na deploy nog één keer de echte Supabase-opslag en de telefooncamera.
Screenshots staan na afloop in `/tmp/game-night-guest-join.png`,
`/tmp/game-night-guest-lobby.png`, `/tmp/game-night-player-picker.png` en
`/tmp/game-night-guest-face-preview.png`.
