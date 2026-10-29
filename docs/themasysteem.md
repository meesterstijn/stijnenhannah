# Themasysteem

Dit is een live wisselbare, modulaire vormgeving voor Ons Huisje. Het systeem is puur visueel: routes, data, opslag en logica blijven ongewijzigd.

## Gebruik

- **Paletknop**: in de bovenbalk van Home (naast uitloggen), van alle algemene pagina's (naast Notities/To-do) en van Boodschappen (naast "Ons Huisje").
- **Thema's**: Origineel plus stijl 1, 2, 4, 5, 6 en 7 uit de referentieafbeelding. Eén klik zet alle zeven categorieën tegelijk.
- **Zelf samenstellen**: kies per categorie (Kleuren, Lettertype, Kaarten, Achtergrond, Iconen, Navigatie, Effecten) een stijl. Elke keuze wijzigt alleen die ene categorie. Daaronder staan *Herstellen naar standaardthema*, *Mijn combinatie opslaan* en de lijst met opgeslagen combinaties (kiezen of verwijderen). Opgeslagen combinaties staan ook op het tabblad Thema's.
- Bij het eerste bezoek is **Origineel** actief. Zolang alles op Origineel staat, krijgt `<html>` geen enkel attribuut of token en is de site exact zoals voorheen.

## Opbouw (`src/features/theme/`)

| Bestand | Rol |
| --- | --- |
| `tokens.ts` | Types, de zeven categorieën, attribuutnamen, uitgesloten modules |
| `presets.ts` | De zes stijlen. Per categorie alleen bladwaarden: kleur, lengte, percentage, afbeelding |
| `composer.ts` | Plakt de gekozen categorieën samen tot CSS-variabelen en `data-ht-*`-attributen, en legt een sluier over de achtergrond bij een conflict |
| `storage.ts` | localStorage: keuze, eigen presets en een cache voor het opstartscript. Met validatie en fallback |
| `ThemeProvider.tsx` | Zet tokens en attributen op `<html>` (layout-effect, geen tussenframe) en laadt alleen het benodigde webfont |
| `ThemeSwitcher.tsx` / `ThemePreview.tsx` | Paneel met twee tabbladen. Previews gebruiken dezelfde tokens en formules als de echte pagina |
| `theme.css` | De enige plek waar tokens stijl worden. Elke regel valt terug op de oude waarde |
| `index.html` (inline script) | Zet het opgeslagen thema vóór React laadt, zodat er geen flits is |

**Opslagsleutels**: `onshuisje.theme.selection.v1` (laatste keuze), `onshuisje.theme.custom-presets.v1` (eigen combinaties) en `onshuisje.theme.applied.v1` (afgeleide cache voor het opstartscript).

**Haakjes in bestaande markup**: dit zijn alleen klassen, zonder effect als er geen thema actief is.

- `ht-card` en `ht-card-interactive` in `cardSurface()`
- `ht-icon-slot` in `ModernPageHeader` en `ModernEmptyState`
- `ht-topbar` op de algemene header

## Nieuwe stijl toevoegen

1. Voeg een id toe aan `THEME_STYLE_IDS` in `tokens.ts`.
2. Kopieer een stijlblok in `presets.ts` en vul dezelfde sleutels in. `theme.test.ts` controleert dat er geen sleutel ontbreekt en dat er geen `var()` in staat.
3. Klaar: het paneel, de previews en de keuzemenu's nemen de stijl automatisch op. Componenten hoef je niet aan te passen.

Een nieuw *token* voeg je toe in alle presets en gebruik je in `theme.css`, steeds met `var(--ht-x, <oude waarde>)`.

## Openstaande keuzes

- **Modules met een eigen identiteit blijven altijd origineel**: Rainbow Six Siege, Cocktail Bar, Gitaar, Game Night, Schietsport, Tuinieren en Tuingids. Ze hebben eigen scoped tokens en achtergronden, en een thema eroverheen zou hun vormgeving breken. Het gekozen thema blijft bewaard en geldt weer zodra je terug bent op een algemene pagina. Op die modules staat geen paletknop, omdat ze geen gedeelde bovenbalk hebben. Aanpassen kan via `THEME_EXCLUDED_PREFIXES`.
- **Achtergronden zijn CSS/SVG en geen foto's**: avondlandschap (4), nachtbergen (2), neonraster (6), papierkorrel (5). Er zijn geen bruikbare stockfoto's in `public/`, en de persoonlijke `home-hero.jpg` hoort bij Origineel.
- **Lettertypes**: 1 Plus Jakarta Sans, 2 Inter (al geladen), 4 Manrope, 5 Libre Baskerville + Lora, 6 Exo 2, 7 IBM Plex Sans. Ze komen van Google Fonts en worden alleen geladen als ze gekozen zijn. De previews tonen het lettertype pas als het geladen is.
- **"Nostalgische iconen" (5)** zijn benaderd met een gestempelde icoontegel rond de bestaande lucide-iconen. Echte geïllustreerde iconen zouden nieuwe assets vragen.
- **Lijndikte van iconen** geldt uniform voor alle lucide-iconen op themapagina's. De oorspronkelijke variatie per icoon (1.6/1.8/2) vervalt zolang de categorie Iconen gekozen is.
- **Conflicten bij mixen**: wijkt de toon van de achtergrond af van het tekstschema van de kleuren, dan legt de composer er een sluier in de paginakleur overheen. Halfdoorzichtige kaarten worden vrijwel dekkend als `backdrop-filter` niet beschikbaar is.
- **Boodschappen**: het witte kassabonpapier krijgt bij een gekozen palette de kaartkleur van die palette, anders was het onleesbaar in donkere thema's. Bij Origineel blijft het wit.
