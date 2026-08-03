import type { CocktailVariantIngredientWithName } from "@/features/cocktail-bar/types";

// Gedeeld tussen het detailvenster en (later) het Big Screen "Wordt
// bereid"-scherm — elegante lijst met scheidingslijnen i.p.v. een technisch
// receptenlijstje, zoals in het Cocktail Bar-implementatieplan §6 bedoeld.
export function CocktailIngredientList({ ingredients }: { ingredients: CocktailVariantIngredientWithName[] }) {
  if (ingredients.length === 0) return null;

  return (
    <ul className="divide-y divide-[var(--cb-border)]">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <span>
            {ingredient.ingredient_name}
            {ingredient.note && <span className="cb-muted"> — {ingredient.note}</span>}
          </span>
          <span className="cb-muted shrink-0 tabular-nums">
            {ingredient.amount} {ingredient.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
