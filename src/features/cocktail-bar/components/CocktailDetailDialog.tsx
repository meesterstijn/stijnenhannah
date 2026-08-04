import { useState } from "react";
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
}: {
  cocktail: CocktailFull | null;
  onClose: () => void;
  mode?: "full" | "guest";
}) {
  const [variantType, setVariantType] = useState<"alcoholic" | "alcohol_free">(
    "alcoholic",
  );

  const alcoholicVariant =
    cocktail?.variants.find((v) => v.variant_type === "alcoholic") ?? null;
  const alcoholFreeVariant =
    cocktail?.variants.find((v) => v.variant_type === "alcohol_free") ?? null;
  const activeVariant: CocktailVariantFull | null =
    (variantType === "alcoholic" ? alcoholicVariant : alcoholFreeVariant) ??
    alcoholicVariant ??
    alcoholFreeVariant;

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

            {alcoholicVariant && alcoholFreeVariant && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setVariantType("alcoholic")}
                  className={`rounded-full px-4 py-1.5 text-sm ${variantType === "alcoholic" ? "cb-button" : "cb-button-ghost"}`}
                >
                  Origineel
                </button>
                <button
                  type="button"
                  onClick={() => setVariantType("alcohol_free")}
                  className={`rounded-full px-4 py-1.5 text-sm ${variantType === "alcohol_free" ? "cb-button" : "cb-button-ghost"}`}
                >
                  Alcoholvrije variant
                </button>
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
                    <span>{activeVariant.glass_type.name}</span>
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
                />
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
