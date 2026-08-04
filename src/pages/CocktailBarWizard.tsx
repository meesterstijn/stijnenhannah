import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { CocktailWizard } from "@/features/cocktail-bar/components/CocktailWizard";
import { useCocktailDetail } from "@/features/cocktail-bar/hooks/useCocktailDetail";

// /cocktail-bar/beheren/nieuw (geen :id) of /cocktail-bar/beheren/:id
// (bewerken) — beide lopen door dezelfde CocktailWizard, alleen met of
// zonder een al opgehaalde bestaande cocktail.
export default function CocktailBarWizard() {
  const { id } = useParams<{ id?: string }>();
  const { data: existingCocktail, isLoading } = useCocktailDetail(id ?? null);

  if (id && isLoading) {
    return (
      <div className="flex justify-center py-16 cb-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return <CocktailWizard existingCocktail={existingCocktail ?? null} />;
}
