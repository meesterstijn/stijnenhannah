import { useQuery } from "@tanstack/react-query";
import { Snowflake } from "lucide-react";
import {
  fetchCocktailGarnishes,
  fetchCocktailGlassTypes,
} from "@/features/cocktail-bar/lib/reference";
import type { VariantDraft } from "@/features/cocktail-bar/components/CocktailWizard";

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
          Bouwmethode
        </label>
        <p className="cb-muted text-xs">
          Los van elkaar aan te zetten, allemaal optioneel — puur zodat je in
          Bereiden meteen ziet hoe je de cocktail opbouwt.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={variant.shakeWithIce}
              onChange={(e) =>
                onChange({ ...variant, shakeWithIce: e.target.checked })
              }
              className="h-4 w-4"
            />
            Shaken met ijs om te koelen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={variant.dryShakeFirst}
              onChange={(e) =>
                onChange({ ...variant, dryShakeFirst: e.target.checked })
              }
              className="h-4 w-4"
            />
            Dry shake eerst
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={variant.buildInGlass}
              onChange={(e) =>
                onChange({ ...variant, buildInGlass: e.target.checked })
              }
              className="h-4 w-4"
            />
            Build
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="cb-muted text-xs uppercase tracking-wide">
          Bereidingswijze
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
