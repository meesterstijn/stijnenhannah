import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CocktailBarConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

const CHANNEL_NAME = "cocktail-bar-connection-status";

// Puur voor het kleine, discrete verbindingsindicatortje in de hoek van het
// Big Screen — mirrort useR6ActiveSessionWatch's connectionStatus-aanpak,
// maar als eigen kanaal: de databewatch-hooks doen hun reconnect-refetch al
// zelf, dit kanaal bestaat alleen om die verbindingsstatus te tonen.
export function useCocktailBarConnectionStatus(): CocktailBarConnectionStatus {
  const [status, setStatus] =
    useState<CocktailBarConnectionStatus>("connecting");

  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_bar_state" },
        () => {},
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") setStatus("connected");
        else if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT" ||
          subscribeStatus === "CLOSED"
        )
          setStatus("disconnected");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
