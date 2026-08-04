import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, NotebookPen, ListTodo, LogOut, Sprout } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { WeatherForecast } from "@/components/weather-forecast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const nav = [
  { to: "/notities", label: "Notities", icon: NotebookPen },
  { to: "/todo", label: "To-do", icon: ListTodo },
] as const;

// Vroeger als eigen <nav> binnen CocktailBarLayout gerenderd (in de
// paginainhoud); staat nu hier zodat de knoppen naast de zwevende "Ons
// Huisje"-link kunnen staan, in dezelfde vaste hoek.
const cocktailBarNav = [
  { to: "/cocktail-bar", label: "Cocktails" },
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
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      {((isR6 && !isR6SessionDetail && !isR6Player) || isCocktailBar) && (
        // Op Cocktail Bar-pagina's staat de hele groep (incl. "Ons Huisje")
        // in .cocktail-theme, zodat de knop daar dezelfde look krijgt als
        // Cocktails/Beheer (cb-button-ghost, Playfair Display). Op R6 blijft
        // "Ons Huisje" ongewijzigd in zijn normale, sitewide stijl — dat is
        // hier niet gevraagd.
        <div
          className={`fixed left-3 top-3 z-50 flex items-center gap-2 ${isCocktailBar ? "cocktail-theme" : ""}`}
        >
          <Link
            to="/"
            className={
              isCocktailBar
                ? "cb-button-ghost flex items-center gap-1.5 rounded-full px-3 py-1"
                : "flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm group"
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
            <nav className="flex items-center gap-1.5">
              {cocktailBarNav.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded-full px-3 py-1 text-xs whitespace-nowrap ${active ? "cb-button" : "cb-button-ghost"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      )}
      {!isR6 && !isCocktailBar && (
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
                  {isHome && (
                    <button
                      type="button"
                      onClick={() => supabase.auth.signOut()}
                      className="flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="hidden sm:inline text-base">
                        Uitloggen
                      </span>
                    </button>
                  )}
                </nav>
              )}
            </div>
          </div>
        </header>
      )}
      <main
        className={`flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 ${
          isR6SessionDetail
            ? "r6-theme py-8 sm:py-12"
            : isR6
              ? "r6-theme pt-16 pb-8 sm:pb-12"
              : isCocktailBar
                ? "cocktail-theme pt-16 pb-8 sm:pb-12"
                : "py-8 sm:py-12"
        }`}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
