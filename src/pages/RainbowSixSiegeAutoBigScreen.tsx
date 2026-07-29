import { RainbowSixSiegeBigScreenContent } from "@/features/rainbow-six-siege/components/RainbowSixSiegeBigScreenContent";
import { useR6ActiveSessionWatch } from "@/features/rainbow-six-siege/hooks/useR6ActiveSessionWatch";

/**
 * Permanente Big Screen-route (`/rainbow-six-siege/big-screen`) — toont
 * altijd automatisch de huidige actieve (status='live') LAN, ook nadat de
 * huidige LAN wordt afgesloten en later een andere wordt gestart. Bedoeld
 * om één keer op de tv/tweede monitor te openen en daarna nooit meer
 * handmatig te hoeven aanraken.
 *
 * Bewust GEEN SiteLayout — zelfde reden als de sessiespecifieke
 * RainbowSixSiegeBigScreen.tsx (zie App.tsx): geen navbar/"Ons Huisje".
 *
 * Vindt de actieve sessionId via useR6ActiveSessionWatch (Realtime op
 * r6_sessions) en rendert daarna hetzelfde RainbowSixSiegeBigScreenContent
 * als de sessiespecifieke route — geen tweede Big Screen-implementatie.
 *
 * `key={sessionId}` op het content-component is de kern van het
 * automatisch wisselen: zodra de actieve sessionId verandert (LAN
 * beëindigd -> nieuwe LAN gestart), dwingt React een volledige ont-/
 * hermontage af. Dat ruimt de Realtime-subscriptions van de vorige sessie
 * gegarandeerd op (React's eigen effect-cleanup) én voorkomt dat er ooit
 * data van de vorige LAN te zien is onder de naam van de nieuwe — het
 * component start altijd met verse, lege state.
 */
export default function RainbowSixSiegeAutoBigScreen() {
  const { sessionId, phase, connectionStatus } = useR6ActiveSessionWatch();

  if (phase === "searching") {
    return (
      <div className="r6-theme flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="font-serif text-xl">Actieve LAN zoeken…</p>
      </div>
    );
  }

  if (phase === "active" && sessionId) {
    return <RainbowSixSiegeBigScreenContent key={sessionId} sessionId={sessionId} loadingLabel="Nieuwe LAN laden…" />;
  }

  return (
    <div className="r6-theme flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <p className="font-serif text-3xl font-bold uppercase tracking-widest text-amber-400 sm:text-5xl">Wachten op live LAN</p>
      <p className="max-w-md text-sm text-zinc-400 sm:text-base">
        Big Screen schakelt automatisch in zodra een LAN wordt gestart.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-600">
        <span
          className={`h-1.5 w-1.5 rounded-full ${connectionStatus === "connected" ? "bg-emerald-500" : connectionStatus === "connecting" ? "bg-amber-500" : "bg-rose-500"}`}
        />
        {connectionStatus === "connected" && "Realtime verbonden"}
        {connectionStatus === "connecting" && "Verbinden…"}
        {connectionStatus === "disconnected" && "Verbinding verbroken — opnieuw verbinden…"}
      </p>
    </div>
  );
}
