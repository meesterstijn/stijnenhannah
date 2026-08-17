import { Link } from "react-router-dom";
import {
  Crown,
  Disc3,
  Layers,
  Skull,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MockHallOfFameEntry } from "@/features/game-night/lib/mockData";

// Onderpaneel "Hall of Fame" (section 11/13) — grappige titels mogen, de
// vormgeving blijft dezelfde rustige messing/walnoot-taal. Icoon per titel
// is een kleine, herkenbare knipoog (kroon/plaat/schedel/...), geen
// willekeurige iconenmix — puur mock-demodata dus hardcoded hier i.p.v. in
// mockData.ts (dat blijft platte tekstdata).
const TITLE_ICONS: Record<string, LucideIcon> = {
  "Overall kampioen": Crown,
  "Kolonist der Kolonisten": Users,
  "Hitster DJ": Disc3,
  Skullcrusher: Skull,
  "De Grote Dalmuti": Layers,
};

export function HallOfFamePreview({
  entries,
}: {
  entries: MockHallOfFameEntry[];
}) {
  return (
    <div className="gn-panel-info flex h-full flex-col px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="gn-eyebrow">Hall of Fame</p>
        <Link
          to="/game-night/hall-of-fame"
          className="gn-faint text-[11px] hover:text-[var(--gn-brass)]"
        >
          Bekijk alles
        </Link>
      </div>
      <div className="grid flex-1 grid-cols-5 gap-2">
        {entries.slice(0, 5).map((entry) => {
          const Icon = TITLE_ICONS[entry.title] ?? Crown;
          return (
            <div
              key={entry.title}
              className="flex flex-col items-center gap-1 text-center"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: "var(--gn-brass-soft)",
                  color: "var(--gn-brass)",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.7} />
              </div>
              <p className="gn-faint w-full truncate text-[9px] leading-tight">
                {entry.title}
              </p>
              <p
                className="w-full truncate text-xs font-semibold"
                style={{ color: "var(--gn-brass)" }}
              >
                {entry.holder}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
