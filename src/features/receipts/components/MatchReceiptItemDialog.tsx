import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { getCategories } from "@/lib/categories";
import {
  COMPARISON_UNITS,
  createProduct,
  createProductVariant,
  fetchProducts,
  confirmReceiptItemMatch,
  type ComparisonUnit,
  type MatchMethod,
} from "../lib/productMatching";
import { fetchStores } from "../lib/stores";
import type { UnmatchedReceiptItem } from "../lib/productMatching";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Handmatige koppel-flow voor één onbekende kassabonregel (zie
// UnmatchedProductsSheet). Twee modi — bestaand product kiezen, of een nieuw
// product aanmaken — met optioneel daarbovenop een nieuwe variant. Hints uit
// de bon worden hier bewust nergens automatisch overgenomen: elk veld is een
// bewuste keuze van de gebruiker (zie ontwerpprincipe "raw data is leidend,
// hints zijn nooit autoritatief").
export function MatchReceiptItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: UnmatchedReceiptItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [newProductComparisonUnit, setNewProductComparisonUnit] =
    useState<ComparisonUnit>("piece");
  const [wantVariant, setWantVariant] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantBrand, setVariantBrand] = useState("");
  const [variantStoreId, setVariantStoreId] = useState(
    item.receipt_store_id ?? "",
  );
  const [variantPackageSize, setVariantPackageSize] = useState("");
  const [variantPackageUnit, setVariantPackageUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: getCategories,
    enabled: open,
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
    enabled: open,
  });

  const storeMissing = !item.receipt_store_id;

  const confirmMutation = useMutation({
    mutationFn: async () => {
      let productId = selectedProductId;
      let matchMethod: MatchMethod = "manual";

      if (mode === "new") {
        if (!newProductName.trim())
          throw new Error("Vul een naam voor het nieuwe product in.");
        const product = await createProduct({
          canonicalName: newProductName,
          categoryId: newProductCategoryId || null,
          comparisonUnit: newProductComparisonUnit,
        });
        productId = product.id;
        matchMethod = "new_product";
      } else if (!productId) {
        throw new Error("Kies een bestaand product.");
      }

      let productVariantId: string | null = null;
      if (wantVariant) {
        if (!variantName.trim())
          throw new Error("Vul een naam voor de nieuwe variant in.");
        const variant = await createProductVariant({
          productId,
          variantName,
          brand: variantBrand.trim() || null,
          storeId: variantStoreId || null,
          packageSize: variantPackageSize ? Number(variantPackageSize) : null,
          packageUnit: variantPackageUnit || null,
        });
        productVariantId = variant.id;
        matchMethod = "new_variant";
      }

      await confirmReceiptItemMatch({
        receiptItemId: item.id,
        productId,
        productVariantId,
        matchMethod,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["receipt_items", "unmatched"],
      });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Koppelen: {item.raw_name}</DialogTitle>
          <DialogDescription>
            Kies een bestaand product of maak een nieuw product aan.
          </DialogDescription>
        </DialogHeader>

        {storeMissing && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5">
            De winkel van deze kassabon is nog niet gekoppeld — koppel eerst de
            winkel (zie boven in de lijst) voordat je deze regel kunt koppelen.
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("existing")}
          >
            Bestaand product
          </Button>
          <Button
            type="button"
            variant={mode === "new" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("new")}
          >
            Nieuw product
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Product</label>
            <select
              className={selectClassName}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Kies een product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonical_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Naam</label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="bijv. Bimi"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Categorie (optioneel)
                </label>
                <select
                  className={selectClassName}
                  value={newProductCategoryId}
                  onChange={(e) => setNewProductCategoryId(e.target.value)}
                >
                  <option value="">Geen categorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Vergelijkeenheid
                </label>
                <select
                  className={selectClassName}
                  value={newProductComparisonUnit}
                  onChange={(e) =>
                    setNewProductComparisonUnit(
                      e.target.value as ComparisonUnit,
                    )
                  }
                >
                  {COMPARISON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={wantVariant}
            onChange={(e) => setWantVariant(e.target.checked)}
            className="h-4 w-4"
          />
          Ook een specifieke variant vastleggen (optioneel)
        </label>

        {wantVariant && (
          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Variantnaam
              </label>
              <Input
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="bijv. AH Bimi 200 g"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Merk (optioneel)
                </label>
                <Input
                  value={variantBrand}
                  onChange={(e) => setVariantBrand(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Huismerk van winkel (optioneel)
                </label>
                <select
                  className={selectClassName}
                  value={variantStoreId}
                  onChange={(e) => setVariantStoreId(e.target.value)}
                >
                  <option value="">Geen (generiek merk)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.canonical_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Verpakkingsgrootte (optioneel — alleen als echt bekend)
                </label>
                <Input
                  type="number"
                  step="any"
                  value={variantPackageSize}
                  onChange={(e) => setVariantPackageSize(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Eenheid</label>
                <select
                  className={selectClassName}
                  value={variantPackageUnit}
                  onChange={(e) => setVariantPackageUnit(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="piece">piece</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
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
              confirmMutation.mutate();
            }}
            disabled={confirmMutation.isPending || storeMissing}
            className="gap-2"
          >
            {confirmMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Bevestigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
