import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { fetchAllCocktails } from "@/features/cocktail-bar/lib/cocktails";
import {
  deleteOrders,
  fetchOrderQueue,
} from "@/features/cocktail-bar/lib/orders";
import { ORDER_STATUS_LABELS } from "@/features/cocktail-bar/lib/dashboard";

const COCKTAILS_QUERY_KEY = ["cocktail_bar", "cocktails", "all"];
const ORDERS_QUERY_KEY = ["cocktail_bar", "orders", "cleanup"];

// Handmatige opruimtool voor testbestellingen (dashboard, §9) — verwijdert
// uitsluitend de geselecteerde bestellingen zelf, nooit de cocktails
// waaruit gasten kiezen. Een cocktail zelf verwijderen (recept + foto)
// blijft een losse, altijd beschikbare actie op de Beheer-pagina
// (CocktailBarAdmin.tsx) — dit blok raakt daar niets aan.
export function CocktailDashboardCleanup() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: fetchOrderQueue,
  });
  const { data: cocktails = [] } = useQuery({
    queryKey: COCKTAILS_QUERY_KEY,
    queryFn: fetchAllCocktails,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const cocktailsById = new Map(cocktails.map((c) => [c.id, c]));

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => deleteOrders(ids),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ["cocktail_bar", "orders", "queue"],
      });
      queryClient.invalidateQueries({
        queryKey: ["cocktail_bar", "dashboard"],
      });
    },
  });

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete() {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `${selectedIds.size} bestelling(en) definitief verwijderen? De cocktails zelf blijven bestaan.`,
      )
    )
      return;
    bulkDelete.mutate([...selectedIds]);
  }

  const sortedOrders = orders
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  return (
    <div className="cb-tile space-y-3 p-4">
      <h3 className="cb-heading text-lg">Testbestellingen opruimen</h3>
      <p className="cb-muted text-xs">
        Verwijdert alleen de geselecteerde bestellingen — de cocktails zelf
        blijven bestaan.
      </p>

      {isLoading ? (
        <Loader2 className="cb-muted h-5 w-5 animate-spin" />
      ) : sortedOrders.length === 0 ? (
        <p className="cb-muted text-sm">Geen bestellingen.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {sortedOrders.map((order) => (
            <li key={order.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate">
                  {order.guest_name} —{" "}
                  {cocktailsById.get(order.cocktail_id)?.name ??
                    "Onbekende cocktail"}
                </span>
                <span className="cb-badge shrink-0">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={selectedIds.size === 0 || bulkDelete.isPending}
        className="cb-button-ghost flex items-center gap-1.5 rounded-full px-4 py-2 text-sm disabled:opacity-40"
      >
        {bulkDelete.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Geselecteerde verwijderen ({selectedIds.size})
      </button>
    </div>
  );
}
