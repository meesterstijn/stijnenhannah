import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchBarState } from "@/features/cocktail-bar/lib/barState";
import { fetchHighlights } from "@/features/cocktail-bar/lib/highlights";
import { fetchCocktailFull } from "@/features/cocktail-bar/lib/cocktails";
import type {
  CocktailBarState,
  CocktailFull,
  CocktailHighlight,
} from "@/features/cocktail-bar/types";

export type CocktailBarActiveHighlight = {
  highlight: CocktailHighlight;
  cocktail: CocktailFull | null;
} | null;

const CHANNEL_NAME = "cocktail-bar-highlight-watch";

/**
 * Bepaalt prioriteit 1 uit het plan §6 (actieve persoonlijke presentatie).
 * cocktail_bar_state.active_highlight_id is de bron van waarheid — bij elke
 * wijziging (ook aan cocktail_highlights zelf, bv. de owner bewerkt het
 * verhaal terwijl 'm al getoond wordt) wordt de volledige highlight + de
 * gekoppelde cocktail opnieuw opgehaald.
 */
export function useCocktailBarHighlightWatch(): CocktailBarActiveHighlight {
  const [barState, setBarState] = useState<CocktailBarState | null>(null);
  const [highlight, setHighlight] = useState<CocktailHighlight | null>(null);
  const [cocktail, setCocktail] = useState<CocktailFull | null>(null);
  const hasConnectedBeforeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshBarState() {
      try {
        const next = await fetchBarState();
        if (!cancelled) setBarState(next);
      } catch (err) {
        if (!cancelled)
          console.error(
            "[Cocktail Bar Big Screen] Kon status niet ophalen",
            err,
          );
      }
    }

    refreshBarState();

    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_bar_state" },
        () => refreshBarState(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cocktail_highlights" },
        () => refreshBarState(),
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          if (hasConnectedBeforeRef.current) refreshBarState();
          hasConnectedBeforeRef.current = true;
        }
      });

    function handleOnline() {
      refreshBarState();
    }
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const activeId = barState?.active_highlight_id ?? null;

    if (!activeId) {
      setHighlight(null);
      setCocktail(null);
      return;
    }

    (async () => {
      try {
        const highlights = await fetchHighlights();
        if (cancelled) return;
        const found = highlights.find((h) => h.id === activeId) ?? null;
        setHighlight(found);
        setCocktail(
          found?.cocktail_id
            ? await fetchCocktailFull(found.cocktail_id)
            : null,
        );
      } catch (err) {
        if (!cancelled)
          console.error(
            "[Cocktail Bar Big Screen] Kon highlight niet ophalen",
            err,
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [barState?.active_highlight_id]);

  if (!highlight) return null;
  return { highlight, cocktail };
}
