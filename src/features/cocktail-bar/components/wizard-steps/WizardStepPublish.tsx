import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

// De daadwerkelijke opslaan-actie (Concept opslaan / Publiceren) zit in de
// footer van CocktailWizard.tsx zelf — deze stap is puur een laatste
// bevestiging/samenvatting, geen los formulier.
export function WizardStepPublish({ state }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="cb-muted">Naam:</span> {state.name}
      </p>
      <p>
        <span className="cb-muted">Basisdrank:</span> {state.alcoholic.spiritId ?? "—"}
      </p>
      <p>
        <span className="cb-muted">Alcoholvrije variant:</span> {state.hasAlcoholFree ? "Ja" : "Nee"}
      </p>
      <p className="cb-muted">
        Kies hieronder "Concept opslaan" om later verder te werken, of "Publiceren" om de cocktail direct zichtbaar te
        maken op de Cocktail Bar-pagina.
      </p>
    </div>
  );
}
