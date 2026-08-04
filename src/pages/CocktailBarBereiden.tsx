import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Maximize, Minimize, Tv } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CocktailBarQueueCard } from "@/features/cocktail-bar/components/CocktailBarQueueCard";
import { CocktailDetailDialog } from "@/features/cocktail-bar/components/CocktailDetailDialog";
import { useCocktailShowcase } from "@/features/cocktail-bar/hooks/useCocktailShowcase";
import { useFullscreen } from "@/features/cocktail-bar/hooks/useFullscreen";
import {
  COCKTAIL_ORDER_QUEUE_QUERY_KEY,
  useCocktailBarOrderQueue,
} from "@/features/cocktail-bar/hooks/useCocktailBarOrderQueue";
import { useCocktailOrderRealtimeSync } from "@/features/cocktail-bar/hooks/useCocktailOrderRealtimeSync";
import {
  dismissReadyOnBigScreen,
  extendReadyWindow,
  updateOrderStatus,
} from "@/features/cocktail-bar/lib/orders";
import type {
  CocktailFull,
  CocktailOrder,
  CocktailOrderStatus,
  CocktailVariantType,
} from "@/features/cocktail-bar/types";

const NEXT_STATUS: Record<CocktailOrderStatus, CocktailOrderStatus | null> = {
  ordered: "in_progress",
  in_progress: "ready",
  ready: "served",
  served: null,
};

const COLUMNS: { status: CocktailOrderStatus; title: string }[] = [
  { status: "ordered", title: "Besteld" },
  { status: "in_progress", title: "Bezig" },
  { status: "ready", title: "Klaar" },
];

export default function CocktailBarBereiden() {
  useCocktailOrderRealtimeSync();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useCocktailBarOrderQueue();
  const { data: cocktails = [] } = useCocktailShowcase();
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailFull | null>(
    null,
  );
  // De daadwerkelijk bestelde variant — laat het detailvenster meteen op
  // Alcoholvrij openen voor een alcoholvrije bestelling, i.p.v. altijd op
  // "Origineel" te starten en dat handmatig te moeten omzetten.
  const [selectedVariantType, setSelectedVariantType] = useState<
    CocktailVariantType | undefined
  >(undefined);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

  const advance = useMutation({
    mutationFn: (input: { orderId: string; status: CocktailOrderStatus }) =>
      updateOrderStatus(input.orderId, input.status),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: COCKTAIL_ORDER_QUEUE_QUERY_KEY,
      }),
  });
  const extend = useMutation({
    mutationFn: (orderId: string) => extendReadyWindow(orderId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: COCKTAIL_ORDER_QUEUE_QUERY_KEY,
      }),
  });
  // Schrijft alleen naar cocktail_bar_state (voor het Big Screen, fase 8) —
  // raakt de order-wachtrij hier niet, dus geen invalidate nodig.
  const dismiss = useMutation({
    mutationFn: (orderId: string) => dismissReadyOnBigScreen(orderId),
  });

  function handleAdvance(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    const next = order ? NEXT_STATUS[order.status] : null;
    if (next) advance.mutate({ orderId, status: next });
  }

  function handleCreateHighlight(order: CocktailOrder) {
    navigate("/cocktail-bar/beheren/highlights", {
      state: {
        prefillOrder: {
          orderId: order.id,
          guestName: order.guest_name,
          cocktailId: order.cocktail_id,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="cb-heading font-serif text-3xl">Cocktails bereiden</h1>
        <Link
          to="/cocktail-bar/big-screen"
          target="_blank"
          rel="noopener noreferrer"
          className="cb-button-ghost flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
        >
          <Tv className="h-4 w-4" /> Big Screen
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 cb-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnOrders = orders.filter(
              (o) => o.status === column.status,
            );
            return (
              <div key={column.status} className="space-y-3">
                <h2 className="cb-heading text-lg">
                  {column.title}{" "}
                  <span className="cb-muted text-sm">
                    ({columnOrders.length})
                  </span>
                </h2>
                {columnOrders.length === 0 ? (
                  <p className="cb-muted text-sm">Geen bestellingen.</p>
                ) : (
                  columnOrders.map((order) => {
                    const cocktail = cocktailsById.get(order.cocktail_id);
                    const variant = cocktail?.variants.find(
                      (v) => v.id === order.variant_id,
                    );
                    return (
                      <CocktailBarQueueCard
                        key={order.id}
                        order={order}
                        cocktail={cocktail}
                        variant={variant}
                        onSelect={() => {
                          if (!cocktail) return;
                          setSelectedCocktail(cocktail);
                          setSelectedVariantType(variant?.variant_type);
                        }}
                        onAdvance={handleAdvance}
                        onExtend={(id) => extend.mutate(id)}
                        onDismiss={(id) => dismiss.mutate(id)}
                        onCreateHighlight={handleCreateHighlight}
                      />
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <CocktailDetailDialog
        cocktail={selectedCocktail}
        onClose={() => setSelectedCocktail(null)}
        initialVariantType={selectedVariantType}
      />
    </div>
  );
}
