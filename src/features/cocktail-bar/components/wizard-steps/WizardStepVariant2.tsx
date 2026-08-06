import { useQuery } from "@tanstack/react-query";
import { fetchCocktailSpirits } from "@/features/cocktail-bar/lib/reference";
import { WizardStepFlavourProfile } from "@/features/cocktail-bar/components/wizard-steps/WizardStepFlavourProfile";
import { WizardStepIngredients } from "@/features/cocktail-bar/components/wizard-steps/WizardStepIngredients";
import { WizardStepPreparation } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPreparation";
import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

// Optioneel DERDE, vast variant-slot ("Variant" in het detailvenster, naast
// "Origineel" en "Alcoholvrije variant") — een volledige tweede alcoholische
// variant, dus in tegenstelling tot WizardStepAlcoholFree WEL een eigen
// basisdrank-keuze nodig. Hergebruikt verder dezelfde 3 stap-componenten als
// de andere twee varianten i.p.v. een tweede, aparte implementatie.
export function WizardStepVariant2({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const { data: spirits = [] } = useQuery({
    queryKey: ["cocktail_bar", "spirits"],
    queryFn: fetchCocktailSpirits,
  });

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.hasVariant2}
          onChange={(e) =>
            setState((s) => ({ ...s, hasVariant2: e.target.checked }))
          }
          className="h-4 w-4"
        />
        Deze cocktail heeft een tweede variant
      </label>

      {state.hasVariant2 && (
        <div className="space-y-6 border-t border-[var(--cb-border)] pt-4">
          <div className="space-y-1.5">
            <label className="cb-muted text-xs uppercase tracking-wide">
              Basisdrank (optioneel)
            </label>
            <select
              value={state.variant2.spiritId ?? ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  variant2: { ...s.variant2, spiritId: e.target.value || null },
                }))
              }
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Nog geen basisdrank — later toevoegen</option>
              {spirits.map((spirit) => (
                <option key={spirit.id} value={spirit.id}>
                  {spirit.name}
                </option>
              ))}
            </select>
          </div>

          <WizardStepPreparation
            variant={state.variant2}
            onChange={(v) => setState((s) => ({ ...s, variant2: v }))}
          />
          <WizardStepFlavourProfile
            variant={state.variant2}
            onChange={(v) => setState((s) => ({ ...s, variant2: v }))}
          />
          <WizardStepIngredients
            variant={state.variant2}
            onChange={(v) => setState((s) => ({ ...s, variant2: v }))}
          />
        </div>
      )}
    </div>
  );
}
