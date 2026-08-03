import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fetchAllCocktails } from "@/features/cocktail-bar/lib/cocktails";

// Fase 1: kale lijst zonder bewerken/verwijderen/publiceren/wizard — dat komt
// in fase 4 (zie het Cocktail Bar-implementatieplan §9). Doel van deze
// pagina nu is puur bevestigen dat de rol-plumbing/routing/RLS/seed-data
// werken vóórdat er visueel op voortgebouwd wordt.
export default function CocktailBarAdmin() {
  const { data: cocktails = [], isLoading } = useQuery({
    queryKey: ["cocktail_bar", "cocktails", "all"],
    queryFn: fetchAllCocktails,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Cocktails beheren</h1>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : cocktails.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen cocktails.</p>
      ) : (
        <ul className="space-y-2">
          {cocktails.map((cocktail) => (
            <li key={cocktail.id} className="rounded-lg border p-3">
              <p className="font-medium">{cocktail.name}</p>
              <p className="text-sm text-muted-foreground">{cocktail.tagline}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {cocktail.is_published ? "Gepubliceerd" : "Concept"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
