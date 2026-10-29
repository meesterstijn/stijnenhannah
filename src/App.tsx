import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import "@/features/game-night/guest.css";
import "@/features/theme/theme.css";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RequireAppAccess } from "@/components/RequireAppAccess";
import { SiteLayout } from "@/components/site-layout";
import { handleSpotifyCallback } from "@/lib/spotify";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages — each becomes its own chunk
const Login = lazy(() => import("@/pages/Login"));
const Home = lazy(() => import("@/pages/Home"));
const Boodschappen = lazy(() => import("@/pages/Boodschappen"));
const Recepten = lazy(() => import("@/pages/Recepten"));
const Weekmenu = lazy(() => import("@/pages/Weekmenu"));
const Dagvraag = lazy(() => import("@/pages/Dagvraag"));
const Tuinieren = lazy(() => import("@/pages/Tuinieren"));
const Fotografie = lazy(() => import("@/pages/Fotografie"));
const Notities = lazy(() => import("@/pages/Notities"));
const Todo = lazy(() => import("@/pages/Todo"));
const Weer = lazy(() => import("@/pages/Weer"));
const Verjaardagen = lazy(() => import("@/pages/Verjaardagen"));
const Schoonmaak = lazy(() => import("@/pages/Schoonmaak"));
const Vakantie = lazy(() => import("@/pages/Vakantie"));
const Tips = lazy(() => import("@/pages/Tips"));
const RainbowSixSiege = lazy(() => import("@/pages/RainbowSixSiege"));
const RainbowSixSiegeLan = lazy(() => import("@/pages/RainbowSixSiegeLan"));
const RainbowSixSiegeSession = lazy(
  () => import("@/pages/RainbowSixSiegeSession"),
);
const RainbowSixSiegeScoreboard = lazy(
  () => import("@/pages/RainbowSixSiegeScoreboard"),
);
const RainbowSixSiegeStatistics = lazy(
  () => import("@/pages/RainbowSixSiegeStatistics"),
);
const RainbowSixSiegeBigScreen = lazy(
  () => import("@/pages/RainbowSixSiegeBigScreen"),
);
const RainbowSixSiegeAutoBigScreen = lazy(
  () => import("@/pages/RainbowSixSiegeAutoBigScreen"),
);
const RainbowSixSiegeController = lazy(
  () => import("@/pages/RainbowSixSiegeController"),
);
const CocktailBarLayout = lazy(() => import("@/pages/CocktailBarLayout"));
const CocktailBar = lazy(() => import("@/pages/CocktailBar"));
const CocktailBarAdmin = lazy(() => import("@/pages/CocktailBarAdmin"));
const CocktailBarWizard = lazy(() => import("@/pages/CocktailBarWizard"));
const CocktailBarHighlightsAdmin = lazy(
  () => import("@/pages/CocktailBarHighlightsAdmin"),
);
const CocktailBarDashboard = lazy(() => import("@/pages/CocktailBarDashboard"));
const CocktailBarBereiden = lazy(() => import("@/pages/CocktailBarBereiden"));
const CocktailBarTablet = lazy(() => import("@/pages/CocktailBarTablet"));
const CocktailBarBigScreen = lazy(() => import("@/pages/CocktailBarBigScreen"));
const TuingidsLayout = lazy(() => import("@/pages/tuingids/TuingidsLayout"));
const TuingidsDashboard = lazy(
  () => import("@/pages/tuingids/TuingidsDashboard"),
);
const TuingidsEncyclopedia = lazy(
  () => import("@/pages/tuingids/TuingidsEncyclopedia"),
);
const TuingidsEncyclopediaDetail = lazy(
  () => import("@/pages/tuingids/TuingidsEncyclopediaDetail"),
);
const TuingidsDokter = lazy(() => import("@/pages/tuingids/TuingidsDokter"));
const TuingidsDokterDetail = lazy(
  () => import("@/pages/tuingids/TuingidsDokterDetail"),
);
const TuingidsLogboek = lazy(() => import("@/pages/tuingids/TuingidsLogboek"));
const TuingidsKalender = lazy(
  () => import("@/pages/tuingids/TuingidsKalender"),
);
const TuingidsZoek = lazy(() => import("@/pages/tuingids/TuingidsZoek"));
const TuingidsTeeltplanner = lazy(
  () => import("@/pages/tuingids/TuingidsTeeltplanner"),
);
const GitaarLayout = lazy(() => import("@/pages/gitaar/GitaarLayout"));
const GitaarMijnMuziek = lazy(() => import("@/pages/gitaar/GitaarMijnMuziek"));
const GitaarAlbums = lazy(() => import("@/pages/gitaar/GitaarAlbums"));
const GitaarAlbumDetail = lazy(
  () => import("@/pages/gitaar/GitaarAlbumDetail"),
);
const GitaarFavorieten = lazy(() => import("@/pages/gitaar/GitaarFavorieten"));
const GitaarRecent = lazy(() => import("@/pages/gitaar/GitaarRecent"));
const GitaarSong = lazy(() => import("@/pages/gitaar/GitaarSong"));
const GitaarSongEditor = lazy(() => import("@/pages/gitaar/GitaarSongEditor"));
const GameNightLayout = lazy(
  () => import("@/pages/game-night/GameNightLayout"),
);
const GameNightHome = lazy(() => import("@/pages/game-night/GameNightHome"));
const GameNightGames = lazy(() => import("@/pages/game-night/GameNightGames"));
const GameNightGameDetail = lazy(
  () => import("@/pages/game-night/GameNightGameDetail"),
);
const GameNightPlay = lazy(() => import("@/pages/game-night/GameNightPlay"));
const GameNightPicker = lazy(
  () => import("@/pages/game-night/GameNightPicker"),
);
const GameNightHallOfFame = lazy(
  () => import("@/pages/game-night/GameNightHallOfFame"),
);
const GameNightHistory = lazy(
  () => import("@/pages/game-night/GameNightHistory"),
);
const GameNightHistoryDetail = lazy(
  () => import("@/pages/game-night/GameNightHistoryDetail"),
);
const GameNightFinale = lazy(
  () => import("@/pages/game-night/GameNightFinale"),
);
const GameNightPlayers = lazy(
  () => import("@/pages/game-night/GameNightPlayers"),
);
const GameNightPlayerProfile = lazy(
  () => import("@/pages/game-night/GameNightPlayerProfile"),
);
const GameNightMe = lazy(() => import("@/pages/game-night/GameNightMe"));
const GameNightCharacterCreator = lazy(
  () => import("@/features/game-night/v2/GameNightCharacterCreator"),
);
const GameNightFaceSetup = lazy(
  () => import("@/pages/game-night/GameNightFaceSetup"),
);
const CharacterAssetQaGrid = lazy(
  () => import("@/features/game-night/v2/CharacterAssetQaGrid"),
);
const SchietsportLayout = lazy(
  () => import("@/pages/schietsport/SchietsportLayout"),
);
const SchietsportDashboard = lazy(
  () => import("@/pages/schietsport/SchietsportDashboard"),
);
const SchietsportNieuw = lazy(
  () => import("@/pages/schietsport/SchietsportNieuw"),
);
const SchietsportLogboek = lazy(
  () => import("@/pages/schietsport/SchietsportLogboek"),
);
const SchietsportStatistieken = lazy(
  () => import("@/pages/schietsport/SchietsportStatistieken"),
);
const SchietsportWapens = lazy(
  () => import("@/pages/schietsport/SchietsportWapens"),
);
const SchietsportSessieDetail = lazy(
  () => import("@/pages/schietsport/SchietsportSessieDetail"),
);
const SchietsportSessieBewerken = lazy(
  () => import("@/pages/schietsport/SchietsportSessieBewerken"),
);
const SchietsportWapenDetail = lazy(
  () => import("@/pages/schietsport/SchietsportWapenDetail"),
);
const SchietsportWapensVergelijken = lazy(
  () => import("@/pages/schietsport/SchietsportWapensVergelijken"),
);
const SchietsportCompetitieDetail = lazy(
  () => import("@/pages/schietsport/SchietsportCompetitieDetail"),
);
const SchietsportCompetities = lazy(
  () => import("@/pages/schietsport/SchietsportCompetities"),
);
const SchietsportInstellingen = lazy(
  () => import("@/pages/schietsport/SchietsportInstellingen"),
);
const TrainingLayout = lazy(() => import("@/pages/training/TrainingLayout"));
const TrainingDashboard = lazy(
  () => import("@/pages/training/TrainingDashboard"),
);
const TrainingWorkout = lazy(() => import("@/pages/training/TrainingWorkout"));
const TrainingSchemas = lazy(() => import("@/pages/training/TrainingSchemas"));
const TrainingSchemaEditor = lazy(
  () => import("@/pages/training/TrainingSchemaEditor"),
);
const TrainingBibliotheek = lazy(
  () => import("@/pages/training/TrainingBibliotheek"),
);
const TrainingOefeningen = lazy(
  () => import("@/pages/training/TrainingOefeningen"),
);
const TrainingOefeningDetail = lazy(
  () => import("@/pages/training/TrainingOefeningDetail"),
);
const TrainingOefeningForm = lazy(
  () => import("@/pages/training/TrainingOefeningForm"),
);
const TrainingHistorie = lazy(
  () => import("@/pages/training/TrainingHistorie"),
);
const TrainingSessieDetail = lazy(
  () => import("@/pages/training/TrainingSessieDetail"),
);
const TrainingVoortgang = lazy(
  () => import("@/pages/training/TrainingVoortgang"),
);
const TrainingLichaam = lazy(() => import("@/pages/training/TrainingLichaam"));
const TrainingInstellingen = lazy(
  () => import("@/pages/training/TrainingInstellingen"),
);
const TrainingMeer = lazy(() => import("@/pages/training/TrainingMeer"));
const TrainingSchijven = lazy(() =>
  import("@/pages/training/TrainingMeer").then((m) => ({
    default: m.TrainingSchijven,
  })),
);
const GameNightJoin = lazy(() => import("@/pages/game-night/GameNightJoin"));
const GameNightGuest = lazy(() => import("@/pages/game-night/GameNightGuest"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Pagina niet gevonden
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deze pagina bestaat niet of is verplaatst.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Naar huis
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();

  // These routes validate a separate guest credential, regardless of the
  // current site's auth session or role. Site access stays owner-controlled.
  if (/^\/game-night\/(join|guest)(\/|$)/.test(pathname)) {
    return (
      <div className="gamenight-theme">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/game-night/join/:token" element={<GameNightJoin />} />
            <Route
              path="/game-night/guest/:sessionId"
              element={<GameNightGuest />}
            />
            <Route path="*" element={<GameNightJoin />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <RequireAppAccess>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/boodschappen" element={<Boodschappen />} />
            <Route path="/recepten" element={<Recepten />} />
            <Route path="/weekmenu" element={<Weekmenu />} />
            <Route path="/dagvraag" element={<Dagvraag />} />
            <Route path="/tuinieren" element={<Tuinieren />} />
            <Route path="/fotografie" element={<Fotografie />} />
            <Route path="/notities" element={<Notities />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/weer" element={<Weer />} />
            <Route path="/verjaardagen" element={<Verjaardagen />} />
            <Route path="/schoonmaak" element={<Schoonmaak />} />
            <Route path="/vakantie" element={<Vakantie />} />
            <Route path="/tips" element={<Tips />} />
            <Route path="/rainbow-six-siege" element={<RainbowSixSiege />} />
            <Route
              path="/rainbow-six-siege/lan"
              element={<RainbowSixSiegeLan />}
            />
            <Route
              path="/rainbow-six-siege/lan/:sessionId"
              element={<RainbowSixSiegeSession />}
            />
            <Route
              path="/rainbow-six-siege/scorebord"
              element={<RainbowSixSiegeScoreboard />}
            />
            <Route
              path="/rainbow-six-siege/statistieken"
              element={<RainbowSixSiegeStatistics />}
            />
            <Route path="/cocktail-bar" element={<CocktailBarLayout />}>
              <Route index element={<CocktailBar />} />
              <Route path="beheren" element={<CocktailBarAdmin />} />
              <Route path="beheren/nieuw" element={<CocktailBarWizard />} />
              <Route path="beheren/:id" element={<CocktailBarWizard />} />
              <Route
                path="beheren/highlights"
                element={<CocktailBarHighlightsAdmin />}
              />
              <Route path="bereiden" element={<CocktailBarBereiden />} />
              <Route path="dashboard" element={<CocktailBarDashboard />} />
            </Route>
            <Route path="/tuingids" element={<TuingidsLayout />}>
              <Route index element={<TuingidsDashboard />} />
              <Route path="encyclopedie" element={<TuingidsEncyclopedia />} />
              <Route
                path="encyclopedie/:id"
                element={<TuingidsEncyclopediaDetail />}
              />
              <Route path="dokter" element={<TuingidsDokter />} />
              <Route path="dokter/:id" element={<TuingidsDokterDetail />} />
              <Route path="logboek" element={<TuingidsLogboek />} />
              <Route path="kalender" element={<TuingidsKalender />} />
              <Route path="zoek" element={<TuingidsZoek />} />
              <Route path="teeltplanner" element={<TuingidsTeeltplanner />} />
              <Route
                path="teeltplanner/:planId"
                element={<TuingidsTeeltplanner />}
              />
            </Route>
            <Route path="/gitaar" element={<GitaarLayout />}>
              <Route index element={<GitaarMijnMuziek />} />
              <Route path="albums" element={<GitaarAlbums />} />
              <Route path="albums/:id" element={<GitaarAlbumDetail />} />
              <Route path="favorieten" element={<GitaarFavorieten />} />
              <Route path="recent" element={<GitaarRecent />} />
              <Route path="nummers/nieuw" element={<GitaarSongEditor />} />
              <Route path="nummers/:id" element={<GitaarSong />} />
              <Route
                path="nummers/:id/bewerken"
                element={<GitaarSongEditor />}
              />
            </Route>
            <Route path="/schietsport" element={<SchietsportLayout />}>
              <Route index element={<SchietsportDashboard />} />
              <Route path="nieuw" element={<SchietsportNieuw />} />
              <Route path="logboek" element={<SchietsportLogboek />} />
              <Route
                path="logboek/:id"
                element={<SchietsportSessieDetail />}
              />
              <Route
                path="logboek/:id/bewerken"
                element={<SchietsportSessieBewerken />}
              />
              <Route
                path="statistieken"
                element={<SchietsportStatistieken />}
              />
              <Route path="wapens" element={<SchietsportWapens />} />
              <Route
                path="wapens/vergelijken"
                element={<SchietsportWapensVergelijken />}
              />
              <Route
                path="wapens/:id"
                element={<SchietsportWapenDetail />}
              />
              <Route path="competities" element={<SchietsportCompetities />} />
              <Route
                path="competities/:id"
                element={<SchietsportCompetitieDetail />}
              />
              <Route
                path="instellingen"
                element={<SchietsportInstellingen />}
              />
            </Route>
            <Route path="/training" element={<TrainingLayout />}>
              <Route index element={<TrainingDashboard />} />
              <Route path="workout" element={<TrainingWorkout />} />
              <Route path="schemas" element={<TrainingSchemas />} />
              <Route path="schemas/:id" element={<TrainingSchemaEditor />} />
              <Route path="bibliotheek" element={<TrainingBibliotheek />} />
              <Route path="oefeningen" element={<TrainingOefeningen />} />
              <Route
                path="oefeningen/nieuw"
                element={<TrainingOefeningForm />}
              />
              <Route
                path="oefeningen/:id"
                element={<TrainingOefeningDetail />}
              />
              <Route
                path="oefeningen/:id/bewerken"
                element={<TrainingOefeningForm />}
              />
              <Route path="historie" element={<TrainingHistorie />} />
              <Route path="historie/:id" element={<TrainingSessieDetail />} />
              <Route path="voortgang" element={<TrainingVoortgang />} />
              <Route path="lichaam" element={<TrainingLichaam />} />
              <Route path="schijven" element={<TrainingSchijven />} />
              <Route path="instellingen" element={<TrainingInstellingen />} />
              <Route path="meer" element={<TrainingMeer />} />
            </Route>
            <Route path="/game-night" element={<GameNightLayout />}>
              <Route index element={<GameNightHome />} />
              <Route path="me" element={<GameNightMe />} />
              <Route
                path="me/character"
                element={<GameNightCharacterCreator />}
              />
              <Route path="me/face" element={<GameNightFaceSetup />} />
              {/* Sectie 17 (V2.9D) — dev-only asset-QA, bewust NERGENS in
                  de navigatie gelinkt, alleen bereikbaar via de directe
                  URL en owner-gated (zie het component zelf). */}
              <Route
                path="dev/character-qa"
                element={<CharacterAssetQaGrid />}
              />
              <Route path="spellen" element={<GameNightGames />} />
              <Route
                path="spellen/:gameSlug"
                element={<GameNightGameDetail />}
              />
              <Route path="spelen" element={<GameNightPlay />} />
              <Route path="spel-kiezen" element={<GameNightPicker />} />
              <Route path="hall-of-fame" element={<GameNightHallOfFame />} />
              <Route path="geschiedenis" element={<GameNightHistory />} />
              <Route
                path="geschiedenis/:sessionId"
                element={<GameNightHistoryDetail />}
              />
              <Route
                path="geschiedenis/:sessionId/finale"
                element={<GameNightFinale />}
              />
              <Route path="spelers" element={<GameNightPlayers />} />
              <Route
                path="spelers/:playerId"
                element={<GameNightPlayerProfile />}
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
          {/* Big Screen Mode heeft bewust GEEN SiteLayout: geen navbar, geen
              "Ons Huisje", geen paginabreedte-beperking — een tv/tweede monitor
              mag alleen het live scorebord zelf tonen. */}
          <Route
            path="/rainbow-six-siege/lan/:sessionId/big-screen"
            element={<RainbowSixSiegeBigScreen />}
          />
          {/* Permanente Big Screen-route: geen sessionId in de URL, bepaalt
              zelf altijd de huidige actieve LAN (zie RainbowSixSiegeAutoBigScreen
              / useR6ActiveSessionWatch) — bedoeld om één keer op een tv/tweede
              monitor te openen en nooit meer handmatig te hoeven wisselen. */}
          <Route
            path="/rainbow-six-siege/big-screen"
            element={<RainbowSixSiegeAutoBigScreen />}
          />
          {/* Tablet LAN Controller Mode — zelfde reden om buiten SiteLayout te
              staan als Big Screen: geen navbar/"Ons Huisje", alleen de
              controller zelf, fullscreen-geschikt. */}
          <Route
            path="/rainbow-six-siege/lan/:sessionId/controller"
            element={<RainbowSixSiegeController />}
          />
          {/* Tabletmodus voor de gedeelde cocktail_guest-rol — geen SiteLayout
              (geen navbar/"Ons Huisje"/beheer), exact het patroon van de R6
              Big Screen/Controller-routes hierboven. RequireAppAccess stuurt
              cocktail_guest hier altijd naar terug, dus dit pad moet exact
              overeenkomen met COCKTAIL_GUEST_PATH_PREFIX daar. */}
          <Route path="/cocktail-bar/tablet" element={<CocktailBarTablet />} />
          {/* Big Screen-route voor de Raspberry Pi — logt in als owner, dus
              geen COCKTAIL_GUEST_PATH_PREFIX-achtige gating nodig, alleen
              buiten SiteLayout net als de tabletroute hierboven. */}
          <Route
            path="/cocktail-bar/big-screen"
            element={<CocktailBarBigScreen />}
          />
        </Routes>
      </Suspense>
    </RequireAppAccess>
  );
}

function SpotifyCallbackHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state === "spotify_auth") {
      handleSpotifyCallback(code).then((success) => {
        if (success) {
          window.location.replace(window.location.pathname);
        } else {
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SpotifyCallbackHandler />
        <HashRouter>
          <ThemeProvider>
            <ScrollToTop />
            <AppRoutes />
          </ThemeProvider>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
