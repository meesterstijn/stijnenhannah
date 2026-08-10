import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  deleteProductAlias,
  fetchProducts,
  fetchProductVariants,
  updateProductAliasTarget,
  type ProductAlias,
} from "../lib/productMatching";
import { fetchStores } from "../lib/stores";
import { formatVariantLabel } from "../lib/formatters";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Automatische herkenning bewerken (Aliasbeheer v2) — wijzigt UITSLUITEND
// product_aliases.product_id/product_variant_id. Maakt bewust GEEN nieuw
// product/nieuwe variant aan (dat blijft voorbehouden aan de bestaande
// matching-/editflows) en raakt NOOIT shopping_receipt_items — dit is
// beheer van toekomstige automatische herkenning, geen correctie van
// historische aankopen (die blijft EditReceiptItemMatchDialog).
export function EditProductAliasDialog({
  alias,
  open,
  onOpenChange,
}: {
  alias: ProductAlias | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
    enabled: open,
  });
  const { data: existingVariants = [] } = useQuery({
    queryKey: ["product_variants", selectedProductId],
    queryFn: () => fetchProductVariants(selectedProductId),
    enabled: open && !!selectedProductId,
  });

  // Begint bij de huidige aliasdoelkoppeling zodra de dialoog opent voor
  // deze alias — niet bij een keuze uit een vorige open-sessie.
  useEffect(() => {
    if (open && alias) {
      setSelectedProductId(alias.product_id);
      setSelectedVariantId(alias.product_variant_id ?? "");
      setConfirmingDelete(false);
      setError(null);
    }
  }, [open, alias]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!alias) throw new Error("Geen alias geselecteerd.");
      if (!selectedProductId) throw new Error("Kies een product.");
      return updateProductAliasTarget({
        aliasId: alias.id,
        productId: selectedProductId,
        productVariantId: selectedVariantId || null,
      });
    },
    onSuccess: () => {
      // Alleen de alias-lijst zelf verandert — historische receipt_item_
      // prices-data blijft ongewijzigd, dus geen refetch daarvan nodig.
      queryClient.invalidateQueries({ queryKey: ["product_aliases"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!alias) throw new Error("Geen alias geselecteerd.");
      return deleteProductAlias(alias.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_aliases"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!alias) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Automatische herkenning bewerken</DialogTitle>
          <DialogDescription>
            Deze wijziging geldt voor toekomstige automatische herkenning.
            Bestaande kassabonregels worden niet aangepast.
          </DialogDescription>
        </DialogHeader>

        {confirmingDelete ? (
          <>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                Automatische herkenning verwijderen?
              </p>
              <p className="text-muted-foreground">
                Bestaande kassabonregels blijven gekoppeld. Toekomstige
                kassabonregels met de tekst "{alias.raw_alias}" worden niet meer
                automatisch herkend.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteMutation.isPending}
              >
                Annuleer
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="gap-2 bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Verwijderen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Kassabontekst</p>
              <p className="font-medium text-foreground break-words">
                {alias.raw_alias}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Winkel</p>
              <p className="text-foreground break-words">
                {alias.store_name ?? "Onbekende winkel"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Wordt automatisch gekoppeld aan — canoniek product
                </label>
                <select
                  className={selectClassName}
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantId("");
                  }}
                >
                  <option value="">Kies een product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.canonical_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Variant</label>
                <select
                  className={selectClassName}
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  disabled={!selectedProductId}
                >
                  <option value="">Geen variant</option>
                  {existingVariants.map((v) => {
                    const storeName = v.store_id
                      ? (stores.find((s) => s.id === v.store_id)
                          ?.canonical_name ?? "winkelgebonden")
                      : null;
                    return (
                      <option key={v.id} value={v.id}>
                        {formatVariantLabel(v, storeName)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setConfirmingDelete(true);
                }}
                className="text-destructive hover:text-destructive"
              >
                Verwijderen
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuleer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setError(null);
                    saveMutation.mutate();
                  }}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  {saveMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Opslaan
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
