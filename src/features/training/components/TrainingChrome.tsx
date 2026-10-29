import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarRange,
  CloudOff,
  Dumbbell,
  Home,
  LineChart,
  Loader2,
  Menu,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import {
  useSyncStatus,
  useTraining,
} from "@/features/training/hooks/TrainingProvider";
import {
  useConflictCount,
  useOpenSession,
  usePendingCount,
} from "@/features/training/hooks/useTrainingData";
import { formatClock } from "@/features/training/domain/units";

export const NAV = [
  { to: "/training", label: "Vandaag", icon: Dumbbell, exact: true },
  { to: "/training/schemas", label: "Schema's", icon: CalendarRange },
  { to: "/training/oefeningen", label: "Oefeningen", icon: BookOpen },
  { to: "/training/voortgang", label: "Voortgang", icon: LineChart },
  { to: "/training/meer", label: "Meer", icon: Menu },
] as const;

const MORE_PATHS = [
  "/training/meer",
  "/training/historie",
  "/training/lichaam",
  "/training/schijven",
  "/training/instellingen",
  "/training/bibliotheek",
];

function isActive(pathname: string, to: string, exact?: boolean) {
  if (to === "/training/meer")
    return MORE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  if (
    to === "/training/schemas" &&
    pathname.startsWith("/training/bibliotheek")
  )
    return false;
  return exact
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`);
}

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  const conflicts = useConflictCount();
  const { engine } = useTraining();
  let icon = <RefreshCw className="h-4 w-4" />;
  let text = "Gesynchroniseerd";
  if (status.phase === "syncing") {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    text = "Synchroniseren…";
  } else if (conflicts > 0) {
    icon = <TriangleAlert className="h-4 w-4" />;
    text = `${conflicts} conflict${conflicts === 1 ? "" : "en"}`;
  } else if (
    status.lastOutcome === "offline" ||
    status.lastOutcome === "auth"
  ) {
    icon = <CloudOff className="h-4 w-4" />;
    text = pending ? `Offline · ${pending} wacht` : "Offline";
  } else if (status.lastOutcome === "error") {
    icon = <TriangleAlert className="h-4 w-4" />;
    text = "Sync mislukt";
  } else if (pending > 0) {
    text = `${pending} wacht`;
  }
  return (
    <button
      type="button"
      onClick={() =>
        conflicts > 0
          ? (location.hash = "#/training/instellingen")
          : void engine.sync()
      }
      className="tr-chip"
      title={status.lastError ?? "Nu synchroniseren"}
      aria-live="polite"
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}

export function TopBar() {
  const { pathname } = useLocation();
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/"
          className="tr-btn tr-btn-quiet -ml-2 px-2"
          aria-label="Terug naar Ons Huisje"
        >
          <Home className="h-5 w-5" />
          <span className="hidden text-sm sm:inline">Ons Huisje</span>
        </Link>
        <span className="tr-muted hidden sm:inline">/</span>
        <Link to="/training" className="font-bold tracking-tight">
          Training
        </Link>
      </div>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Training">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="tr-nav-link"
            aria-current={
              isActive(pathname, item.to, "exact" in item) ? "page" : undefined
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <SyncBadge />
        <ThemeSwitcher className="tr-icon-btn" />
      </div>
    </div>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="tr-bottom-nav md:hidden" aria-label="Training">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={
              isActive(pathname, item.to, "exact" in item) ? "page" : undefined
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.9} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Op elke trainingspagina: een lopende training blijft één tik weg.
export function OpenSessionBanner() {
  const session = useOpenSession();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!session) return null;
  const elapsed = (now - Date.parse(session.startedAt)) / 1000;
  return (
    <Link
      to="/training/workout"
      className="tr-banner tr-banner-info mb-4 items-center justify-between font-medium"
    >
      <span className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4" />
        {session.status === "paused" ? "Onderbroken" : "Bezig"}: {session.name}
        {session.status === "active" && (
          <span className="tr-num tr-muted">· {formatClock(elapsed)}</span>
        )}
      </span>
      <span className="tr-aqua-text font-semibold">Hervatten →</span>
    </Link>
  );
}

// Licht/donker: eigen keuze, of het sitebrede thema volgen.
export function useTrainingScheme(
  appearance: "auto" | "light" | "dark",
): "light" | "dark" {
  const [siteScheme, setSiteScheme] = useState(() =>
    document.documentElement.getAttribute("data-ht-scheme"),
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() =>
      setSiteScheme(root.getAttribute("data-ht-scheme")),
    );
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-ht-scheme"],
    });
    return () => observer.disconnect();
  }, []);
  if (appearance !== "auto") return appearance;
  return siteScheme === "dark" ? "dark" : "light";
}
