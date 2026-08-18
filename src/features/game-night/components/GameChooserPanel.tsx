import { Link } from "react-router-dom";
import { Dices, Sparkles, Swords } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";

// "HOE ZULLEN WE KIEZEN?" (Game Night V4, sectie 23) — vervangt de oude
// losse "Kies een spel"-knop die alleen naar de Spellenkast linkte. Drie
// gelijkwaardige opties, dezelfde fysieke plaquette-taal als de
// startacties. Toont compact wie er al aan tafel zit (sectie 3: nooit
// opnieuw vragen wie er speelt — de aanwezigen komen uit de actieve Game
// Night en worden ongewijzigd doorgegeven aan beide nieuwe flows).
export function GameChooserPanel({
  sessionName,
  attendees,
  onKiesVoorOns,
  onRoulette,
}: {
  sessionName?: string;
  attendees: GameNightPlayer[];
  onKiesVoorOns: () => void;
  onRoulette: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3.5 text-center">
      <div>
        <p className="gn-eyebrow">{sessionName ?? "Spelkeuze"}</p>
        <p className="gn-display text-xl font-semibold tracking-wide sm:text-2xl">
          HOE ZULLEN WE KIEZEN?
        </p>
        {attendees.length > 0 && (
          <p className="gn-muted mt-1.5 text-xs">
            Vanavond met {attendees.length}{" "}
            {attendees.length === 1 ? "speler" : "spelers"} ·{" "}
            {attendees.map((p) => p.name).join(", ")}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-xs flex-1 flex-col justify-center gap-2.5">
        <button
          type="button"
          onClick={onKiesVoorOns}
          className="gn-plaque-action gn-plaque-action-primary flex min-h-[64px] w-full items-center justify-center gap-2 px-6 py-3.5"
        >
          <Sparkles className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
          <span className="flex flex-col items-start">
            <span className="gn-display text-base font-semibold tracking-wide">
              Kies voor ons
            </span>
            <span className="gn-muted text-xs">Slim advies, 3 voorstellen</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onRoulette}
          className="gn-plaque-action flex min-h-[60px] w-full items-center justify-center gap-2 px-6 py-3"
        >
          <Dices className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          <span className="flex flex-col items-start">
            <span className="gn-display text-sm font-semibold tracking-wide">
              Game Roulette
            </span>
            <span className="gn-muted text-xs">Gewoon loten</span>
          </span>
        </button>

        <Link
          to="/game-night/spellen"
          className="gn-plaque-action flex min-h-[56px] w-full items-center justify-center gap-2 px-6 py-3"
        >
          <Swords className="h-4 w-4" style={{ color: "var(--gn-brass)" }} />
          <span className="flex flex-col items-start">
            <span className="gn-display text-sm font-semibold tracking-wide">
              Zelf kiezen
            </span>
            <span className="gn-muted text-xs">Naar de Spellenkast</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
