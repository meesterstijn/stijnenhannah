import { Martini } from "lucide-react";
import { CocktailFlavourBadge } from "@/features/cocktail-bar/components/CocktailFlavourBadge";
import { CocktailFlavourProfileChart } from "@/features/cocktail-bar/components/CocktailFlavourProfileChart";
import { CocktailIngredientList } from "@/features/cocktail-bar/components/CocktailIngredientList";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import type {
  VariantDraft,
  WizardState,
} from "@/features/cocktail-bar/components/CocktailWizard";
import type {
  CocktailFlavourProfile,
  CocktailVariantIngredientWithName,
} from "@/features/cocktail-bar/types";

// Hergebruikt dezelfde weergavecomponenten als de showcase/het detailvenster
// — geen aparte "preview-look" die uit de pas kan gaan lopen met hoe het er
// straks écht uitziet. De draft-state wordt hiervoor omgezet naar dezelfde
// vorm als de echte database-types verwachten (met wat placeholder-ID's,
// puur omdat die componenten nu eenmaal die vorm typeren).
function toPreviewFlavourProfile(
  variant: VariantDraft,
): CocktailFlavourProfile {
  return {
    variant_id: "preview",
    sweet_score: variant.sweetScore,
    sour_score: variant.sourScore,
    bitter_score: variant.bitterScore,
    fresh_score: variant.freshScore,
    strong_score: variant.strongScore,
    updated_at: "",
  };
}

function toPreviewIngredients(
  variant: VariantDraft,
): CocktailVariantIngredientWithName[] {
  return variant.ingredients
    .filter((row) => row.name.trim() && row.amount.trim())
    .map((row, index) => ({
      id: `preview-${index}`,
      variant_id: "preview",
      ingredient_id: "preview",
      amount: Number(row.amount.replace(",", ".")) || 0,
      unit: row.unit,
      note: row.note || null,
      sort_order: index,
      ingredient_name: row.name,
    }));
}

export function WizardStepPreview({ state }: { state: WizardState }) {
  const profile = toPreviewFlavourProfile(state.alcoholic);
  const badges = deriveFlavourBadges(profile);
  const previewUrl = state.photoFile
    ? URL.createObjectURL(state.photoFile)
    : null;

  return (
    <div className="cb-tile space-y-4 p-4">
      <div className="relative flex h-48 items-center justify-center rounded-2xl">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={state.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <Martini
            className="h-16 w-16 text-[var(--cb-gold)] opacity-50"
            strokeWidth={1.2}
          />
        )}
      </div>

      <h3 className="cb-heading font-serif text-2xl">
        {state.name || "(nog geen naam)"}
      </h3>
      <p className="cb-muted text-sm">
        {state.tagline || "(nog geen smaakomschrijving)"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <CocktailFlavourBadge key={b.code} badge={b} showScore />
        ))}
      </div>

      <div>
        <h4 className="cb-heading mb-2 text-base">Smaakprofiel</h4>
        <CocktailFlavourProfileChart profile={profile} />
      </div>

      <div>
        <h4 className="cb-heading mb-2 text-base">Ingrediënten</h4>
        <CocktailIngredientList
          ingredients={toPreviewIngredients(state.alcoholic)}
        />
      </div>

      {state.alcoholic.preparationSteps && (
        <div>
          <h4 className="cb-heading mb-2 text-base">Bereiding</h4>
          <p className="text-sm leading-relaxed">
            {state.alcoholic.preparationSteps}
          </p>
        </div>
      )}

      {state.backstory && (
        <div>
          <h4 className="cb-heading mb-2 text-base">Achtergrondverhaal</h4>
          <p className="cb-muted text-sm leading-relaxed">{state.backstory}</p>
        </div>
      )}

      {state.hasVariant2 && (
        <p className="cb-muted text-sm">✓ Heeft ook een tweede variant</p>
      )}
      {state.hasAlcoholFree && (
        <p className="cb-muted text-sm">✓ Heeft ook een alcoholvrije variant</p>
      )}
    </div>
  );
}
