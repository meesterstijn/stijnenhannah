import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  deleteCocktail,
  fetchAllCocktails,
  setCocktailPublished,
} from "@/features/cocktail-bar/lib/cocktails";

const QUERY_KEY = ["cocktail_bar", "cocktails", "all"];

export default function CocktailBarAdmin() {
  const queryClient = useQueryClient();
  const { data: cocktails = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAllCocktails,
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      setCocktailPublished(id, isPublished),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCocktail(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="cb-heading font-serif text-3xl">Cocktails beheren</h1>
        <div className="flex items-center gap-1.5">
          <Link
            to="/cocktail-bar/beheren/highlights"
            className="cb-button-ghost rounded-full px-4 py-2 text-sm"
          >
            Presentaties
          </Link>
          <Link
            to="/cocktail-bar/beheren/nieuw"
            className="cb-button flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Nieuwe cocktail
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 cb-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : cocktails.length === 0 ? (
        <p className="cb-muted text-sm">Nog geen cocktails.</p>
      ) : (
        <ul className="space-y-3">
          {cocktails.map((cocktail) => (
            <li
              key={cocktail.id}
              className="cb-tile flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="cb-heading font-serif text-xl">{cocktail.name}</p>
                <p className="cb-muted truncate text-sm">{cocktail.tagline}</p>
                <span
                  className={`cb-badge mt-1 inline-flex ${
                    cocktail.is_published ? "cb-badge-live" : "cb-badge-draft"
                  }`}
                >
                  {cocktail.is_published ? "Live" : "Niet live"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  to={`/cocktail-bar/beheren/${cocktail.id}`}
                  className="cb-button-ghost rounded-full px-3 py-1.5 text-sm"
                >
                  Bewerken
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    togglePublish.mutate({
                      id: cocktail.id,
                      isPublished: !cocktail.is_published,
                    })
                  }
                  disabled={togglePublish.isPending}
                  className={`cb-button-ghost rounded-full px-3 py-1.5 text-sm ${
                    cocktail.is_published ? "cb-button-draft" : "cb-button-live"
                  }`}
                >
                  {cocktail.is_published ? "Niet live maken" : "Live zetten"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `"${cocktail.name}" definitief verwijderen? Bijbehorende bestellingen worden ook verwijderd.`,
                      )
                    )
                      remove.mutate(cocktail.id);
                  }}
                  disabled={remove.isPending}
                  aria-label={`${cocktail.name} verwijderen`}
                  className="cb-button-ghost rounded-full p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {remove.isError && remove.variables === cocktail.id && (
                <p className="w-full text-xs text-red-400">
                  {(remove.error as Error).message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
