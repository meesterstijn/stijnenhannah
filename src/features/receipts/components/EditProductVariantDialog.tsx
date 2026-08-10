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
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  updateProductVariant,
  type ProductCatalogVariantDetail,
} from "../lib/productMatching";
import { fetchStores } from "../lib/stores";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Variant bewerken (Product- & variantbeheer v1) — wijzigt variant_name/
// brand/store_id/package_size/package_unit. Verplaatst NOOIT product_id
// (niet in de update-payload, dus technisch onmogelijk vanuit dit
// formulier) — een variant naar een ander canoniek product verhuizen blijft
// expliciet buiten scope van v1.
//
// product_variants is een GEDEELD catalogusobject: deze wijziging raakt de
// interpretatie van ALLE historische receipt items die naar deze variant
// wijzen, niet alleen de weergave van één aankoop — vandaar de waarschuwing
// bij package_size/package_unit wanneer er al aankopen aan deze variant
// hangen.
export function EditProductVariantDialog({
  variant,
  open,
  onOpenChange,
}: {
  variant: ProductCatalogVariantDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [variantName, setVariantName] = useState("");
  const [brand, setBrand] = useState("");
  const [storeId, setStoreId] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [packageUnit, setPackageUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
    enabled: open,
  });

  useEffect(() => {
    if (open && variant) {
      setVariantName(variant.variant_name);
      setBrand(variant.brand ?? "");
      setStoreId(variant.store_id ?? "");
      setPackageSize(
        variant.package_size !== null ? String(variant.package_size) : "",
      );
      setPackageUnit(variant.package_unit ?? "");
      setError(null);
    }
  }, [open, variant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!variant) throw new Error("Geen variant geselecteerd.");
      if (!variantName.trim()) throw new Error("Vul een variantnaam in.");
      const trimmedSize = packageSize.trim();
      const size = trimmedSize ? Number(trimmedSize) : null;
      if (size !== null) {
        if (!(size > 0)) {
          throw new Error("Verpakkingsgrootte moet groter dan 0 zijn.");
        }
        if (!packageUnit) {
          throw new Error("Kies een eenheid bij de verpakkingsgrootte.");
        }
      }
      await updateProductVariant({
        variantId: variant.id,
        variantName,
        brand: brand.trim() || null,
        storeId: storeId || null,
        packageSize: size,
        packageUnit: size !== null ? packageUnit : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["product_variants"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_item_prices"] });
      queryClient.invalidateQueries({ queryKey: ["shopping_receipts"] });
      queryClient.invalidateQueries({ queryKey: ["product_aliases"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Variant bewerken</DialogTitle>
          <DialogDescription>
            Deze variant is een gedeeld catalogusobject — wijzigingen gelden
            voor alle aankopen die hieraan gekoppeld zijn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Variantnaam</label>
            <Input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Merk (optioneel)
              </label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Winkelbinding
              </label>
              <select
                className={selectClassName}
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">Generiek / meerdere winkels</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.canonical_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {variant.receiptItemCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
              Deze variant wordt gebruikt door {variant.receiptItemCount}{" "}
              {variant.receiptItemCount === 1
                ? "historische aankoop"
                : "historische aankopen"}
              . Wijzigingen aan verpakking werken door in hun prijsanalyse.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Verpakkingsgrootte (optioneel — alleen als echt bekend)
              </label>
              <Input
                type="number"
                step="any"
                value={packageSize}
                onChange={(e) => setPackageSize(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Eenheid</label>
              <select
                className={selectClassName}
                value={packageUnit}
                onChange={(e) => setPackageUnit(e.target.value)}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
