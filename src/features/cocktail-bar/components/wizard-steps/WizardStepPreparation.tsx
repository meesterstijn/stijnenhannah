import { useQuery } from "@tanstack/react-query";
import { fetchCocktailGarnishes, fetchCocktailGlassTypes } from "@/features/cocktail-bar/lib/reference";
import type { VariantDraft } from "@/features/cocktail-bar/components/CocktailWizard";

// Gedeeld tussen stap 5 (alcoholische variant) en stap 7 (alcoholvrije
// variant) — glas, garnering, ABV% en bereidingswijze.
export function WizardStepPreparation({ variant, onChange }: { variant: VariantDraft; onChange: (v: VariantDraft) => void }) {
  const { data: glassTypes = [] } = useQuery({ queryKey: ["cocktail_bar", "glass_types"], queryFn: fetchCocktailGlassTypes });
  const { data: garnishes = [] } = useQuery({ queryKey: ["cocktail_bar", "garnishes"], queryFn: fetchCocktailGarnishes });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">Glas</label>
          <select
            value={variant.glassTypeId ?? ""}
            onChange={(e) => onChange({ ...variant, glassTypeId: e.target.value || null })}
            className="w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Kies een glas...</option>
            {glassTypes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">Alcoholpercentage</label>
          <input
            value={variant.abvPercent}
            onChange={(e) => onChange({ ...variant, abvPercent: e.target.value })}
            inputMode="decimal"
            placeholder="12.5"
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">Garnering</label>
        <datalist id="cocktail-garnish-suggestions">
          {garnishes.map((g) => (
            <option key={g.id} value={g.name} />
          ))}
        </datalist>
        <input
          value={variant.garnishName}
          onChange={(e) => onChange({ ...variant, garnishName: e.target.value })}
          list="cocktail-garnish-suggestions"
          placeholder="bijv. Muntblaadje en limoenschijfje"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">Bereidingswijze</label>
        <textarea
          value={variant.preparationSteps}
          onChange={(e) => onChange({ ...variant, preparationSteps: e.target.value })}
          rows={4}
          placeholder="Beschrijf stap voor stap hoe de cocktail gemaakt wordt..."
          className="w-full resize-none rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
