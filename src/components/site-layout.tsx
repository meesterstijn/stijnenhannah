import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, NotebookPen, ListTodo, Sprout } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { WeatherForecast } from "@/components/weather-forecast";
import { useAuth } from "@/contexts/AuthContext";

const nav = [
  { to: "/notities", label: "Notities", icon: NotebookPen },
  { to: "/todo", label: "To-do", icon: ListTodo },
] as const;

// Vroeger als eigen <nav> binnen CocktailBarLayout gerenderd (in de
// paginainhoud); staat nu hier zodat de knoppen naast de zwevende "Ons
// Huisje"-link kunnen staan, in dezelfde vaste hoek.
const cocktailBarNav = [
  { to: "/cocktail-bar", label: "Cocktails" },
  { to: "/cocktail-bar/dashboard", label: "Dashboard" },
  { to: "/cocktail-bar/bereiden", label: "Bereiden" },
  { to: "/cocktail-bar/beheren", label: "Beheer" },
] as const;

export function SiteLayout() {
  const { pathname } = useLocation();
  // Een r6_player komt (via RequireAppAccess) sowieso nooit buiten
  // /rainbow-six-siege — de "Ons Huisje"-link zou 'm alleen maar terugsturen
  // naar waar hij toch niet mag komen. Geen algemene link naar privépagina's
  // tonen aan die rol, zie ook de gebruikersrollen-opdracht sectie 7. Game
  // Night V2.3 (sectie 18): een game_night_member zit in dezelfde situatie
  // op elke /game-night/*-pagina — "Ons Huisje" zou 'm alleen terugsturen
  // naar "/", waar RequireAppAccess 'm toch weer naar /game-night/me stuurt.
  const { isR6Player, isGameNightMember } = useAuth();
  const isTuinieren = pathname === "/tuinieren";
  // Rainbow Six-pagina's hebben hun eigen, donkere gaming-vormgeving en
  // willen geen volle navbalk die daaroverheen hangt — alleen een manier om
  // terug naar de homepage te gaan moet altijd bereikbaar blijven. Die knop
  // (dezelfde "Ons Huisje"-link als op elke andere pagina) zweeft daarom als
  // los, klein element over de pagina i.p.v. in een volle balk te zitten.
  const isR6 = pathname.startsWith("/rainbow-six-siege");
  // De sessiedetailpagina (LAN-avond -> :sessionId) rendert "Ons Huisje" zelf
  // inline, samen met de Status/Datum/Looptijd/Gimma's-blokken in één rij —
  // de zwevende variant zou daar dus dubbel op staan.
  const isR6SessionDetail = /^\/rainbow-six-siege\/lan\/[^/]+$/.test(pathname);
  // Cocktail Bar-routes buiten SiteLayout (tablet/big-screen) bestaan niet
  // via deze component — hier gaat het alleen om de owner-facing pagina's
  // (showcase/beheer/bereiden/dashboard), die net als R6 hun eigen donkere
  // thema en een zwevende terug-link i.p.v. de volle navbalk willen.
  const isCocktailBar = pathname.startsWith("/cocktail-bar");
  // Gitaar heeft net als R6/Cocktail Bar een eigen sterke visuele identiteit
  // (Worship Air, zie .guitar-theme in styles.css) — de standaard navbalk
  // ("Ons Huisje" + weekdag) hoort daar niet bij, dus dezelfde behandeling:
  // volle balk uit, alleen een kleine zwevende terug-link.
  const isGitaar = pathname.startsWith("/gitaar");
  // Game Night heeft z'n eigen "The Game Room"-identiteit (.gamenight-theme,
  // zie styles.css) — zelfde behandeling als R6/Cocktail Bar/Gitaar: volle
  // navbalk uit, alleen een kleine zwevende terug-link.
  const isGameNight = pathname.startsWith("/game-night");
  // Alleen de home zelf wordt een niet-scrollbare "tabletop"-scène op
  // tablet/desktop (lg:) — subroutes zoals /game-night/spellen blijven
  // gewoon normaal scrollen, zie de opdracht "vaste tafel" sectie 2.
  const isGameNightHome = pathname === "/game-night";
  // Visuele consistentieronde (audit sectie 1: "dubbele layout/css,
  // min-height/viewport-constructies") — root cause gevonden: elke Game
  // Night-route ONDER `/game-night` die zelf al een volledig
  // zelfvoorzienende, `min-height:100dvh` GnV2Scene rendert (Character
  // Creator/Face Setup, en na de join-herstyling ook Join) kreeg TOCH de
  // generieke `max-w-6xl px-4 sm:px-6 pt-16 pb-8`-behandeling hieronder —
  // exact dezelfde dubbele-padding/viewport-mismatch die eerder al voor de
  // Home-route is opgelost (zie het `isGameNightHome`-commentaar bij
  // `<main>`). Resultaat zonder deze fix: de scene is op mobiel NOOIT
  // daadwerkelijk edge-to-edge (16-24px houten achtergrond blijft
  // zichtbaar aan weerszijden) en `100dvh` binnen een al met pt-16/pb-8
  // opgevulde `<main>` overschrijdt de viewport, wat de zorgvuldig
  // ontworpen sticky-preview/sticky-footer-structuur van de Creator kan
  // laten wegzakken onder een onbedoelde EXTRA paginascroll.
  const isGameNightFullBleedRoute =
    isGameNightHome ||
    pathname === "/game-night/me/character" ||
    pathname === "/game-night/me/face" ||
    /^\/game-night\/join\//.test(pathname);
  // Visuele consistentieronde (legacy .gn-*-migratie) — een TWEEDE, bewust
  // ANDERE categorie dan isGameNightFullBleedRoute hierboven. Geschiedenis/
  // Geschiedenis-detail/Finale/Spellen/Speldetail/Spelers/Spelerprofiel/
  // Hall of Fame zijn nu ook allemaal een GnV2Scene (edge-to-edge, geen
  // wood-achtergrond-bleed meer op mobiel), maar zijn qua aard variabel-
  // lange CONTENTlijsten/-details — die MOGEN en MOETEN gewoon de pagina
  // laten scrollen zodra de inhoud niet past (in tegenstelling tot de
  // fixed-app-shell-pagina's hierboven, die bewust NOOIT paginascroll willen
  // omdat hun sticky preview/footer anders zou wegzakken). Daarom hier
  // GEEN `lg:h-dvh lg:overflow-hidden` en GEEN `pt-16` (die compenseerde
  // uitsluitend voor de zwevende "Ons Huisje"-knop van niet-members — deze
  // pagina's zijn sowieso alleen bereikbaar na login en tonen altijd hun
  // eigen in-scene terugknop, dus die compensatie is hier niet nodig) —
  // puur `w-full`, verder identiek aan hoe de Home-route zelf al werkte.
  const isGameNightContentRoute =
    !isGameNightFullBleedRoute &&
    isGameNight &&
    [
      "/game-night/geschiedenis",
      "/game-night/spellen",
      "/game-night/spelers",
      "/game-night/hall-of-fame",
    ].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  const isHome = pathname === "/";
  // Boodschappen rendert zelf een "Ons Huisje"-terugknop op de plek van de
  // paginatitel (zie Boodschappen.tsx) i.p.v. de gedeelde navbalk — dezelfde
  // reden als bij isHome hierboven.
  const isBoodschappen = pathname === "/boodschappen";

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isGameNightFullBleedRoute
          ? "lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:overscroll-none"
          : ""
      }`}
    >
      {((isR6 && !isR6SessionDetail && !isR6Player) || isCocktailBar) && (
        // Op Cocktail Bar-pagina's staat de hele groep (incl. "Ons Huisje")
        // in .cocktail-theme, zodat de knop daar dezelfde look krijgt als
        // Cocktails/Beheer (cb-button-ghost, Playfair Display). Op R6 blijft
        // "Ons Huisje" ongewijzigd in zijn normale, sitewide stijl — dat is
        // hier niet gevraagd.
        <div
          className={`fixed left-3 top-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 overflow-x-auto ${isCocktailBar ? "cocktail-theme" : ""}`}
        >
          <Link
            to="/"
            className={
              isCocktailBar
                ? "cb-button-ghost flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
                : "flex shrink-0 items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm group"
            }
          >
            <Home className={isCocktailBar ? "h-4 w-4" : "h-5 w-5"} />
            <span
              className={
                isCocktailBar
                  ? "text-xs font-semibold"
                  : "tuin-font text-lg font-semibold"
              }
            >
              Ons Huisje
            </span>
          </Link>
          {isCocktailBar && (
            <nav className="flex shrink-0 items-center gap-1.5">
              {cocktailBarNav.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap ${active ? "cb-button" : "cb-button-ghost"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      )}
      {/* Eigen blok i.p.v. meeliften op de R6/Cocktail Bar-groep hierboven —
          die twee delen hun cb-/r6-specifieke binnenstyling, Gitaar heeft
          een volledig andere (Worship Air, wa-*-klassen). */}
      {isGitaar && (
        <div className="guitar-theme fixed left-3 top-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 overflow-x-auto">
          <Link
            to="/"
            className="wa-button-ghost flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs shadow-sm"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="font-medium">Ons Huisje</span>
          </Link>
        </div>
      )}
      {isGameNight && !isGameNightMember && (
        <div className="gamenight-theme fixed left-3 top-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 overflow-x-auto">
          <Link
            to="/"
            className="gn-button-ghost flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="font-medium">Ons Huisje</span>
          </Link>
        </div>
      )}
      {/* De homepage bouwt haar eigen transparante, fullscreen header (zie
          Home.tsx) i.p.v. deze algemene navbalk — vandaar ook hier buiten
          gesloten met !isHome, net als bij R6/Cocktail Bar hierboven.
          Boodschappen sluit om dezelfde reden uit met !isBoodschappen.
          Gitaar/Game Night sluiten uit met !isGitaar/!isGameNight — zie de
          eigen zwevende blokjes hierboven. */}
      {!isR6 &&
        !isCocktailBar &&
        !isHome &&
        !isBoodschappen &&
        !isGitaar &&
        !isGameNight && (
          <header className="border-b border-border/60 backdrop-blur-sm bg-background/70 sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 md:grid md:grid-cols-[auto_1fr_auto]">
              <Link to="/" className="flex items-center gap-2 group">
                {isTuinieren ? (
                  <Sprout className="h-5 w-5" strokeWidth={1.6} />
                ) : (
                  <Home className="h-5 w-5" />
                )}
                <span
                  className={
                    isTuinieren
                      ? "sv-heading text-2xl"
                      : "tuin-font text-xl font-semibold"
                  }
                >
                  {isTuinieren ? "Tuinieren" : "Ons Huisje"}
                </span>
              </Link>
              {isTuinieren ? (
                <span />
              ) : (
                <span className="hidden md:block text-center text-sm text-muted-foreground tuin-font font-normal capitalize">
                  {new Date().toLocaleDateString("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              )}
              <div className="justify-self-end">
                {isTuinieren ? (
                  <WeatherForecast />
                ) : (
                  <nav className="flex items-center gap-1 sm:gap-2">
                    {nav.map((item) => {
                      const active = pathname === item.to;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
                            pathname === item.to ||
                            pathname.startsWith(item.to + "/")
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="hidden sm:inline text-base">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </nav>
                )}
              </div>
            </div>
          </header>
        )}
      <main
        className={
          isHome
            ? "flex-1 w-full"
            : isGameNightFullBleedRoute
              ? // Game Night V2.7B root-cause-fix (verbreed in de visuele
                // consistentieronde, zie isGameNightFullBleedRoute
                // hierboven): de gedeelde `max-w-6xl mx-auto px-4 sm:px-6`
                // hieronder liet op een 1280px-tablet aan weerszijden van
                // een volledig-breedte .gnv2-scene een leeg gat over — daar
                // scheen de houten body-achtergrond
                // (body:has(.gamenight-theme)) doorheen, ook al renderde de
                // V2-scene zelf al 100% "houtloos". Elke route die zelf al
                // zo'n volledig zelfvoorzienende, volledig-breedte
                // achtergrond rendert (zie styles.css) mag hier dus geen
                // eigen max-width/centrering/padding meer opgelegd krijgen,
                // op geen enkel breakpoint (niet alleen lg:).
                "flex-1 w-full pt-16 pb-8 sm:pb-12 lg:pt-0 lg:pb-0 lg:min-h-0 lg:overflow-hidden"
              : isGameNightContentRoute
                ? "flex-1 w-full"
                : `flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 ${
                    isR6SessionDetail
                      ? "r6-theme py-8 sm:py-12"
                      : isR6
                        ? "r6-theme pt-16 pb-8 sm:pb-12"
                        : isCocktailBar
                          ? "cocktail-theme pt-16 pb-8 sm:pb-12"
                          : isGitaar || isGameNight
                            ? "pt-16 pb-8 sm:pb-12"
                            : "py-8 sm:py-12"
                  }`
        }
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
