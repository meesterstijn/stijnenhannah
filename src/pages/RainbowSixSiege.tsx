import { Tv } from "lucide-react";
import { R6Header } from "@/features/rainbow-six-siege/components/R6Header";
import { R6FeatureCard } from "@/features/rainbow-six-siege/components/R6FeatureCard";
import { R6PointsPreview } from "@/features/rainbow-six-siege/components/R6PointsPreview";
import { R6ChallengePreview } from "@/features/rainbow-six-siege/components/R6ChallengePreview";
import { R6_FEATURES } from "@/features/rainbow-six-siege/data/content";

export default function RainbowSixSiege() {
  return (
    <div className="space-y-4">
      <R6Header
        title="Operation LANstorm"
        subtitle="Rainbow Six Siege LAN Night"
        intro="Maak van jullie Rainbow Six Siege-avond een compleet mini-evenement met challenges, scores, statistieken en chaos-rondes."
      />

      {/* Permanente Big Screen: geen sessionId nodig, schakelt zelf altijd
          naar de huidige actieve LAN — zie RainbowSixSiegeAutoBigScreen. */}
      <button
        type="button"
        onClick={() => window.open("/#/rainbow-six-siege/big-screen", "_blank")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-amber-400 sm:w-auto"
      >
        <Tv className="h-4 w-4" /> Permanent Big Screen
      </button>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {R6_FEATURES.map((feature) => (
          <R6FeatureCard key={feature.id} feature={feature} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <R6PointsPreview />
        <R6ChallengePreview />
      </section>
    </div>
  );
}
