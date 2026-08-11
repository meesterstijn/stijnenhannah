import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  COMPARISON_UNIT_LABELS as UNIT_LABELS,
  deleteUnusedProduct,
  deleteUnusedProductVariant,
  fetchProductCatalogDetail,
  type ProductCatalogVariantDetail,
} from "../lib/productMatching";
import { EditProductMetadataDialog } from "./EditProductMetadataDialog";
import { EditProductVariantDialog } from "./EditProductVariantDialog";
import { ProductComparisonUnitDialog } from "./ProductComparisonUnitDialog";
import { formatVariantLabel } from "../lib/formatters";

// Productcatalogus-detail v1 — toont canoniek product + al zijn varianten,
// met beheeracties die stuk voor stuk hergebruiken wat al bestaat:
// comparison_unit via de bestaande ProductComparisonUnitDialog (geen tweede
// implementatie), variantlabels via de bestaande formatVariantLabel().
// Leest rechtstreeks van products/product_variants (niet van
// receipt_item_prices) — dit is beheer van catalogusmetadata, niet van
// prijsanalyse.
//
// Verwijderen (v1) is bewust EXPLICIET, niet cascaderend: de knoppen
// hieronder zijn alleen zichtbaar/actief als de al geladen receiptItemCount/
// aliasCount/variants.length al 0 zijn (zie fetchProductCatalogDetail) — dat
// is puur een UI-gate om nooit een delete-knop te tonen die toch zou falen.
// De daadwerkelijke veiligheid komt van delete_unused_product_variant_v1/
// delete_unused_product_v1, die het gebruik altijd opnieuw en atomair
// server-side controleren (zie 20260903000000_delete_unused_product_
// catalog_v1.sql) — deze UI-telling is dus nooit de enige bescherming.
export function ProductCatalogDetailSheet({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);
  const [editingVariant, setEditingVariant] =
    useState<ProductCatalogVariantDetail | null>(null);
  const [confirmingDeleteVariant, setConfirmingDeleteVariant] =
    useState<ProductCatalogVariantDetail | null>(null);
  const [confirmingDeleteProduct, setConfirmingDeleteProduct] = useState(false);
  const [deleteVariantError, setDeleteVariantError] = useState<string | null>(
    null,
  );
  const [deleteProductError, setDeleteProductError] = useState<string | null>(
    null,
  );

  const detailQuery = useQuery({
    queryKey: ["product_catalog", "detail", productId],
    queryFn: () => fetchProductCatalogDetail(productId as string),
    enabled: open && !!productId,
  });
  const detail = detailQuery.data;

  const hints = useMemo(() => {
    if (!detail) return { hasWeightInfo: false, hasVolumeInfo: false };
    const units = new Set(
      detail.variants
        .map((v) => v.package_unit)
        .filter((u): u is string => u !== null),
    );
    return {
      hasWeightInfo: units.has("kg") || units.has("g"),
      hasVolumeInfo: units.has("l") || units.has("ml"),
    };
  }, [detail]);

  const productDeletable =
    !!detail &&
    detail.receiptItemCount === 0 &&
    detail.aliasCount === 0 &&
    detail.variants.length === 0;

  // Alleen product_catalog (lijst + dit detail) en product_variants
  // (gebruikt door andere variant-pickers elders) invalideren — een
  // aantoonbaar ongebruikte variant/product raakt per definitie geen
  // receipt_item_prices/product_aliases-data, dus die query's hoeven niet
  // opnieuw op te halen (geen onnodige invalidatie).
  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => deleteUnusedProductVariant(variantId),
    onSuccess: (result) => {
      if (!result.deleted) {
        setDeleteVariantError(
          `Deze variant wordt inmiddels gebruikt en kan niet meer worden verwijderd (${result.receiptItemCount} ${
            result.receiptItemCount === 1 ? "aankoop" : "aankopen"
          }, ${result.aliasCount} ${
            result.aliasCount === 1
              ? "automatische herkenning"
              : "automatische herkenningen"
          }).`,
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["product_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["product_variants"] });
      setConfirmingDeleteVariant(null);
    },
    onError: (err: Error) => setDeleteVariantError(err.message),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => deleteUnusedProduct(id),
    onSuccess: (result) => {
      if (!result.deleted) {
        setDeleteProductError(
          `Dit product wordt inmiddels gebruikt en kan niet meer worden verwijderd (${result.receiptItemCount} ${
            result.receiptItemCount === 1 ? "aankoop" : "aankopen"
          }, ${result.aliasCount} ${
            result.aliasCount === 1
              ? "automatische herkenning"
              : "automatische herkenningen"
          }, ${result.variantCount} ${
            result.variantCount === 1 ? "variant" : "varianten"
          }).`,
        );
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["product_catalog"] });
      setConfirmingDeleteProduct(false);
      onOpenChange(false);
    },
    onError: (err: Error) => setDeleteProductError(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{detail?.canonical_name ?? "Product"}</SheetTitle>
          <SheetDescription>
            Catalogusmetadata — wijzigingen hier raken nooit de raw kassabondata
            van historische aankopen.
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isLoading && (
          <div className="py-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!detailQuery.isLoading && detailQuery.isError && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-destructive">
              Productdetail laden is mislukt.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => detailQuery.refetch()}
            >
              Opnieuw proberen
            </Button>
          </div>
        )}

        {detail && (
          <div className="mt-4 space-y-5">
            <div className="rounded-xl border border-border/70 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="text-sm font-medium text-foreground break-words">
                    {detail.canonical_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMetadata(true)}
                  className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Bewerken
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Vergelijkeenheid
                  </p>
                  <p className="text-sm text-foreground">
                    {UNIT_LABELS[detail.comparison_unit]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUnit(true)}
                  className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Wijzigen
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {detail.variants.length}{" "}
                {detail.variants.length === 1 ? "variant" : "varianten"} ·{" "}
                {detail.receiptItemCount}{" "}
                {detail.receiptItemCount === 1 ? "aankoop" : "aankopen"}
                {detail.aliasCount > 0
                  ? ` · ${detail.aliasCount} ${
                      detail.aliasCount === 1
                        ? "automatische herkenning"
                        : "automatische herkenningen"
                    }`
                  : ""}
              </p>
              <div className="pt-1 border-t border-border/50">
                {productDeletable ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteProductError(null);
                      setConfirmingDeleteProduct(true);
                    }}
                    className="text-[11px] text-destructive hover:underline"
                  >
                    Product verwijderen
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Dit product kan niet worden verwijderd omdat het nog wordt
                    gebruikt.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Varianten
              </h3>
              {detail.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Nog geen varianten.
                </p>
              ) : (
                <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                  {detail.variants.map((v) => {
                    const variantUnused =
                      v.receiptItemCount === 0 && v.aliasCount === 0;
                    return (
                      <li key={v.id} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground break-words">
                            {formatVariantLabel(v, v.store_name)}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingVariant(v)}
                              className="px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                            >
                              Bewerken
                            </button>
                            {variantUnused && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteVariantError(null);
                                  setConfirmingDeleteVariant(v);
                                }}
                                className="px-1 text-[11px] text-destructive hover:underline"
                              >
                                Verwijderen
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {v.receiptItemCount}{" "}
                          {v.receiptItemCount === 1 ? "aankoop" : "aankopen"}
                          {v.aliasCount > 0
                            ? ` · ${v.aliasCount} ${
                                v.aliasCount === 1
                                  ? "automatische herkenning"
                                  : "automatische herkenningen"
                              }`
                            : ""}
                          {!variantUnused
                            ? " · kan niet worden verwijderd"
                            : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>

      {detail && (
        <>
          <EditProductMetadataDialog
            productId={detail.id}
            currentName={detail.canonical_name}
            currentCategoryId={detail.category_id}
            open={editingMetadata}
            onOpenChange={setEditingMetadata}
          />
          <ProductComparisonUnitDialog
            productId={detail.id}
            productName={detail.canonical_name}
            currentComparisonUnit={detail.comparison_unit}
            hasWeightInfo={hints.hasWeightInfo}
            hasVolumeInfo={hints.hasVolumeInfo}
            open={editingUnit}
            onOpenChange={setEditingUnit}
          />

          <Dialog
            open={confirmingDeleteProduct}
            onOpenChange={(next) => {
              setConfirmingDeleteProduct(next);
              if (!next) setDeleteProductError(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Product verwijderen?</DialogTitle>
                <DialogDescription>
                  Dit product heeft geen varianten, aankopen of automatische
                  herkenningen. Verwijderen kan niet ongedaan worden gemaakt.
                </DialogDescription>
              </DialogHeader>
              {deleteProductError && (
                <p className="text-sm text-destructive">{deleteProductError}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmingDeleteProduct(false)}
                  disabled={deleteProductMutation.isPending}
                >
                  Annuleren
                </Button>
                <Button
                  type="button"
                  onClick={() => deleteProductMutation.mutate(detail.id)}
                  disabled={deleteProductMutation.isPending}
                  className="gap-2 bg-destructive text-white hover:bg-destructive/90"
                >
                  {deleteProductMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Product verwijderen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <EditProductVariantDialog
        variant={editingVariant}
        open={editingVariant !== null}
        onOpenChange={(next) => {
          if (!next) setEditingVariant(null);
        }}
      />

      <Dialog
        open={confirmingDeleteVariant !== null}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmingDeleteVariant(null);
            setDeleteVariantError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Variant verwijderen?</DialogTitle>
            <DialogDescription>
              Deze variant heeft geen historische aankopen en geen automatische
              herkenningen. Verwijderen raakt geen kassabondata.
            </DialogDescription>
          </DialogHeader>
          {deleteVariantError && (
            <p className="text-sm text-destructive">{deleteVariantError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDeleteVariant(null)}
              disabled={deleteVariantMutation.isPending}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() =>
                confirmingDeleteVariant &&
                deleteVariantMutation.mutate(confirmingDeleteVariant.id)
              }
              disabled={deleteVariantMutation.isPending}
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteVariantMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Variant verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
