import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// R6-toegang is de basis waarop r6_player begrensd wordt: exact de routes
// die onder /rainbow-six-siege vallen (inclusief de sessiespecifieke- en
// permanente Big Screen-route en de Tablet Controller, die buiten
// <SiteLayout> liggen maar wél onder dit pad-prefix vallen).
const R6_PATH_PREFIX = "/rainbow-six-siege";

function isR6Path(pathname: string): boolean {
  return (
    pathname === R6_PATH_PREFIX || pathname.startsWith(`${R6_PATH_PREFIX}/`)
  );
}

// cocktail_guest is een gedeeld tablet-account dat UITSLUITEND de
// Tabletmodus mag zien — geen enkele andere Cocktail Bar-pagina (beheer/
// dashboard/bereiden) en zeker geen andere feature. Vandaar een eigen, veel
// smaller pad-prefix dan R6_PATH_PREFIX (die daar wél toegang tot heeft:
// het volledige /rainbow-six-siege-pad, incl. big-screen/controller).
const COCKTAIL_GUEST_PATH_PREFIX = "/cocktail-bar/tablet";

function isCocktailGuestPath(pathname: string): boolean {
  return (
    pathname === COCKTAIL_GUEST_PATH_PREFIX ||
    pathname.startsWith(`${COCKTAIL_GUEST_PATH_PREFIX}/`)
  );
}

// Game Night V2.3 (sectie 18 van de opdracht) — een game_night_member komt
// NOOIT op de tablet-hoofdpagina (/game-night zelf, met start/actieve-
// speel-controls die owner-only horen te blijven) of enige owner-
// beheerflow. Alleen deze expliciete, kleine routelijst — bewust een allow-
// list van exacte patronen, geen brede prefix-match zoals bij r6_player/
// cocktail_guest, omdat "/game-night" zelf hier juist NIET mag doorlaten.
const GAME_NIGHT_MEMBER_ALLOWED_EXACT = new Set([
  "/game-night/me",
  "/game-night/spellen",
  "/game-night/hall-of-fame",
  "/game-night/geschiedenis",
]);
const GAME_NIGHT_MEMBER_ALLOWED_PATTERNS = [
  /^\/game-night\/spelers\/[^/]+$/, // individueel spelerprofiel — NIET de kale lijst
  /^\/game-night\/spellen\/[^/]+$/, // speldetail
  /^\/game-night\/geschiedenis\/[^/]+$/, // Game Night-detail — NIET .../finale erachter
];

function isGameNightMemberPath(pathname: string): boolean {
  if (GAME_NIGHT_MEMBER_ALLOWED_EXACT.has(pathname)) return true;
  return GAME_NIGHT_MEMBER_ALLOWED_PATTERNS.some((re) => re.test(pathname));
}

// Game Night V2.4 (sectie 12/31/32) — de QR-join-pagina moet bereikbaar
// zijn voor VRIJWEL elke rol, inclusief 'no_access' (een eerder ontkoppeld
// account mag via een geldig token gereactiveerd worden) en r6_player/
// cocktail_guest (die krijgen op de pagina zelf eerst een expliciete
// waarschuwing vóórdat er iets verandert). De pagina bewaakt haar eigen,
// fijnmazigere logica — deze guard hoeft alleen de deur open te zetten.
const JOIN_PATH_PATTERN = /^\/game-night\/join\/[^/]+$/;

/**
 * Centrale route-/permissiebewaker — wrapt de VOLLEDIGE <Routes>-boom in
 * App.tsx (dus zowel de <SiteLayout>-routes als de drie losstaande R6-routes
 * eronder) met precies één op `useLocation()` gebaseerde controle, i.p.v.
 * per <Route> een losse check. Werkt daardoor uniform voor directe
 * URL-invoer, een browserrefresh (component + AuthContext laden opnieuw,
 * geen client-side state om te "vergeten"), back/forward-navigatie (nieuwe
 * `location` op elke render) en lazy routes (de guard beslist vóórdat een
 * lazy chunk überhaupt geladen wordt).
 *
 * Faalt gesloten: zolang de rol nog laadt, wordt NOOIT de onderliggende
 * (mogelijk owner-only) pagina alvast even zichtbaar — er wordt een neutrale
 * laadstatus getoond totdat `isLoadingRole` klaar is. Ontbreekt het profiel
 * daarna alsnog (zou niet moeten voorkomen, de databasetrigger maakt er
 * altijd één aan — zie de rollenmigraties), dan krijgt de gebruiker expliciet
 * "geen toegang" te zien, nooit impliciet ownerrechten.
 */
export function RequireAppAccess({ children }: { children: ReactNode }) {
  const {
    isLoadingRole,
    appRole,
    isR6Player,
    isCocktailGuest,
    isGameNightMember,
  } = useAuth();
  const location = useLocation();

  if (isLoadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Een volledig ontbrekend profiel (zou niet moeten voorkomen, zie de
  // rollenmigraties) is altijd geblokkeerd, ZELFS op de join-route — dat
  // duidt op een kapotte accountstaat, geen geldige "ingetrokken toegang".
  if (!appRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            Geen toegang
          </h1>
          <p className="text-sm text-muted-foreground">
            Er is geen profiel gevonden bij dit account. Neem contact op met de
            beheerder.
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  if (JOIN_PATH_PATTERN.test(location.pathname)) {
    return <>{children}</>;
  }

  // Game Night V2.3-correctie: 'no_access' (bv. na het ontkoppelen van een
  // Game Night-account, zie game_night_unlink_player_account) krijgt exact
  // dezelfde "geen toegang"-behandeling als een ontbrekend profiel voor
  // elke ANDERE route — fail closed. De join-route hierboven is de enige,
  // bewuste uitzondering (sectie 31: reactivatie via een geldig token).
  if (appRole === "no_access") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            Geen toegang
          </h1>
          <p className="text-sm text-muted-foreground">
            Dit account heeft momenteel geen toegang. Neem contact op met de
            eigenaar.
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  if (isR6Player && !isR6Path(location.pathname)) {
    return <Navigate to="/rainbow-six-siege" replace />;
  }

  if (isCocktailGuest && !isCocktailGuestPath(location.pathname)) {
    return <Navigate to="/cocktail-bar/tablet" replace />;
  }

  // Sectie 10/18: elke niet-toegestane route (incl. "/" en de tablet-
  // hoofdpagina "/game-night" zelf) stuurt een member direct naar zijn
  // eigen profiel — nooit eerst door de rest van de site of de owner-tablet-
  // UI heen.
  if (isGameNightMember && !isGameNightMemberPath(location.pathname)) {
    return <Navigate to="/game-night/me" replace />;
  }

  return <>{children}</>;
}
