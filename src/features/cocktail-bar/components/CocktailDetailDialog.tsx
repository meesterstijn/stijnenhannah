import { useEffect, useState } from "react";
import { GlassWater, Percent, Sparkles, BookOpen, Martini } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCocktailPhotoUrl } from "@/features/cocktail-bar/lib/cocktailPhotoStorage";
import { deriveFlavourBadges } from "@/features/cocktail-bar/lib/flavourBadges";
import { CocktailFlavourBadge } from "@/features/cocktail-bar/components/CocktailFlavourBadge";
import { CocktailFlavourProfileChart } from "@/features/cocktail-bar/components/CocktailFlavourProfileChart";
import { CocktailIngredientList } from "@/features/cocktail-bar/components/CocktailIngredientList";
import { CocktailAddToGroceryListButton } from "@/features/cocktail-bar/components/CocktailAddToGroceryListButton";
import { CocktailOrderForm } from "@/features/cocktail-bar/components/CocktailOrderForm";
import type {
  CocktailFull,
  CocktailVariantFull,
  CocktailVariantType,
} from "@/features/cocktail-bar/types";

// Neemt de al opgehaalde CocktailFull-data als prop aan i.p.v. zelf opnieuw
// te fetchen (useCocktailDetail.ts blijft beschikbaar voor plekken die een
// los cocktailId hebben zonder al de volledige lijst in geheugen — bv. de
// Bereiden-wachtrij in een latere fase) — hier zou dat een overbodige tweede
// netwerkaanvraag zijn van data die de showcase al heeft.
//
// mode="guest" (Tabletmodus, fase 5): toont alleen foto/naam/omschrijving/
// ingrediënten/smaakprofiel en een bestelformulier — GEEN ABV/glas/garnering/
// bereidingswijze/achtergrondverhaal/boodschappenlijst (die zijn beheer- of
// receptinformatie, niet voor gasten bedoeld).
export function CocktailDetailDialog({
  cocktail,
  onClose,
  mode = "full",
  initialVariantType,
}: {
  cocktail: CocktailFull | null;
  onClose: () => void;
  mode?: "full" | "guest";
  // Bereiden (fase 6) geeft hier de daadwerkelijk bestelde variant door, zodat
  // een klik op een alcoholvrije bestelling meteen die variant opent i.p.v.
  // altijd op "Origineel" te beginnen. Zonder deze prop (showcase/tablet) is
  // "Origineel" altijd het startpunt — ook nadat een vorige keer bewust
  // Alcoholvrij gekozen was, want dat mag niet blijven "plakken" op de
  // volgende geopende cocktail.
  initialVariantType?: CocktailVariantType;
}) {
  const [variantType, setVariantType] = useState<CocktailVariantType>(
    initialVariantType ?? "alcoholic",
  );

  useEffect(() => {
    setVariantType(initialVariantType ?? "alcoholic");
  }, [cocktail?.id, initialVariantType]);

  // Vaste volgorde/labels, elk optioneel — alcoholic_variant ("Variant") is
  // een derde, optioneel slot naast Origineel/Alcoholvrij, zie
  // 20260823000000_cocktail_bar_variant_2.sql.
  const VARIANT_ORDER: { type: CocktailVariantType; label: string }[] = [
    { type: "alcoholic", label: "Origineel" },
    { type: "alcoholic_variant", label: "Variant" },
    { type: "alcohol_free", label: "Alcoholvrije variant" },
  ];
  const availableVariants: {
    type: CocktailVariantType;
    label: string;
    data: CocktailVariantFull;
  }[] = cocktail
    ? VARIANT_ORDER.flatMap((entry) => {
        const data = cocktail.variants.find(
          (v) => v.variant_type === entry.type,
        );
        return data ? [{ ...entry, data }] : [];
      })
    : [];

  const activeVariant: CocktailVariantFull | null =
    availableVariants.find((v) => v.type === variantType)?.data ??
    availableVariants[0]?.data ??
    null;

  const photoPath =
    activeVariant?.photo_storage_path ?? cocktail?.photo_storage_path ?? null;
  const photoUrl = photoPath ? getCocktailPhotoUrl(photoPath) : null;
  const badges = deriveFlavourBadges(activeVariant?.flavour_profile ?? null);

  return (
    <Dialog open={!!cocktail} onOpenChange={(open) => !open && onClose()}>
      {cocktail && activeVariant && (
        <DialogContent className="cocktail-theme cb-dialog w-full max-w-3xl max-h-[90vh] sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle asChild>
              <h2 className="cb-heading font-serif text-3xl sm:text-4xl">
                {cocktail.name}
              </h2>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="relative flex h-56 w-full items-center justify-center rounded-2xl sm:h-72">
              <div className="cb-product-glow absolute inset-8 rounded-full blur-2xl" />
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={cocktail.name}
                  className="relative h-full w-full object-contain"
                />
              ) : (
                <Martini
                  className="relative h-20 w-20 text-[var(--cb-gold)] opacity-50"
                  strokeWidth={1.2}
                />
              )}
            </div>

            <p className="cb-muted text-base">{cocktail.tagline}</p>

            {availableVariants.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {availableVariants.map((v) => (
                  <button
                    key={v.type}
                    type="button"
                    onClick={() => setVariantType(v.type)}
                    className={`rounded-full px-4 py-1.5 text-sm ${variantType === v.type ? "cb-button" : "cb-button-ghost"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <span className="cb-badge">
                {activeVariant.variant_type === "alcohol_free"
                  ? "Alcoholvrij"
                  : (activeVariant.spirit?.name ?? "Onbekend")}
              </span>
              {badges.map((b) => (
                <CocktailFlavourBadge key={b.code} badge={b} showScore />
              ))}
            </div>

            {mode === "full" && (
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 shrink-0 cb-muted" />
                  <span>{activeVariant.abv_percent}% alcohol</span>
                </div>
                {activeVariant.glass_type && (
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 shrink-0 cb-muted" />
                    <span>
                      {activeVariant.glass_type.name}
                      {activeVariant.glass_note && (
                        <span className="cb-muted">
                          {" "}
                          ({activeVariant.glass_note})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {activeVariant.glass_type_2 && (
                  <div className="flex items-center gap-2">
                    <GlassWater className="h-4 w-4 shrink-0 cb-muted" />
                    <span>
                      {activeVariant.glass_type_2.name}
                      {activeVariant.glass_note_2 && (
                        <span className="cb-muted">
                          {" "}
                          ({activeVariant.glass_note_2})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {activeVariant.garnish && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 cb-muted" />
                    <span>{activeVariant.garnish.name}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="cb-heading mb-2 text-lg">Smaakprofiel</h3>
              <CocktailFlavourProfileChart
                profile={activeVariant.flavour_profile}
              />
            </div>

            <div className="space-y-3">
              <h3 className="cb-heading mb-2 text-lg">Ingrediënten</h3>
              <CocktailIngredientList ingredients={activeVariant.ingredients} />
              {mode === "full" && (
                <CocktailAddToGroceryListButton
                  ingredients={activeVariant.ingredients}
                />
              )}
            </div>

            {mode === "full" && (
              <>
                <div>
                  <h3 className="cb-heading mb-2 text-lg">Bereiding</h3>
                  <p className="text-sm leading-relaxed">
                    {activeVariant.preparation_steps}
                  </p>
                </div>

                {cocktail.backstory && (
                  <div>
                    <h3 className="cb-heading mb-2 flex items-center gap-2 text-lg">
                      <BookOpen className="h-4 w-4" /> Achtergrondverhaal
                    </h3>
                    <p className="cb-muted text-sm leading-relaxed">
                      {cocktail.backstory}
                    </p>
                  </div>
                )}
              </>
            )}

            {mode === "guest" && (
              <div>
                <h3 className="cb-heading mb-2 text-lg">Bestellen</h3>
                <CocktailOrderForm
                  cocktailId={cocktail.id}
                  variantId={activeVariant.id}
                  cocktailName={cocktail.name}
                  onOrdered={onClose}
                />
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
