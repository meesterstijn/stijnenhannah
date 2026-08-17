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
  // tonen aan die rol, zie ook de gebruikersrollen-opdracht sectie 7.
  const { isR6Player } = useAuth();
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
  const isHome = pathname === "/";
  // Boodschappen rendert zelf een "Ons Huisje"-terugknop op de plek van de
  // paginatitel (zie Boodschappen.tsx) i.p.v. de gedeelde navbalk — dezelfde
  // reden als bij isHome hierboven.
  const isBoodschappen = pathname === "/boodschappen";

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isGameNightHome
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
      {isGameNight && (
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
            : `flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 ${
                isR6SessionDetail
                  ? "r6-theme py-8 sm:py-12"
                  : isR6
                    ? "r6-theme pt-16 pb-8 sm:pb-12"
                    : isCocktailBar
                      ? "cocktail-theme pt-16 pb-8 sm:pb-12"
                      : isGameNightHome
                        ? // Op lg: neemt .gn-tabletop-fit zelf de volledige
                          // 100dvh + eigen padding voor z'n rekening (zie
                          // styles.css) — main's eigen pt/pb zouden daar
                          // bovenop een niet-zichtbare scrollbar opleveren.
                          // Onder lg: (mobiel) blijft dit gewoon een normale
                          // scrollbare pagina met dezelfde spacing als de
                          // rest van Game Night.
                          "pt-16 pb-8 sm:pb-12 lg:pt-0 lg:pb-0 lg:min-h-0 lg:overflow-hidden"
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
