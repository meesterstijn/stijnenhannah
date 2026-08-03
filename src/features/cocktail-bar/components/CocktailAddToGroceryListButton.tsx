import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBasket } from "lucide-react";
import { addCocktailIngredientsToGroceryList } from "@/features/cocktail-bar/lib/groceryIntegration";
import type { CocktailVariantIngredientWithName } from "@/features/cocktail-bar/types";

export function CocktailAddToGroceryListButton({ ingredients }: { ingredients: CocktailVariantIngredientWithName[] }) {
  const [count, setCount] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addCocktailIngredientsToGroceryList(ingredients, count),
    onSuccess: () => {
      // ["groceries"] is dezelfde querykey als Boodschappen.tsx zelf
      // gebruikt — inclusief het aantal-widgetje op de homepage
      // (["groceries","home-count"]), want React Query invalideert op
      // key-prefix.
      queryClient.invalidateQueries({ queryKey: ["groceries"] });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2500);
    },
  });

  if (ingredients.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="cb-badge">
        <button
          type="button"
          onClick={() => setCount((c) => Math.max(1, c - 1))}
          aria-label="Aantal cocktails verminderen"
          className="flex h-4 w-4 items-center justify-center"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-8 text-center tabular-nums">{count}x</span>
        <button
          type="button"
          onClick={() => setCount((c) => Math.min(20, c + 1))}
          aria-label="Aantal cocktails vermeerderen"
          className="flex h-4 w-4 items-center justify-center"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="cb-button flex items-center gap-2 rounded-full px-4 py-2 text-sm"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingBasket className="h-4 w-4" />
        )}
        {justAdded ? "Toegevoegd!" : "Toevoegen aan boodschappenlijst"}
      </button>
    </div>
  );
}
