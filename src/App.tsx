import { lazy, Suspense, useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
const RainbowSixSiegeSession = lazy(() => import("@/pages/RainbowSixSiegeSession"));
const RainbowSixSiegeScoreboard = lazy(() => import("@/pages/RainbowSixSiegeScoreboard"));
const RainbowSixSiegeStatistics = lazy(() => import("@/pages/RainbowSixSiegeStatistics"));
const RainbowSixSiegeBigScreen = lazy(() => import("@/pages/RainbowSixSiegeBigScreen"));
const TuingidsLayout = lazy(() => import("@/pages/tuingids/TuingidsLayout"));
const TuingidsDashboard = lazy(() => import("@/pages/tuingids/TuingidsDashboard"));
const TuingidsEncyclopedia = lazy(() => import("@/pages/tuingids/TuingidsEncyclopedia"));
const TuingidsEncyclopediaDetail = lazy(() => import("@/pages/tuingids/TuingidsEncyclopediaDetail"));
const TuingidsDokter = lazy(() => import("@/pages/tuingids/TuingidsDokter"));
const TuingidsDokterDetail = lazy(() => import("@/pages/tuingids/TuingidsDokterDetail"));
const TuingidsLogboek = lazy(() => import("@/pages/tuingids/TuingidsLogboek"));
const TuingidsMijnTuin = lazy(() => import("@/pages/tuingids/TuingidsMijnTuin"));
const TuingidsKalender = lazy(() => import("@/pages/tuingids/TuingidsKalender"));
const TuingidsStatistieken = lazy(() => import("@/pages/tuingids/TuingidsStatistieken"));
const TuingidsZoek = lazy(() => import("@/pages/tuingids/TuingidsZoek"));
const TuingidsTeeltplanner = lazy(() => import("@/pages/tuingids/TuingidsTeeltplanner"));

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
          <Route path="/rainbow-six-siege/lan" element={<RainbowSixSiegeLan />} />
          <Route path="/rainbow-six-siege/lan/:sessionId" element={<RainbowSixSiegeSession />} />
          <Route path="/rainbow-six-siege/scorebord" element={<RainbowSixSiegeScoreboard />} />
          <Route path="/rainbow-six-siege/statistieken" element={<RainbowSixSiegeStatistics />} />
          <Route path="/tuingids" element={<TuingidsLayout />}>
            <Route index element={<TuingidsDashboard />} />
            <Route path="encyclopedie" element={<TuingidsEncyclopedia />} />
            <Route path="encyclopedie/:id" element={<TuingidsEncyclopediaDetail />} />
            <Route path="dokter" element={<TuingidsDokter />} />
            <Route path="dokter/:id" element={<TuingidsDokterDetail />} />
            <Route path="logboek" element={<TuingidsLogboek />} />
            <Route path="mijn-tuin" element={<TuingidsMijnTuin />} />
            <Route path="kalender" element={<TuingidsKalender />} />
            <Route path="statistieken" element={<TuingidsStatistieken />} />
            <Route path="zoek" element={<TuingidsZoek />} />
            <Route path="teeltplanner" element={<TuingidsTeeltplanner />} />
            <Route path="teeltplanner/:planId" element={<TuingidsTeeltplanner />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Big Screen Mode heeft bewust GEEN SiteLayout: geen navbar, geen
            "Ons Huisje", geen paginabreedte-beperking — een tv/tweede monitor
            mag alleen het live scorebord zelf tonen. */}
        <Route path="/rainbow-six-siege/lan/:sessionId/big-screen" element={<RainbowSixSiegeBigScreen />} />
      </Routes>
    </Suspense>
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
          <ScrollToTop />
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
