import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CocktailBarQueueCard } from "@/features/cocktail-bar/components/CocktailBarQueueCard";
import { CocktailDetailDialog } from "@/features/cocktail-bar/components/CocktailDetailDialog";
import { useCocktailShowcase } from "@/features/cocktail-bar/hooks/useCocktailShowcase";
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
  CocktailOrderStatus,
} from "@/features/cocktail-bar/types";

const NEXT_STATUS: Record<CocktailOrderStatus, CocktailOrderStatus | null> = {
  ordered: "in_progress",
  in_progress: "ready",
  ready: null,
};

const COLUMNS: { status: CocktailOrderStatus; title: string }[] = [
  { status: "ordered", title: "Besteld" },
  { status: "in_progress", title: "Bezig" },
  { status: "ready", title: "Klaar" },
];

export default function CocktailBarBereiden() {
  useCocktailOrderRealtimeSync();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useCocktailBarOrderQueue();
  const { data: cocktails = [] } = useCocktailShowcase();
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailFull | null>(
    null,
  );

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

  return (
    <div className="space-y-6">
      <h1 className="cb-heading font-serif text-3xl">Cocktails bereiden</h1>

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
                        onSelect={() =>
                          cocktail && setSelectedCocktail(cocktail)
                        }
                        onAdvance={handleAdvance}
                        onExtend={(id) => extend.mutate(id)}
                        onDismiss={(id) => dismiss.mutate(id)}
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
      />
    </div>
  );
}
