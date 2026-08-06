import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { optimizeGrowthPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";
import {
  createCocktail,
  saveCocktailVariant,
  updateCocktail,
} from "@/features/cocktail-bar/lib/cocktails";
import {
  createGarnish,
  createIngredient,
} from "@/features/cocktail-bar/lib/reference";
import { uploadCocktailPhoto } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { WizardStepBasicInfo } from "@/features/cocktail-bar/components/wizard-steps/WizardStepBasicInfo";
import { WizardStepPhoto } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPhoto";
import { WizardStepFlavourProfile } from "@/features/cocktail-bar/components/wizard-steps/WizardStepFlavourProfile";
import { WizardStepIngredients } from "@/features/cocktail-bar/components/wizard-steps/WizardStepIngredients";
import { WizardStepPreparation } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPreparation";
import { WizardStepBackstory } from "@/features/cocktail-bar/components/wizard-steps/WizardStepBackstory";
import { WizardStepAlcoholFree } from "@/features/cocktail-bar/components/wizard-steps/WizardStepAlcoholFree";
import { WizardStepPreview } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPreview";
import { WizardStepPublish } from "@/features/cocktail-bar/components/wizard-steps/WizardStepPublish";
import type { CocktailFull } from "@/features/cocktail-bar/types";

export type IngredientRowDraft = {
  // Alleen een lokale sleutel om te kunnen verslepen/herordenen (dnd-kit
  // heeft een stabiele id per rij nodig) — heeft niets te maken met het
  // opgeslagen ingredient_id, dat wordt pas bij opslaan via de naam
  // opgezocht/aangemaakt (zie resolveIngredients hieronder).
  id: string;
  name: string;
  amount: string;
  unit: string;
  note: string;
};

export type VariantDraft = {
  glassTypeId: string | null;
  spiritId: string | null;
  garnishName: string;
  abvPercent: string;
  preparationSteps: string;
  sweetScore: number;
  sourScore: number;
  bitterScore: number;
  freshScore: number;
  strongScore: number;
  ingredients: IngredientRowDraft[];
  existingPhotoPath: string | null;
};

export type WizardState = {
  name: string;
  tagline: string;
  backstory: string;
  photoFile: File | null;
  existingPhotoPath: string | null;
  alcoholic: VariantDraft;
  hasAlcoholFree: boolean;
  alcoholFree: VariantDraft;
  isPublished: boolean;
};

export const TOTAL_STEPS = 9;

const STEP_LABELS = [
  "Basisinformatie",
  "Foto",
  "Smaakprofiel",
  "Ingrediënten",
  "Bereiding",
  "Achtergrondverhaal",
  "Alcoholvrije variant",
  "Voorbeeld",
  "Publiceren",
];

function emptyVariant(): VariantDraft {
  return {
    glassTypeId: null,
    spiritId: null,
    garnishName: "",
    abvPercent: "",
    preparationSteps: "",
    sweetScore: 0,
    sourScore: 0,
    bitterScore: 0,
    freshScore: 0,
    strongScore: 0,
    ingredients: [],
    existingPhotoPath: null,
  };
}

function emptyState(): WizardState {
  return {
    name: "",
    tagline: "",
    backstory: "",
    photoFile: null,
    existingPhotoPath: null,
    alcoholic: emptyVariant(),
    hasAlcoholFree: false,
    alcoholFree: emptyVariant(),
    isPublished: false,
  };
}

function variantFromCocktail(
  cocktail: CocktailFull,
  type: "alcoholic" | "alcohol_free",
): VariantDraft {
  const v = cocktail.variants.find((variant) => variant.variant_type === type);
  if (!v) return emptyVariant();
  return {
    glassTypeId: v.glass_type_id,
    spiritId: v.spirit_id,
    garnishName: v.garnish?.name ?? "",
    abvPercent: String(v.abv_percent),
    preparationSteps: v.preparation_steps,
    sweetScore: v.flavour_profile?.sweet_score ?? 0,
    sourScore: v.flavour_profile?.sour_score ?? 0,
    bitterScore: v.flavour_profile?.bitter_score ?? 0,
    freshScore: v.flavour_profile?.fresh_score ?? 0,
    strongScore: v.flavour_profile?.strong_score ?? 0,
    ingredients: v.ingredients.map((i) => ({
      id: crypto.randomUUID(),
      name: i.ingredient_name,
      amount: String(i.amount),
      unit: i.unit,
      note: i.note ?? "",
    })),
    existingPhotoPath: v.photo_storage_path,
  };
}

function stateFromCocktail(cocktail: CocktailFull): WizardState {
  return {
    name: cocktail.name,
    tagline: cocktail.tagline,
    backstory: cocktail.backstory ?? "",
    photoFile: null,
    existingPhotoPath: cocktail.photo_storage_path,
    alcoholic: variantFromCocktail(cocktail, "alcoholic"),
    hasAlcoholFree: cocktail.variants.some(
      (v) => v.variant_type === "alcohol_free",
    ),
    alcoholFree: variantFromCocktail(cocktail, "alcohol_free"),
    isPublished: cocktail.is_published,
  };
}

// Eén ingredientnaam -> ingredient_id opzoeken/aanmaken (createIngredient
// doet zelf al "maak aan, of geef de bestaande terug" bij een botsende CI-
// unique naam, zie lib/reference.ts) en de rij omzetten naar het formaat dat
// saveCocktailVariant/de RPC verwacht. Een helemaal leeg tussenrijtje (net
// met "Ingrediënt toevoegen" aangemaakt, nog niks ingevuld) wordt stilzwijgend
// overgeslagen — maar een rij mét naam en een hoeveelheid die niet als getal
// leesbaar is (bv. "60/90" i.p.v. "60") gooit nu een duidelijke foutmelding
// i.p.v. diezelfde rij stilzwijgend te laten verdwijnen bij het opslaan.
async function resolveIngredients(rows: IngredientRowDraft[]) {
  const resolved: {
    ingredientId: string;
    amount: number;
    unit: string;
    note: string | null;
    sortOrder: number;
  }[] = [];
  let sortOrder = 0;
  for (const row of rows) {
    const name = row.name.trim();
    const unit = row.unit.trim();
    if (!name && !row.amount.trim() && !unit) continue;

    if (!name) {
      throw new Error(
        `Ingrediëntregel met hoeveelheid "${row.amount}" heeft geen naam.`,
      );
    }
    const amount = Number(row.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `Ongeldige hoeveelheid bij "${name}": "${row.amount}". Gebruik een getal, bijvoorbeeld 60 of 12,5.`,
      );
    }
    if (!unit) {
      throw new Error(`Geen eenheid ingevuld bij "${name}".`);
    }

    const ingredient = await createIngredient(name, unit);
    resolved.push({
      ingredientId: ingredient.id,
      amount,
      unit,
      note: row.note.trim() || null,
      sortOrder: sortOrder++,
    });
  }
  return resolved;
}

