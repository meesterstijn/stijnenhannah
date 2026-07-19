import { useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteLayout } from "@/components/site-layout";
import { handleSpotifyCallback } from "@/lib/spotify";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Boodschappen from "@/pages/Boodschappen";
import Recepten from "@/pages/Recepten";
import Weekmenu from "@/pages/Weekmenu";
import Dagvraag from "@/pages/Dagvraag";
import Tuinieren from "@/pages/Tuinieren";
import Fotografie from "@/pages/Fotografie";
import Notities from "@/pages/Notities";
import Todo from "@/pages/Todo";
import Weer from "@/pages/Weer";
import Verjaardagen from "@/pages/Verjaardagen";
import Schoonmaak from "@/pages/Schoonmaak";
import Vakantie from "@/pages/Vakantie";
import Tips from "@/pages/Tips";
import TuingidsLayout from "@/pages/tuingids/TuingidsLayout";
import TuingidsDashboard from "@/pages/tuingids/TuingidsDashboard";
import TuingidsEncyclopedia from "@/pages/tuingids/TuingidsEncyclopedia";
import TuingidsEncyclopediaDetail from "@/pages/tuingids/TuingidsEncyclopediaDetail";
import TuingidsDokter from "@/pages/tuingids/TuingidsDokter";
import TuingidsDokterDetail from "@/pages/tuingids/TuingidsDokterDetail";
import TuingidsLogboek from "@/pages/tuingids/TuingidsLogboek";
import TuingidsMijnTuin from "@/pages/tuingids/TuingidsMijnTuin";
import TuingidsKalender from "@/pages/tuingids/TuingidsKalender";
import TuingidsStatistieken from "@/pages/tuingids/TuingidsStatistieken";
import TuingidsZoek from "@/pages/tuingids/TuingidsZoek";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
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
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
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
