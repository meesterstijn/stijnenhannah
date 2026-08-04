import { Maximize, Minimize } from "lucide-react";
import { useCocktailShowcase } from "@/features/cocktail-bar/hooks/useCocktailShowcase";
import { useCocktailBarActiveOrderWatch } from "@/features/cocktail-bar/hooks/useCocktailBarActiveOrderWatch";
import { useCocktailBarHighlightWatch } from "@/features/cocktail-bar/hooks/useCocktailBarHighlightWatch";
import { useCocktailBarConnectionStatus } from "@/features/cocktail-bar/hooks/useCocktailBarConnectionStatus";
import { useFullscreen } from "@/features/cocktail-bar/hooks/useFullscreen";
import { CocktailBigScreenIdle } from "@/features/cocktail-bar/components/CocktailBigScreenIdle";
import { CocktailBigScreenBrewing } from "@/features/cocktail-bar/components/CocktailBigScreenBrewing";
import { CocktailBigScreenReady } from "@/features/cocktail-bar/components/CocktailBigScreenReady";
import { CocktailBigScreenHighlight } from "@/features/cocktail-bar/components/CocktailBigScreenHighlight";

/**
 * Kiosk-route voor de Raspberry Pi (`/cocktail-bar/big-screen`), buiten
 * SiteLayout — zelfde reden als de R6 Big Screen-routes: geen navbar/"Ons
 * Huisje", fullscreen-geschikt. Logt in als owner (zie plan).
 *
 * Prioriteit uit plan §6: 1) actieve persoonlijke presentatie, 2) bestelling
 * "Bezig", 3) bestelling "Klaar" (binnen ready_display_seconds, niet
 * dismissed), 4) idle. De twee watch-hooks bepalen elk hun eigen prioriteit
 * onafhankelijk, deze pagina combineert ze door highlight altijd voorrang
 * te geven op een actieve bestelling.
 */
export default function CocktailBarBigScreen() {
  const { data: cocktails = [] } = useCocktailShowcase();
  const activeOrder = useCocktailBarActiveOrderWatch();
  const activeHighlight = useCocktailBarHighlightWatch();
  const connectionStatus = useCocktailBarConnectionStatus();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

  function renderContent() {
    if (activeHighlight) {
      return (
        <CocktailBigScreenHighlight
          highlight={activeHighlight.highlight}
          cocktail={activeHighlight.cocktail}
        />
      );
    }

    if (activeOrder.kind !== "none") {
      const cocktail = cocktailsById.get(activeOrder.order.cocktail_id);
      const variant = cocktail?.variants.find(
        (v) => v.id === activeOrder.order.variant_id,
      );
      return activeOrder.kind === "brewing" ? (
        <CocktailBigScreenBrewing
          order={activeOrder.order}
          cocktail={cocktail}
          variant={variant}
        />
      ) : (
        <CocktailBigScreenReady
          order={activeOrder.order}
          cocktail={cocktail}
          variant={variant}
        />
      );
    }

    return <CocktailBigScreenIdle />;
  }

  return (
    <div className="cocktail-theme relative min-h-screen overflow-hidden">
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={
          isFullscreen ? "Volledig scherm verlaten" : "Volledig scherm"
        }
        className="cb-button-ghost fixed right-3 top-3 z-50 rounded-full p-2"
      >
        {isFullscreen ? (
          <Minimize className="h-4 w-4" />
        ) : (
          <Maximize className="h-4 w-4" />
        )}
      </button>
      {renderContent()}
      <p className="fixed bottom-3 right-3 z-20 flex items-center gap-1.5 text-xs uppercase tracking-wide cb-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connectionStatus === "connected"
              ? "bg-emerald-500"
              : connectionStatus === "connecting"
                ? "bg-amber-500"
                : "bg-rose-500"
          }`}
        />
        {connectionStatus === "connected" && "Live"}
        {connectionStatus === "connecting" && "Verbinden…"}
        {connectionStatus === "disconnected" && "Verbinding verbroken"}
      </p>
    </div>
  );
}
