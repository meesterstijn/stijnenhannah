import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchOrderQueue } from "@/features/cocktail-bar/lib/orders";
import { fetchBarState } from "@/features/cocktail-bar/lib/barState";
import type {
  CocktailBarState,
  CocktailOrder,
} from "@/features/cocktail-bar/types";

export type CocktailBarActiveOrder =
  | { kind: "brewing"; order: CocktailOrder }
  | { kind: "ready"; order: CocktailOrder; remainingSeconds: number }
  | { kind: "none" };

const CHANNEL_NAME = "cocktail-bar-active-order-watch";

/**
 * Bepaalt prioriteit 2 ("Bezig") en 3 ("Klaar", binnen ready_display_seconds
 * en niet dismissed) uit het Cocktail Bar-implementatieplan §6 — prioriteit 1
 * (actieve presentatie) zit in useCocktailBarHighlightWatch, de pagina zelf
 * combineert beide. Mirrort useR6ActiveSessionWatch: bij elke wijziging
 * (elders, bv. Bereiden-pagina) wordt de volledige actuele staat opnieuw
 * opgehaald, nooit incrementeel gepatcht.
 */
export function useCocktailBarActiveOrderWatch(): CocktailBarActiveOrder {
  const [orders, setOrders] = useState<CocktailOrder[]>([]);
  const [barState, setBarState] = useState<CocktailBarState | null>(null);
  const [, forceTick] = useState(0);
  const hasConnectedBeforeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [nextOrders, nextBarState] = await Promise.all([
          fetchOrderQueue(),
          fetchBarState(),
        ]);
        if (cancelled) return;
        setOrders(nextOrders);
        setBarState(nextBarState);
      } catch (err) {
        if (cancelled) return;
        console.error(
          "[Cocktail Bar Big Screen] Kon bestellingen/status niet ophalen",
          err,
        );
      }
    }

    refresh();

    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_orders" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_bar_state" },
        () => refresh(),
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          if (hasConnectedBeforeRef.current) refresh();
          hasConnectedBeforeRef.current = true;
        }
      });

    function handleOnline() {
      refresh();
    }
    window.addEventListener("online", handleOnline);

    // Eigen 1-sekonde-tikker: het klaar-scherm moet na ready_display_seconds
    // vanzelf verdwijnen puur op basis van verstreken tijd, niet op een
    // nieuwe databasewijziging — zonder deze tikker zou dat nooit gebeuren.
    const tickInterval = setInterval(() => forceTick((t) => t + 1), 1000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      clearInterval(tickInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  if (!barState) return { kind: "none" };

  const brewingOrder = orders
    .filter((o) => o.status === "in_progress")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
  if (brewingOrder) return { kind: "brewing", order: brewingOrder };

  const readyOrders = orders
    .filter(
      (o) =>
        o.status === "ready" &&
        o.id !== barState.dismissed_ready_order_id &&
        o.ready_at,
    )
    .sort(
      (a, b) =>
        new Date(b.ready_at as string).getTime() -
        new Date(a.ready_at as string).getTime(),
    );

  for (const order of readyOrders) {
    const elapsedSeconds =
      (Date.now() - new Date(order.ready_at as string).getTime()) / 1000;
    const remainingSeconds = barState.ready_display_seconds - elapsedSeconds;
    if (remainingSeconds > 0) return { kind: "ready", order, remainingSeconds };
  }

  return { kind: "none" };
}
