import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { COCKTAIL_ORDER_QUEUE_QUERY_KEY } from "@/features/cocktail-bar/hooks/useCocktailBarOrderQueue";

// Ongefilterd op cocktail_orders (dezelfde DELETE/REPLICA IDENTITY-valkuil
// als useCocktailShowcaseRealtimeSync) — laat nieuwe tabletbestellingen en
// eigen statuswijzigingen live doorkomen op de Bereiden-pagina.
export function useCocktailOrderRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: COCKTAIL_ORDER_QUEUE_QUERY_KEY,
      });

    const channel = supabase
      .channel("cocktail-bar-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_orders" },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
