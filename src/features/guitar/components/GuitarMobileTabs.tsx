import { Link, useLocation } from "react-router-dom";
import { Music2, Disc3, Heart, History } from "lucide-react";

const NAV: {
  to: string;
  label: string;
  icon: typeof Music2;
  exact?: boolean;
}[] = [
  { to: "/gitaar", label: "Mijn muziek", icon: Music2, exact: true },
  { to: "/gitaar/albums", label: "Albums", icon: Disc3 },
  { to: "/gitaar/favorieten", label: "Favorieten", icon: Heart },
  { to: "/gitaar/recent", label: "Recent", icon: History },
];

// Mobiele integratie voor de Gitaar-module: een horizontaal scrollbare
// tabbalk i.p.v. een permanente sidebar (section 4 vraagt expliciet om geen
// vaste sidebar op kleine schermen) — zelfde patroon als TuingidsLayout's
// subnav, de bestaande manier waarop dit soort geneste modules op mobiel
// navigeerbaar wordt gemaakt.
export function GuitarMobileTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.to
          : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`wa-chip shrink-0 py-2 ${active ? "active" : ""}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
