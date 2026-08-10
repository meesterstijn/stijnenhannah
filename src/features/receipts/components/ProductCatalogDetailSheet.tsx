import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  COMPARISON_UNIT_LABELS as UNIT_LABELS,
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
export function ProductCatalogDetailSheet({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);
  const [editingVariant, setEditingVariant] =
    useState<ProductCatalogVariantDetail | null>(null);

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
                  {detail.variants.map((v) => (
                    <li key={v.id} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground break-words">
                          {formatVariantLabel(v, v.store_name)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditingVariant(v)}
                          className="shrink-0 px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Bewerken
                        </button>
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
                      </p>
                    </li>
                  ))}
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
        </>
      )}

      <EditProductVariantDialog
        variant={editingVariant}
        open={editingVariant !== null}
        onOpenChange={(next) => {
          if (!next) setEditingVariant(null);
        }}
      />
    </Sheet>
  );
}
