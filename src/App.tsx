import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site-layout";
import Home from "@/pages/Home";
import Boodschappen from "@/pages/Boodschappen";
import Weekmenu from "@/pages/Weekmenu";
import Recepten from "@/pages/Recepten";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina niet gevonden</h2>
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/boodschappen" element={<Boodschappen />} />
            <Route path="/weekmenu" element={<Weekmenu />} />
            <Route path="/recepten" element={<Recepten />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
