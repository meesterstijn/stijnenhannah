import {
  ChartLine,
  Crosshair,
  LayoutDashboard,
  NotebookText,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export const SCHIETSPORT_BASE = "/schietsport";
export const SCHIETSPORT_NEW_PATH = `${SCHIETSPORT_BASE}/nieuw`;

export type SchietsportNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  // Alleen exact actief (het dashboard is de index en zou anders bij elke
  // subroute oplichten).
  exact?: boolean;
  // Staat op mobiel in de onderbalk; de rest zit achter "Meer".
  mobilePrimary?: boolean;
};

export const SCHIETSPORT_NAV: SchietsportNavItem[] = [
  {
    to: SCHIETSPORT_BASE,
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    mobilePrimary: true,
  },
  {
    to: `${SCHIETSPORT_BASE}/logboek`,
    label: "Logboek",
    icon: NotebookText,
    mobilePrimary: true,
  },
  {
    to: `${SCHIETSPORT_BASE}/statistieken`,
    label: "Statistieken",
    icon: ChartLine,
    mobilePrimary: true,
  },
  {
    to: `${SCHIETSPORT_BASE}/wapens`,
    label: "Wapens",
    icon: Crosshair,
    mobilePrimary: true,
  },
  { to: `${SCHIETSPORT_BASE}/competities`, label: "Competities", icon: Trophy },
  {
    to: `${SCHIETSPORT_BASE}/instellingen`,
    label: "Instellingen",
    icon: Settings,
  },
];

export function isNavItemActive(item: SchietsportNavItem, pathname: string) {
  return item.exact
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
