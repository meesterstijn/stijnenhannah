import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { CocktailVariantIngredientWithName } from "@/features/cocktail-bar/types";

// Zuivere selectiestap vóór de bestaande addCocktailIngredientsToGroceryList
// (groceryIntegration.ts) — bepaalt uitsluitend WELKE regels uit de al
// opgehaalde ingrediëntenlijst worden doorgegeven. Geen eigen
// boodschappenlogica, geen databasetoegang.
export function CocktailIngredientSelectionDialog({
  open,
  onOpenChange,
  ingredients,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: CocktailVariantIngredientWithName[];
  onConfirm: (selected: CocktailVariantIngredientWithName[]) => void;
  isPending: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bij elke keer openen (en als de ingrediëntenlijst zelf wisselt, bv. na
  // het kiezen van een andere variant/cocktail) opnieuw ALLES selecteren —
  // een eerdere selectie mag nooit blijven "plakken" op een volgende keer.
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(ingredients.map((i) => i.id)));
    }
  }, [open, ingredients]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = ingredients.filter((i) => selectedIds.has(i.id));
  const allSelected = selected.length === ingredients.length;

  function handleConfirm() {
    if (selected.length === 0 || isPending) return;
    onConfirm(selected);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="cocktail-theme cb-dialog w-full max-w-md max-h-[85vh] sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle asChild>
            <h2 className="cb-heading font-serif text-2xl">
              Ingrediënten toevoegen
            </h2>
          </DialogTitle>
        </DialogHeader>

        <p className="cb-muted text-sm">
          Kies welke ingrediënten je aan de boodschappenlijst wilt toevoegen.
        </p>

        {ingredients.length > 1 && (
          <div className="flex gap-4 text-xs">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(new Set(ingredients.map((i) => i.id)))
              }
              disabled={allSelected}
              className="cb-muted underline-offset-2 hover:underline disabled:opacity-40"
            >
              Alles selecteren
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selected.length === 0}
              className="cb-muted underline-offset-2 hover:underline disabled:opacity-40"
            >
              Alles uitvinken
            </button>
          </div>
        )}

        <ul className="max-h-[45vh] space-y-0 divide-y divide-[var(--cb-border)] overflow-y-auto">
          {ingredients.map((ingredient) => {
            const checked = selectedIds.has(ingredient.id);
            return (
              <li key={ingredient.id}>
                <label className="flex items-center gap-3 py-3 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(ingredient.id)}
                    className="h-5 w-5 shrink-0 border-[var(--cb-border)] data-[state=checked]:border-[var(--cb-amber)] data-[state=checked]:bg-[var(--cb-amber)] data-[state=checked]:text-[var(--cb-black)]"
                  />
                  <span className="flex-1 min-w-0 text-sm break-words">
                    {ingredient.ingredient_name}
                    {ingredient.note && (
                      <span className="cb-muted"> — {ingredient.note}</span>
                    )}
                  </span>
                  <span className="cb-muted shrink-0 text-xs tabular-nums">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="cb-button-ghost rounded-full px-4 py-2 text-sm disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.length === 0 || isPending}
            className="cb-button flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {selected.length > 0
              ? `${selected.length} ingrediënt${selected.length === 1 ? "" : "en"} toevoegen`
              : "Geselecteerde toevoegen"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