/**
 * Eén component beheert alle stapstate lokaal (mirrort R6NewSessionWizard) —
 * geen per-stap routing, geen React Query voor het concept-formulier zelf
 * (dat is nooit servergestuurde state totdat er daadwerkelijk op "Opslaan"
 * wordt gedrukt). Nieuw ÉN bewerken lopen door dezelfde component: bij
 * bewerken wordt de state voorgevuld vanuit de al opgehaalde CocktailFull.
 */
export function CocktailWizard({
  existingCocktail,
}: {
  existingCocktail: CocktailFull | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() =>
    existingCocktail ? stateFromCocktail(existingCocktail) : emptyState(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (existingCocktail) setState(stateFromCocktail(existingCocktail));
  }, [existingCocktail]);

  // Basisdrank is bewust optioneel: de owner kan een nieuwe cocktail
  // aanmaken en de basisdrank later toevoegen (bv. als de gewenste drank nog
  // niet in de catalogus staat) — zie 20260821000000_cocktail_bar_amaretto_and_optional_spirit.sql.
  const canProceedFromBasicInfo =
    state.name.trim().length > 0 && state.tagline.trim().length > 0;

  async function handleSave(publish: boolean) {
    setIsSaving(true);
    setSaveError(null);
    try {
      let cocktailId = existingCocktail?.id ?? null;
      let photoStoragePath = state.existingPhotoPath;

      if (state.photoFile) {
        // De cocktail-rij moet al bestaan vóórdat de foto geüpload wordt —
        // het Storage-pad is <cocktail_id>/<uuid>.<ext> (zie de RLS-policy in
        // 20260818040000_cocktail_bar_photos_storage.sql, die het eerste
        // padsegment tegen een bestaande cocktails-rij controleert).
        if (!cocktailId) {
          const created = await createCocktail({
            name: state.name.trim(),
            tagline: state.tagline.trim(),
            backstory: state.backstory.trim() || null,
          });
          cocktailId = created.id;
        }
        const optimized = await optimizeGrowthPhoto(state.photoFile);
        const uploaded = await uploadCocktailPhoto(cocktailId, optimized);
        photoStoragePath = uploaded.storagePath;
      }

      if (!cocktailId) {
        const created = await createCocktail({
          name: state.name.trim(),
          tagline: state.tagline.trim(),
          backstory: state.backstory.trim() || null,
        });
        cocktailId = created.id;
      } else {
        await updateCocktail(cocktailId, {
          name: state.name.trim(),
          tagline: state.tagline.trim(),
          backstory: state.backstory.trim() || null,
          photo_storage_path: photoStoragePath,
        });
      }

      const alcoholicGarnish = state.alcoholic.garnishName.trim()
        ? await createGarnish(state.alcoholic.garnishName)
        : null;
      const alcoholicIngredients = await resolveIngredients(
        state.alcoholic.ingredients,
      );
      await saveCocktailVariant({
        cocktailId,
        variantType: "alcoholic",
        glassTypeId: state.alcoholic.glassTypeId,
        spiritId: state.alcoholic.spiritId,
        garnishId: alcoholicGarnish?.id ?? null,
        abvPercent: Number(state.alcoholic.abvPercent.replace(",", ".")) || 0,
        preparationSteps: state.alcoholic.preparationSteps.trim(),
        photoStoragePath: state.alcoholic.existingPhotoPath,
        sweetScore: state.alcoholic.sweetScore,
        sourScore: state.alcoholic.sourScore,
        bitterScore: state.alcoholic.bitterScore,
        freshScore: state.alcoholic.freshScore,
        strongScore: state.alcoholic.strongScore,
        ingredients: alcoholicIngredients,
      });

      if (state.hasAlcoholFree) {
        const alcoholFreeGarnish = state.alcoholFree.garnishName.trim()
          ? await createGarnish(state.alcoholFree.garnishName)
          : null;
        const alcoholFreeIngredients = await resolveIngredients(
          state.alcoholFree.ingredients,
        );
        await saveCocktailVariant({
          cocktailId,
          variantType: "alcohol_free",
          glassTypeId: state.alcoholFree.glassTypeId,
          spiritId: null,
          garnishId: alcoholFreeGarnish?.id ?? null,
          abvPercent: 0,
          preparationSteps: state.alcoholFree.preparationSteps.trim(),
          photoStoragePath: state.alcoholFree.existingPhotoPath,
          sweetScore: state.alcoholFree.sweetScore,
          sourScore: state.alcoholFree.sourScore,
          bitterScore: state.alcoholFree.bitterScore,
          freshScore: state.alcoholFree.freshScore,
          strongScore: state.alcoholFree.strongScore,
          ingredients: alcoholFreeIngredients,
        });
      }

      await updateCocktail(cocktailId, { is_published: publish });

      // Zonder dit blijven de Beheer-lijst, de showcase/Tabletmodus én dit
      // cocktail-detail (bij opnieuw bewerken) de oude, gecachte waarden
      // tonen totdat er toevallig ergens anders al een refetch gebeurt —
      // andere mutaties in de app (bv. CocktailBarAdmin.tsx) invalideren wel
      // altijd expliciet, dit deed het nog niet.
      queryClient.invalidateQueries({
        queryKey: ["cocktail_bar", "cocktails", "all"],
      });
      queryClient.invalidateQueries({
        queryKey: ["cocktail_bar", "cocktails", "published_full"],
      });
      queryClient.invalidateQueries({
        queryKey: ["cocktail_bar", "cocktail", cocktailId],
      });

      navigate("/cocktail-bar/beheren");
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Opslaan mislukt. Probeer het opnieuw.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return <WizardStepBasicInfo state={state} setState={setState} />;
      case 2:
        return <WizardStepPhoto state={state} setState={setState} />;
      case 3:
        return (
          <WizardStepFlavourProfile
            variant={state.alcoholic}
            onChange={(v) => setState((s) => ({ ...s, alcoholic: v }))}
          />
        );
      case 4:
        return (
          <WizardStepIngredients
            variant={state.alcoholic}
            onChange={(v) => setState((s) => ({ ...s, alcoholic: v }))}
          />
        );
      case 5:
        return (
          <WizardStepPreparation
            variant={state.alcoholic}
            onChange={(v) => setState((s) => ({ ...s, alcoholic: v }))}
          />
        );
      case 6:
        return <WizardStepBackstory state={state} setState={setState} />;
      case 7:
        return <WizardStepAlcoholFree state={state} setState={setState} />;
      case 8:
        return <WizardStepPreview state={state} />;
      case 9:
        return <WizardStepPublish state={state} setState={setState} />;
      default:
        return null;
    }
  }

  return (
    <div className="cb-tile space-y-6 p-6">
      <div>
        <p className="cb-muted text-xs uppercase tracking-wide">
          Stap {step} van {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
        </p>
        <h1 className="cb-heading font-serif text-3xl">
          {existingCocktail ? "Cocktail bewerken" : "Nieuwe cocktail"}
        </h1>
      </div>

      {renderStep()}

      {saveError && <p className="text-sm text-red-400">{saveError}</p>}

      <div className="flex items-center justify-between gap-2 pt-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || isSaving}
          className="cb-button-ghost rounded-full px-4 py-2 text-sm disabled:opacity-40"
        >
          Terug
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
            disabled={step === 1 && !canProceedFromBasicInfo}
            className="cb-button rounded-full px-5 py-2 text-sm disabled:opacity-40"
          >
            Volgende
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="cb-button-ghost flex items-center gap-2 rounded-full px-4 py-2 text-sm"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Concept
              opslaan
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="cb-button flex items-center gap-2 rounded-full px-5 py-2 text-sm"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
              Publiceren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
