import { useQuery } from "@tanstack/react-query";
import { fetchCocktailSpirits } from "@/features/cocktail-bar/lib/reference";
import type { WizardState } from "@/features/cocktail-bar/components/CocktailWizard";

export function WizardStepBasicInfo({
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
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">Naam</label>
        <input
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="bijv. Mojito"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Korte smaakomschrijving
        </label>
        <input
          value={state.tagline}
          onChange={(e) => setState((s) => ({ ...s, tagline: e.target.value }))}
          placeholder="Fris, kruidig en verfrissend..."
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Basisdrank (optioneel)
        </label>
        <select
          value={state.alcoholic.spiritId ?? ""}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              alcoholic: { ...s.alcoholic, spiritId: e.target.value || null },
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
    </div>
  );
}
