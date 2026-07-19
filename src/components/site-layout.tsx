import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, NotebookPen, ListTodo, Sprout } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { WeatherForecast } from "@/components/weather-forecast";

const nav = [
  { to: "/notities", label: "Notities", icon: NotebookPen },
  { to: "/todo", label: "To-do", icon: ListTodo },
] as const;

export function SiteLayout() {
  const { pathname } = useLocation();
  const isTuinieren = pathname === "/tuinieren";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/70 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            {isTuinieren ? (
              <Sprout className="h-5 w-5" strokeWidth={1.6} />
            ) : (
              <Home className="h-5 w-5" />
            )}
            <span className={isTuinieren ? "sv-heading text-2xl" : "tuin-font text-xl font-semibold"}>
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
                        pathname === item.to || pathname.startsWith(item.to + "/")
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="hidden sm:inline text-base">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
