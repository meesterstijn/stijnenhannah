import { Link, Outlet, useLocation } from "react-router-dom";

const subnav = [
  { to: "/tuingids", label: "Dashboard", emoji: "🌿" },
  { to: "/tuingids/dokter", label: "Plantendokter", emoji: "🩺" },
  { to: "/tuingids/encyclopedie", label: "Encyclopedie", emoji: "📖" },
  { to: "/tuingids/kalender", label: "Kalender", emoji: "📅" },
  { to: "/tuingids/logboek", label: "Logboek", emoji: "📷" },
  { to: "/tuingids/zoek", label: "Zoeken", emoji: "🔍" },
  { to: "/tuingids/teeltplanner", label: "Teeltplanner", emoji: "🌱" },
];

export default function TuingidsLayout() {
  const { pathname } = useLocation();

  return (
    <div className="tuinieren-theme space-y-6">
      <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {subnav.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="sv-button flex items-center gap-1.5 px-3 py-2 text-base whitespace-nowrap shrink-0"
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
