import { Link } from "react-router-dom";
import { Boxes, History, Trophy, Users, type LucideIcon } from "lucide-react";

// Rechterkolom (section 10): vier compacte fysieke menuplaquettes i.p.v.
// grote dashboardcards. "Spelers" heeft (nog) geen eigen pagina/route, dus
// staat als informatief plaquette i.p.v. een link — de overige drie zijn
// echte navigatie naar bestaande routes.
export function ExploreNav({
  gamesCount,
  playersCount,
}: {
  gamesCount: number;
  playersCount: number;
}) {
  const items: {
    icon: LucideIcon;
    label: string;
    value: string;
    to?: string;
  }[] = [
    { icon: Users, label: "Spelers", value: `${playersCount} actief` },
    {
      icon: Trophy,
      label: "Hall of Fame",
      value: "Titels & records",
      to: "/game-night/hall-of-fame",
    },
    {
      icon: History,
      label: "Geschiedenis",
      value: "Laatste avonden",
      to: "/game-night/geschiedenis",
    },
    {
      icon: Boxes,
      label: "Spellenkast",
      value: `${gamesCount} spellen`,
      to: "/game-night/spellen",
    },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--gn-brass-soft)",
                color: "var(--gn-brass)",
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <p className="gn-eyebrow leading-tight">{item.label}</p>
              <p className="gn-faint truncate text-xs">{item.value}</p>
            </div>
          </>
        );

        if (!item.to) {
          return (
            <div key={item.label} className="gn-plaque-mini px-3.5 py-3">
              {content}
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.to}
            className="gn-plaque-mini px-3.5 py-3"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
