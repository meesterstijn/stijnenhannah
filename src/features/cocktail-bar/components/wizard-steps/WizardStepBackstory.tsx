import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

export function WizardStepBackstory({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="cb-muted text-xs uppercase tracking-wide">Achtergrondverhaal (optioneel)</label>
      <textarea
        value={state.backstory}
        onChange={(e) => setState((s) => ({ ...s, backstory: e.target.value }))}
        rows={6}
        placeholder="Waar komt deze cocktail vandaan, wat maakt 'm bijzonder..."
        className="w-full resize-none rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
