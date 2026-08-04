import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { fetchAllCocktails } from "@/features/cocktail-bar/lib/cocktails";
import {
  deleteHighlight,
  setHighlightActive,
} from "@/features/cocktail-bar/lib/highlights";
import {
  clearHighlight,
  pushHighlight,
} from "@/features/cocktail-bar/lib/barState";
import {
  useCocktailHighlights,
  COCKTAIL_HIGHLIGHTS_QUERY_KEY,
} from "@/features/cocktail-bar/hooks/useCocktailHighlights";
import {
  useCocktailBarState,
  COCKTAIL_BAR_STATE_QUERY_KEY,
} from "@/features/cocktail-bar/hooks/useCocktailBarState";
import { useCocktailBarOrderQueue } from "@/features/cocktail-bar/hooks/useCocktailBarOrderQueue";
import { CocktailHighlightForm } from "@/features/cocktail-bar/components/CocktailHighlightForm";
import { CocktailHighlightPresenterView } from "@/features/cocktail-bar/components/CocktailHighlightPresenterView";
import type { CocktailHighlight } from "@/features/cocktail-bar/types";

const COCKTAILS_QUERY_KEY = ["cocktail_bar", "cocktails", "all"];

type PrefillOrder = { orderId: string; guestName: string; cocktailId: string };

export default function CocktailBarHighlightsAdmin() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Vanuit de "Highlight"-knop op de Bereiden-wachtrij (CocktailBarBereiden.tsx)
  // komt hier eenmalig route-state mee — meteen bij mount wegschrijven zodat
  // een browser-terugknop het formulier niet opnieuw opent.
  const [prefillOrder] = useState<PrefillOrder | null>(
    () =>
      (location.state as { prefillOrder?: PrefillOrder } | null)
        ?.prefillOrder ?? null,
  );
  useEffect(() => {
    if (location.state)
      navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: highlights = [], isLoading } = useCocktailHighlights();
  const { data: cocktails = [] } = useQuery({
    queryKey: COCKTAILS_QUERY_KEY,
    queryFn: fetchAllCocktails,
  });
  const { data: orders = [] } = useCocktailBarOrderQueue();
  const { data: barState } = useCocktailBarState();

  const [formOpen, setFormOpen] = useState(!!prefillOrder);
  const [editingHighlight, setEditingHighlight] =
    useState<CocktailHighlight | null>(null);
  const [viewingHighlight, setViewingHighlight] =
    useState<CocktailHighlight | null>(null);

  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setHighlightActive(id, isActive),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: COCKTAIL_HIGHLIGHTS_QUERY_KEY,
      }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteHighlight(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: COCKTAIL_HIGHLIGHTS_QUERY_KEY,
      }),
  });
  const show = useMutation({
    mutationFn: (id: string) => pushHighlight(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: COCKTAIL_BAR_STATE_QUERY_KEY }),
  });
  const hide = useMutation({
    mutationFn: () => clearHighlight(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: COCKTAIL_BAR_STATE_QUERY_KEY }),
  });

  function openNewForm() {
    setEditingHighlight(null);
    setFormOpen(true);
  }
  function openEditForm(highlight: CocktailHighlight) {
    setEditingHighlight(highlight);
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingHighlight(null);
  }
  function handleSaved() {
    closeForm();
    queryClient.invalidateQueries({ queryKey: COCKTAIL_HIGHLIGHTS_QUERY_KEY });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="cb-heading font-serif text-3xl">
          Persoonlijke presentaties
        </h1>
        {!formOpen && (
          <button
            type="button"
            onClick={openNewForm}
            className="cb-button flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Nieuwe presentatie
          </button>
        )}
      </div>

      {formOpen && (
        <CocktailHighlightForm
          existingHighlight={editingHighlight}
          prefill={!editingHighlight ? prefillOrder : null}
          cocktails={cocktails}
          orders={orders}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-16 cb-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : highlights.length === 0 ? (
        <p className="cb-muted text-sm">Nog geen presentaties.</p>
      ) : (
        <ul className="space-y-3">
          {highlights.map((highlight) => {
            const cocktail = highlight.cocktail_id
              ? cocktailsById.get(highlight.cocktail_id)
              : undefined;
            const isActiveOnBigScreen =
              barState?.active_highlight_id === highlight.id;
            return (
              <li
                key={highlight.id}
                className="cb-tile flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="cb-heading font-serif text-xl">
                    {highlight.guest_name} — {highlight.title}
                  </p>
                  <p className="cb-muted truncate text-sm">
                    {cocktail?.name ?? "Geen cocktail gekoppeld"}
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    <span className="cb-badge">
                      {highlight.is_active ? "Actief" : "Verborgen"}
                    </span>
                    {isActiveOnBigScreen && (
                      <span className="cb-badge">Op Big Screen</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewingHighlight(highlight)}
                    className="cb-button-ghost rounded-full px-3 py-1.5 text-sm"
                  >
                    Bekijken
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(highlight)}
                    className="cb-button-ghost rounded-full px-3 py-1.5 text-sm"
                  >
                    Bewerken
                  </button>
                  {isActiveOnBigScreen ? (
                    <button
                      type="button"
                      onClick={() => hide.mutate()}
                      className="cb-button-ghost rounded-full px-3 py-1.5 text-sm"
                    >
                      Van Big Screen halen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        show.mutate(highlight.id, {
                          onSuccess: () => setViewingHighlight(highlight),
                        })
                      }
                      className="cb-button rounded-full px-3 py-1.5 text-sm"
                    >
                      Highlight op Big Screen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      toggleActive.mutate({
                        id: highlight.id,
                        isActive: !highlight.is_active,
                      })
                    }
                    disabled={toggleActive.isPending}
                    className="cb-button-ghost rounded-full px-3 py-1.5 text-sm"
                  >
                    {highlight.is_active ? "Verbergen" : "Activeren"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Presentatie voor "${highlight.guest_name}" definitief verwijderen?`,
                        )
                      )
                        remove.mutate(highlight.id);
                    }}
                    disabled={remove.isPending}
                    aria-label={`Presentatie voor ${highlight.guest_name} verwijderen`}
                    className="cb-button-ghost rounded-full p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CocktailHighlightPresenterView
        highlight={viewingHighlight}
        cocktail={
          viewingHighlight?.cocktail_id
            ? cocktailsById.get(viewingHighlight.cocktail_id)
            : undefined
        }
        isActiveOnBigScreen={
          !!viewingHighlight &&
          barState?.active_highlight_id === viewingHighlight.id
        }
        onClose={() => setViewingHighlight(null)}
        onShow={() => viewingHighlight && show.mutate(viewingHighlight.id)}
        onHide={() => hide.mutate()}
        onMarkDone={() => {
          if (
            viewingHighlight &&
            barState?.active_highlight_id === viewingHighlight.id
          )
            hide.mutate();
          setViewingHighlight(null);
        }}
      />
    </div>
  );
}
