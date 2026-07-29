import { useParams } from "react-router-dom";
import { RainbowSixSiegeBigScreenContent } from "@/features/rainbow-six-siege/components/RainbowSixSiegeBigScreenContent";

/**
 * Big Screen Mode — bedoeld voor een tv/tweede monitor tijdens een LAN.
 * Bewust GEEN SiteLayout (zie App.tsx: dit is een top-level route buiten
 * de normale <Route element={<SiteLayout />}> boom): geen navbar, geen
 * "Ons Huisje", geen paginabreedte-beperking. Alleen het live scorebord.
 *
 * Sessiespecifieke route (`/rainbow-six-siege/lan/:sessionId/big-screen`)
 * — voor directe links naar één specifieke LAN, ongewijzigd t.o.v. voorheen.
 * Zie RainbowSixSiegeAutoBigScreen.tsx voor de permanente variant
 * (`/rainbow-six-siege/big-screen`) die zelf de actieve LAN bepaalt — beide
 * routes renderen hetzelfde RainbowSixSiegeBigScreenContent-component, dit
 * bestand geeft er alleen de sessionId uit de URL aan door.
 */
export default function RainbowSixSiegeBigScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!sessionId) {
    return (
      <div className="r6-theme flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="font-serif text-xl">Laden…</p>
      </div>
    );
  }

  return <RainbowSixSiegeBigScreenContent sessionId={sessionId} />;
}
