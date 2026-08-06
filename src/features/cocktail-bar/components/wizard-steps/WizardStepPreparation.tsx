import { useQuery } from "@tanstack/react-query";
import { Snowflake } from "lucide-react";
import {
  fetchCocktailGarnishes,
  fetchCocktailGlassTypes,
} from "@/features/cocktail-bar/lib/reference";
import type { VariantDraft } from "@/features/cocktail-bar/components/CocktailWizard";

// Vaste, herbruikbare bartender-instructie voor het koelen door te shaken met
// ijs — via het vinkje hieronder in/uit de bereidingswijze te zetten, zodat
// je 'm niet elke cocktail opnieuw hoeft te typen.
const ICE_SHAKE_NOTE =
  "IJs voor het koelen (shaken): vul de grote Boston beker voor ongeveer ¾ met ijs — liever te veel dan te weinig, zodat de cocktail snel genoeg afkoelt en de juiste verdunning krijgt. Shake krachtig gedurende de aangegeven tijd. Blijft er na het uitschenken nog ijs in de shaker over? Dat is normaal, en betekent juist dat de cocktail goed gekoeld is zonder te verwateren.";

// Gedeeld tussen stap 5 (alcoholische variant) en stap 7 (alcoholvrije
// variant) — glas, garnering, ABV% en bereidingswijze.
export function WizardStepPreparation({
  variant,
  onChange,
}: {
  variant: VariantDraft;
  onChange: (v: VariantDraft) => void;
}) {
  const { data: glassTypes = [] } = useQuery({
    queryKey: ["cocktail_bar", "glass_types"],
    queryFn: fetchCocktailGlassTypes,
  });
  const { data: garnishes = [] } = useQuery({
    queryKey: ["cocktail_bar", "garnishes"],
    queryFn: fetchCocktailGarnishes,
  });

  const hasIceShakeNote = variant.preparationSteps.includes(ICE_SHAKE_NOTE);

  function toggleIceShakeNote(checked: boolean) {
    if (checked) {
      onChange({
        ...variant,
        preparationSteps: variant.preparationSteps
          ? `${variant.preparationSteps}\n\n${ICE_SHAKE_NOTE}`
          : ICE_SHAKE_NOTE,
      });
    } else {
      onChange({
        ...variant,
        preparationSteps: variant.preparationSteps
          .replace(`\n\n${ICE_SHAKE_NOTE}`, "")
          .replace(ICE_SHAKE_NOTE, "")
          .trim(),
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            Glas
          </label>
          <select
            value={variant.glassTypeId ?? ""}
            onChange={(e) =>
              onChange({ ...variant, glassTypeId: e.target.value || null })
            }
            className="w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Kies een glas...</option>
            {glassTypes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <label className="cb-muted flex items-center gap-1 text-xs">
            <Snowflake className="h-3 w-3" /> IJs in dit glas
          </label>
          <input
            value={variant.glassNote}
            onChange={(e) =>
              onChange({ ...variant, glassNote: e.target.value })
            }
            placeholder="bijv. crushed ice / 3 grote ijsblokken / geen ijs"
            className="w-full rounded-lg px-3 py-1.5 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="cb-muted text-xs uppercase tracking-wide">
            2e glas (optioneel)
          </label>
          <select
            value={variant.glassTypeId2 ?? ""}
            onChange={(e) =>
              onChange({ ...variant, glassTypeId2: e.target.value || null })
            }
            className="w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Geen tweede glas</option>
            {glassTypes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <label className="cb-muted flex items-center gap-1 text-xs">
            <Snowflake className="h-3 w-3" /> IJs in dit glas
          </label>
          <input
            value={variant.glassNote2}
            onChange={(e) =>
              onChange({ ...variant, glassNote2: e.target.value })
            }
            placeholder="bijv. crushed ice / 3 grote ijsblokken / geen ijs"
            className="w-full rounded-lg px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Alcoholpercentage
        </label>
        <input
          value={variant.abvPercent}
          onChange={(e) => onChange({ ...variant, abvPercent: e.target.value })}
          inputMode="decimal"
          placeholder="12.5"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Garnering
        </label>
        <datalist id="cocktail-garnish-suggestions">
          {garnishes.map((g) => (
            <option key={g.id} value={g.name} />
          ))}
        </datalist>
        <input
          value={variant.garnishName}
          onChange={(e) =>
            onChange({ ...variant, garnishName: e.target.value })
          }
          list="cocktail-garnish-suggestions"
          placeholder="bijv. Muntblaadje en limoenschijfje"
          className="w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Bereidingswijze
        </label>
        <p className="cb-muted text-xs">
          Ijs tijdens het shaken/roeren hoort hier bij de bereiding — niet bij
          de ingrediënten. Het ijs waarmee je serveert zet je bij "IJs in dit
          glas" hierboven.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasIceShakeNote}
            onChange={(e) => toggleIceShakeNote(e.target.checked)}
            className="h-4 w-4"
          />
          Shaken met ijs om te koelen
        </label>
        <textarea
          value={variant.preparationSteps}
          onChange={(e) =>
            onChange({ ...variant, preparationSteps: e.target.value })
          }
          rows={4}
          placeholder="bijv. Shake alle ingrediënten met 6-8 ijsblokjes gedurende 15 seconden, zeef in het glas..."
          className="w-full resize-none rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
