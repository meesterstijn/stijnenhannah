import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { COCKTAIL_SHOWCASE_QUERY_KEY } from "@/features/cocktail-bar/hooks/useCocktailShowcase";

// Eén kanaal, ongefilterd op alle vier de tabellen die samen één kaart
// vormen — mirrort useR6SessionRealtimeSync: Realtime is hier alleen een
// "ga opnieuw ophalen"-trigger voor de al bestaande React Query-cache, geen
// eigen parallelle state. Ongefilterd (geen `filter` op een niet-PK-kolom)
// om exact de DELETE/REPLICA IDENTITY-valkuil te vermijden die bij R6 een
// echte bug veroorzaakte — de dataset is klein genoeg dat dit goedkoop is.
export function useCocktailShowcaseRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: COCKTAIL_SHOWCASE_QUERY_KEY });

    const channel = supabase
      .channel("cocktail-bar-showcase-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cocktails" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cocktail_variants" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cocktail_flavour_profiles" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "cocktail_variant_ingredients" }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
