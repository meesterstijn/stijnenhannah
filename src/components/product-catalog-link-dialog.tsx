import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Search } from "lucide-react";
import { fetchProducts } from "@/features/receipts/lib/productMatching";
import { updateProductAssignmentCanonicalProduct } from "@/lib/categories";

// Koppelt een boodschappenproduct (product_assignments.product) aan een
// CANONIEK product (products.id) — nooit aan een product_variants-rij. Dit
// is bewust read-only/selecteerbaar richting de productcatalogus: geen
// nieuw product/variant aanmaken, geen naam/comparison_unit wijzigen, dat
// blijft voorbehouden aan de bestaande kassabon-catalogusbeheerflows.
export function ProductCatalogLinkDialog({
  open,
  onOpenChange,
  product,
  currentCanonicalProductId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: string;
  currentCanonicalProductId: string | null;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ["products"] is dezelfde querykey als de kassabon-catalogusdialogen
  // (EditProductAliasDialog e.a.) al gebruiken — gedeelde React Query-cache,
  // geen tweede fetch-implementatie.
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });

  // Bij elke keer openen opnieuw vanuit de actuele koppeling beginnen — een
  // vorige zoekopdracht/selectie van een ander boodschappenproduct mag nooit
  // blijven "plakken".
  useEffect(() => {
    if (open) {
      setSelectedId(currentCanonicalProductId);
      setQuery("");
      setError(null);
    }
  }, [open, currentCanonicalProductId]);

  const sorted = useMemo(
    () =>
      [...products].sort((a, b) =>
        a.canonical_name.localeCompare(b.canonical_name, "nl"),
      ),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.canonical_name.toLowerCase().includes(q));
  }, [sorted, query]);

  // Alleen een klikbare suggestie tonen bij een exacte (case-insensitive)
  // naammatch, en alleen als die eenduidig is (precies één kandidaat) — nooit
  // automatisch opgeslagen, nooit fuzzy.
  const exactSuggestion = useMemo(() => {
    const matches = sorted.filter(
      (p) => p.canonical_name.toLowerCase() === product.toLowerCase(),
    );
    return matches.length === 1 ? matches[0] : null;
  }, [sorted, product]);

  const saveMutation = useMutation({
    mutationFn: (canonicalProductId: string | null) =>
      updateProductAssignmentCanonicalProduct(product, canonicalProductId),
    onSuccess: () => {
      // Alleen de koppel-query zelf verandert. GEEN receipt_item_prices/
      // shopping_receipts/product_aliases invalideren — die data verandert
      // hier niet.
      queryClient.invalidateQueries({
        queryKey: ["product_assignment_catalog_links"],
      });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saveMutation.isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Koppel aan productcatalogus</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Boodschappenproduct</p>
          <p className="font-medium text-foreground break-words">{product}</p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek canoniek product..."
              autoFocus
              className="w-full rounded-lg border border-border/70 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>

          {exactSuggestion && exactSuggestion.id !== selectedId && (
            <button
              type="button"
              onClick={() => setSelectedId(exactSuggestion.id)}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Suggestie: {exactSuggestion.canonical_name}
            </button>
          )}

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Geen canonieke producten gevonden.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedId === p.id
                      ? "bg-foreground/5 font-medium"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <span className="truncate">{p.canonical_name}</span>
                  {selectedId === p.id && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          {currentCanonicalProductId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                saveMutation.mutate(null);
              }}
              disabled={saveMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              Koppeling verwijderen
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() => {
                setError(null);
                saveMutation.mutate(selectedId);
              }}
              disabled={!selectedId || saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Opslaan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
