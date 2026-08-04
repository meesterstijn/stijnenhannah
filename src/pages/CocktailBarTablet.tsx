import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CocktailHero } from "@/features/cocktail-bar/components/CocktailHero";
import { CocktailCard } from "@/features/cocktail-bar/components/CocktailCard";
import { CocktailDetailDialog } from "@/features/cocktail-bar/components/CocktailDetailDialog";
import { useCocktailShowcase } from "@/features/cocktail-bar/hooks/useCocktailShowcase";
import { useCocktailShowcaseRealtimeSync } from "@/features/cocktail-bar/hooks/useCocktailShowcaseRealtimeSync";
import type { CocktailFull } from "@/features/cocktail-bar/types";

// Buiten SiteLayout (net als de R6 Big Screen/Controller-routes): geen
// navbar, geen "Ons Huisje", geen filters/favorieten/sorteren/zoeken — de
// cocktail_guest-rol zit hier vast (zie RequireAppAccess.tsx) en mag alleen
// bekijken + bestellen, dus het thema wordt hier zelf toegepast i.p.v. via
// site-layout.tsx.
export default function CocktailBarTablet() {
  useCocktailShowcaseRealtimeSync();
  const { data: cocktails = [], isLoading } = useCocktailShowcase();
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailFull | null>(
    null,
  );

  return (
    <div className="cocktail-theme min-h-screen px-4 pb-12 pt-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <CocktailHero />

        {isLoading ? (
          <div className="flex justify-center py-16 cb-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : cocktails.length === 0 ? (
          <p className="cb-muted py-16 text-center text-sm">
            Nog geen cocktails beschikbaar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cocktails.map((cocktail) => (
              <CocktailCard
                key={cocktail.id}
                cocktail={cocktail}
                onSelect={setSelectedCocktail}
              />
            ))}
          </div>
        )}

        <CocktailDetailDialog
          cocktail={selectedCocktail}
          onClose={() => setSelectedCocktail(null)}
          mode="guest"
        />
      </div>
    </div>
  );
}
