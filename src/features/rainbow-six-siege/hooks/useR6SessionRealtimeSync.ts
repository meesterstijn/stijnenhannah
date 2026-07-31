import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Eén Realtime-kanaal per sessie, met een stabiele naam (session-gebonden)
 * zodat er nooit twee kanalen voor dezelfde sessie tegelijk open staan.
 * Werkt bewust via `queryClient.invalidateQueries` op de AL BESTAANDE query
 * keys (useR6SessionDetail, useR6Events, useLatestR6Match,
 * useR6GameOperatorAssignments, useR6SessionChaosEffects) i.p.v. een eigen,
 * parallelle state bij te houden — React Query is hier al de databron, dus
 * wijzigingen van een ander apparaat/tabblad hoeven alleen een refetch te
 * triggeren, geen losse synchronisatielaag.
 *
 * Gebruikt door zowel de Tablet Controller als de normale Live LAN-pagina
 * (RainbowSixSiegeSession) — vandaar de sessie-brede naam i.p.v.
 * "Controller"-specifiek: zonder dit op de Live LAN-pagina zou bv. een MVP-
 * undo vanaf de Tablet daar pas zichtbaar worden na een handmatige refresh
 * of window-focus, niet direct.
 *
 * Alleen actief zolang de sessie live is; bij het afronden van de LAN (of
 * het verlaten van de pagina) wordt het kanaal opgeruimd.
 */
export function useR6SessionRealtimeSync(sessionId: string | undefined, isLive: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId || !isLive) return;

    const channel = supabase
      .channel(`r6-session-realtime-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_events", filter: `session_id=eq.${sessionId}` },
        () => queryClient.invalidateQueries({ queryKey: ["r6_events", sessionId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_matches", filter: `session_id=eq.${sessionId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["r6_latest_match", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["r6_session_detail", sessionId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "r6_sessions", filter: `id=eq.${sessionId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["r6_session_detail", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["r6_sessions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_game_operator_assignments", filter: `session_id=eq.${sessionId}` },
        // Geen specifieke match_id bekend hier — prefix-match invalideert
        // elke ["r6_game_operator_assignments", matchId]-query (React Query
        // matcht queryKeys standaard op prefix, niet exact).
        () => queryClient.invalidateQueries({ queryKey: ["r6_game_operator_assignments"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_session_chaos_effects", filter: `session_id=eq.${sessionId}` },
        () => queryClient.invalidateQueries({ queryKey: ["r6_session_chaos_effects", sessionId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isLive, queryClient]);
}
