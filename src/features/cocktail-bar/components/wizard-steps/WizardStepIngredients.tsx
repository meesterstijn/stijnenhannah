import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { fetchCocktailIngredients } from "@/features/cocktail-bar/lib/reference";
import type { IngredientRowDraft, VariantDraft } from "@/features/cocktail-bar/components/CocktailWizard";

// Gedeeld tussen stap 4 (alcoholische variant) en stap 7 (alcoholvrije
// variant). Ingrediëntnaam is vrije tekst met een <datalist>-suggestielijst
// uit de bestaande catalogus — bestaat de naam nog niet, dan maakt
// createIngredient() 'm pas aan bij het opslaan (zie CocktailWizard.tsx),
// niet hier al.
export function WizardStepIngredients({ variant, onChange }: { variant: VariantDraft; onChange: (v: VariantDraft) => void }) {
  const { data: ingredients = [] } = useQuery({ queryKey: ["cocktail_bar", "ingredients"], queryFn: fetchCocktailIngredients });

  function updateRow(index: number, patch: Partial<IngredientRowDraft>) {
    onChange({ ...variant, ingredients: variant.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  }

  function addRow() {
    onChange({ ...variant, ingredients: [...variant.ingredients, { name: "", amount: "", unit: "", note: "" }] });
  }

  function removeRow(index: number) {
    onChange({ ...variant, ingredients: variant.ingredients.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <p className="cb-muted text-xs uppercase tracking-wide">Ingrediënten</p>

      <datalist id="cocktail-ingredient-suggestions">
        {ingredients.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <div className="space-y-3">
        {variant.ingredients.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--cb-border)] p-2">
            <input
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              list="cocktail-ingredient-suggestions"
              placeholder="Ingrediënt"
              className="min-w-[8rem] flex-1 rounded-md px-2 py-1.5 text-sm"
            />
            <input
              value={row.amount}
              onChange={(e) => updateRow(index, { amount: e.target.value })}
              placeholder="50"
              inputMode="decimal"
              className="w-16 rounded-md px-2 py-1.5 text-sm"
            />
            <input
              value={row.unit}
              onChange={(e) => updateRow(index, { unit: e.target.value })}
              placeholder="ml"
              className="w-16 rounded-md px-2 py-1.5 text-sm"
            />
            <input
              value={row.note}
              onChange={(e) => updateRow(index, { note: e.target.value })}
              placeholder="notitie (optioneel)"
              className="min-w-[6rem] flex-1 rounded-md px-2 py-1.5 text-sm"
            />
            <button type="button" onClick={() => removeRow(index)} aria-label="Ingrediënt verwijderen" className="cb-button-ghost rounded-full p-1.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="cb-button-ghost flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm">
        <Plus className="h-3.5 w-3.5" /> Ingrediënt toevoegen
      </button>
    </div>
  );
}
