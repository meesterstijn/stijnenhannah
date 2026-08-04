import { GrowthPhotoInput } from "@/features/tuingids/components/GrowthPhotoInput";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

// Hergebruikt GrowthPhotoInput (Tuingids) 1-op-1 voor de camera/galerij-
// knoppen — dat component is al feature-onafhankelijk (puur file-picker-UI),
// dus een tweede camera/galerij-implementatie zou onnodige duplicatie zijn.
// Slechts één foto: de laatst gekozen file uit onFilesChange wordt gebruikt.
export function WizardStepPhoto({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  // Alleen de BESTAANDE foto hier tonen (als url, wat GrowthPhotoInput niet
  // kan — dat component toont enkel previews van File-objecten). Zodra een
  // nieuwe foto gekozen wordt, toont GrowthPhotoInput die zelf al als
  // thumbnail — dan zou dit blok een dubbele preview zijn.
  const existingPreviewUrl = !state.photoFile && state.existingPhotoPath ? getCocktailPhotoUrl(state.existingPhotoPath) : null;

  return (
    <div className="space-y-4">
      <p className="cb-muted text-xs uppercase tracking-wide">Cocktailfoto</p>
      <p className="text-sm">
        Gebruik bij voorkeur een vrijstaande foto met transparante achtergrond (PNG) — die "zweeft" straks op de donkere
        kaarten, net als bij de referentiestijl.
      </p>

      {existingPreviewUrl && (
        <div className="relative flex h-48 items-center justify-center rounded-2xl bg-black/20">
          <img src={existingPreviewUrl} alt="Huidige foto" className="h-full max-w-full object-contain" />
        </div>
      )}

      <GrowthPhotoInput
        files={state.photoFile ? [state.photoFile] : []}
        onFilesChange={(files) => setState((s) => ({ ...s, photoFile: files[files.length - 1] ?? null }))}
      />
    </div>
  );
}
