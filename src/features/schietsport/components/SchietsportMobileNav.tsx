import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Menu, Plus, Target } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SCHIETSPORT_NAV,
  SCHIETSPORT_NEW_PATH,
  isNavItemActive,
} from "@/features/schietsport/nav";

const primary = SCHIETSPORT_NAV.filter((item) => item.mobilePrimary);
const secondary = SCHIETSPORT_NAV.filter((item) => !item.mobilePrimary);

const roundButton =
  "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition-colors hover:text-foreground";

// Bovenbalk met terug-naar-huis + "Meer"-menu (Competities, Instellingen).
export function SchietsportMobileTopBar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <Link to="/" aria-label="Naar Ons Huisje" className={roundButton}>
        <Home className="h-[18px] w-[18px]" />
      </Link>
      <div className="flex items-center gap-2">
        <Target
          className="h-[18px] w-[18px] text-[var(--ss-copper)]"
          strokeWidth={1.7}
        />
        <span className="text-base font-semibold tracking-tight">
          Schietsport
        </span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Meer"
          className={roundButton}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {/* Portal buiten de layout: thema-klasse hier opnieuw zetten. */}
        <SheetContent
          side="bottom"
          className="schietsport-theme rounded-t-3xl border-white/10 pb-10"
        >
          <SheetHeader>
            <SheetTitle className="text-left">Meer</SheetTitle>
          </SheetHeader>
          <nav className="mt-2 flex flex-col gap-1">
            {secondary.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  aria-current={
                    isNavItemActive(item, pathname) ? "page" : undefined
                  }
                  className="ss-nav-link py-3 text-base"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Vaste onderbalk: vier hoofdonderdelen met de plusknop in het midden.
export function SchietsportBottomNav() {
  const { pathname } = useLocation();
  const left = primary.slice(0, 2);
  const right = primary.slice(2);

  const item = (navItem: (typeof primary)[number]) => {
    const Icon = navItem.icon;
    const active = isNavItemActive(navItem, pathname);
    return (
      <Link
        key={navItem.to}
        to={navItem.to}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] transition-colors ${
          active ? "text-[var(--ss-copper)]" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.8} />
        {navItem.label}
      </Link>
    );
  };

  return (
    <nav className="ss-bottom-nav fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {left.map(item)}
        <div className="flex flex-1 justify-center">
          <Link
            to={SCHIETSPORT_NEW_PATH}
            aria-label="Nieuwe schietbeurt"
            className="ss-fab -mt-6 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={2.2} />
          </Link>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
