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
 * Prioriteit: 1) bestelling "Klaar" (binnen ready_display_seconds, niet
 * dismissed), 2) actieve persoonlijke presentatie, 3) bestelling "Bezig",
 * 4) idle. "Klaar" staat bewust bovenaan — dat is een kort, urgent moment
 * voor een wachtende gast en moet altijd zichtbaar zijn, ook terwijl een
 * presentatie loopt; zodra het klaar-scherm verdwijnt (tijd verstreken of
 * dismissed) valt het vanzelf terug op de presentatie, die intussen actief
 * is blijven staan.
 */
export default function CocktailBarBigScreen() {
  const { data: cocktails = [] } = useCocktailShowcase();
  const activeOrder = useCocktailBarActiveOrderWatch();
  const activeHighlight = useCocktailBarHighlightWatch();
  const connectionStatus = useCocktailBarConnectionStatus();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

  function renderContent() {
    const orderCocktail =
      activeOrder.kind !== "none"
        ? cocktailsById.get(activeOrder.order.cocktail_id)
        : undefined;
    const orderVariant =
      activeOrder.kind !== "none"
        ? orderCocktail?.variants.find(
            (v) => v.id === activeOrder.order.variant_id,
          )
        : undefined;

    if (activeOrder.kind === "ready") {
      return (
        <CocktailBigScreenReady
          order={activeOrder.order}
          cocktail={orderCocktail}
          variant={orderVariant}
        />
      );
    }

    if (activeHighlight) {
      return (
        <CocktailBigScreenHighlight
          highlight={activeHighlight.highlight}
          cocktail={activeHighlight.cocktail}
        />
      );
    }

    if (activeOrder.kind === "brewing") {
      return (
        <CocktailBigScreenBrewing
          order={activeOrder.order}
          cocktail={orderCocktail}
          variant={orderVariant}
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
