import { Crown } from "lucide-react";
import type { CSSProperties } from "react";
import type { MockChampion } from "@/features/game-night/lib/mockData";

// Kampioenskaart (section 9) — licht gekanteld fysiek object met een eigen
// slagschaduw op het hout (.gn-plaque-tilt), geen gewone dashboardcard.
// Data is nu altijd MOCK_ (zie mockData.ts); de prop-vorm is al klaar voor
// echte data later.
export function ChampionPlaque({ champion }: { champion: MockChampion }) {
  return (
    <div
      className="gn-plaque gn-plaque-tilt w-full px-5 py-5 sm:px-6 sm:py-6"
      style={{ "--gn-tilt": "-5.5deg" } as CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        <Crown className="h-3.5 w-3.5" style={{ color: "var(--gn-brass)" }} />
        <p className="gn-eyebrow">Huidige kampioen</p>
      </div>
      <p
        className="gn-display mt-2 text-3xl font-semibold sm:text-4xl"
        style={{ color: "var(--gn-brass)" }}
      >
        {champion.name}
      </p>
      <p className="gn-muted mt-2 text-sm">
        {champion.streak} overwinningen op rij
      </p>
      <p className="gn-faint mt-2.5 text-xs italic">"{champion.remark}"</p>
    </div>
  );
}
