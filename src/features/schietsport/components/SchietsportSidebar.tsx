import { Link, useLocation } from "react-router-dom";
import { Home, Plus, Target } from "lucide-react";
import {
  SCHIETSPORT_NAV,
  SCHIETSPORT_NEW_PATH,
  isNavItemActive,
} from "@/features/schietsport/nav";

// Desktop-navigatie: vaste linkerkolom, zelfde opzet als GitaarLayout's
// sidebar. De generieke SiteLayout-header staat voor /schietsport uit, dus
// de terug-naar-huis-link zit hier.
export function SchietsportSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sticky top-8 flex flex-col gap-6">
      <div className="space-y-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="h-3.5 w-3.5" />
          Ons Huisje
        </Link>
        <div className="flex items-center gap-2.5">
          <Target
            className="h-5 w-5 text-[var(--ss-copper)]"
            strokeWidth={1.7}
          />
          <p className="text-lg font-semibold tracking-tight">Schietsport</p>
        </div>
      </div>

      <Link
        to={SCHIETSPORT_NEW_PATH}
        className="ss-fab inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} />
        Nieuwe schietbeurt
      </Link>

      <nav className="flex flex-col gap-1">
        {SCHIETSPORT_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isNavItemActive(item, pathname) ? "page" : undefined}
              className="ss-nav-link"
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
