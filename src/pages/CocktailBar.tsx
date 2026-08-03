import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CocktailHero } from "@/features/cocktail-bar/components/CocktailHero";
import { CocktailCard } from "@/features/cocktail-bar/components/CocktailCard";
import { CocktailFilterBar } from "@/features/cocktail-bar/components/CocktailFilterBar";
import { CocktailDetailDialog } from "@/features/cocktail-bar/components/CocktailDetailDialog";
import { useCocktailShowcase } from "@/features/cocktail-bar/hooks/useCocktailShowcase";
import { useCocktailShowcaseRealtimeSync } from "@/features/cocktail-bar/hooks/useCocktailShowcaseRealtimeSync";
import { useCocktailFilters } from "@/features/cocktail-bar/hooks/useCocktailFilters";
import { useCocktailFavorites } from "@/features/cocktail-bar/hooks/useCocktailFavorites";
import type { CocktailFull } from "@/features/cocktail-bar/types";

export default function CocktailBar() {
  useCocktailShowcaseRealtimeSync();
  const { data: cocktails = [], isLoading } = useCocktailShowcase();
  const { isFavorite, toggleFavorite } = useCocktailFavorites();
  const { filters, setFilters, filteredCocktails } = useCocktailFilters(cocktails, isFavorite);
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailFull | null>(null);

  return (
    <div className="space-y-8">
      <CocktailHero />

      <CocktailFilterBar filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="flex justify-center py-16 cb-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredCocktails.length === 0 ? (
        <p className="cb-muted py-16 text-center text-sm">Geen cocktails gevonden.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCocktails.map((cocktail) => (
            <CocktailCard
              key={cocktail.id}
              cocktail={cocktail}
              onSelect={setSelectedCocktail}
              isFavorite={isFavorite(cocktail.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      <CocktailDetailDialog cocktail={selectedCocktail} onClose={() => setSelectedCocktail(null)} />
    </div>
  );
}
