import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Gedeelde placeholder voor de vier toekomstige flows (Spelen/Spel kiezen/
// Hall of Fame/Geschiedenis, section 15-17) — elke navigatie-ingang uit
// section 10 heeft nu al een echte, on-brand bestemming i.p.v. een
// dode link, zonder dat we de flow zelf al bouwen (buiten scope van V1,
// zie section 20/22).
export function GameNightComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <Link
        to="/game-night"
        className="gn-muted inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--gn-brass)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar Game Night
      </Link>
      <div className="gn-panel-elevated px-8 py-14">
        <p className="gn-eyebrow mb-3">Binnenkort</p>
        <h1 className="gn-display text-3xl font-semibold sm:text-4xl">
          {title}
        </h1>
        <p className="gn-muted mx-auto mt-4 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
