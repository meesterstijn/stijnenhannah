import { WizardStepFlavourProfile } from "@/features/cocktail-bar/components/wizard-steps/WizardStepFlavourProfile";
import { WizardStepIngredients } from "@/features/cocktail-bar/components/wizard-steps/WizardStepIngredients";
import { WizardStepPreparation } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPreparation";
import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

// Hergebruikt dezelfde 3 stap-componenten als de alcoholische variant
// (smaakprofiel/ingrediënten/bereiding) i.p.v. een tweede, aparte
// implementatie — alleen de variant-state die erin/eruit gaat verschilt.
// Geen basisdrank-veld (alcoholvrij heeft er per definitie geen) en geen
// los ABV-veld nodig (WizardStepPreparation toont het wel, maar het wordt bij
// opslaan altijd hard op 0 gezet, zie CocktailWizard.tsx).
export function WizardStepAlcoholFree({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.hasAlcoholFree}
          onChange={(e) => setState((s) => ({ ...s, hasAlcoholFree: e.target.checked }))}
          className="h-4 w-4"
        />
        Deze cocktail heeft een volledige alcoholvrije variant
      </label>

      {state.hasAlcoholFree && (
        <div className="space-y-6 border-t border-[var(--cb-border)] pt-4">
          <WizardStepPreparation variant={state.alcoholFree} onChange={(v) => setState((s) => ({ ...s, alcoholFree: v }))} />
          <WizardStepFlavourProfile variant={state.alcoholFree} onChange={(v) => setState((s) => ({ ...s, alcoholFree: v }))} />
          <WizardStepIngredients variant={state.alcoholFree} onChange={(v) => setState((s) => ({ ...s, alcoholFree: v }))} />
        </div>
      )}
    </div>
  );
}
