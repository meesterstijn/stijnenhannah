import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  COMPARISON_UNITS,
  COMPARISON_UNIT_LABELS as UNIT_LABELS,
  updateProductComparisonUnit,
  type ComparisonUnit,
} from "../lib/productMatching";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Nederlandse labels: COMPARISON_UNIT_LABELS uit productMatching.ts (bewust
// niet formatComparisonUnitLabel() uit formatters.ts — die is een terse
// header-subtitel die voor 'none' expres null teruggeeft; hier is 'none'
// juist een volwaardige, zichtbare keuzeoptie met een andere, uitlegerige
// formulering). Centraal gedefinieerd zodat de Productcatalogus
// (ProductCatalogSheet/ProductCatalogDetailSheet) exact dezelfde labels
// toont zonder een tweede, mogelijk afwijkende mapping.

// Comparison unit van een bestaand canoniek product bewerken v1 — raakt
// UITSLUITEND products.comparison_unit (gewone Supabase-update, binnen de
// bestaande owner-only RLS, geen RPC/migration nodig). Wijzigt nooit
// variant_name/package_size/package_unit/store_id/brand, canonical_name of
// category_id, en raakt nooit raw kassabondata — dat blijft voorbehouden aan
// EditReceiptItemMatchDialog resp. de bestaande product-/variant-aanmaak.
export function ProductComparisonUnitDialog({
  productId,
  productName,
  currentComparisonUnit,
  hasWeightInfo,
  hasVolumeInfo,
  open,
  onOpenChange,
}: {
  productId: string;
  productName: string;
  currentComparisonUnit: ComparisonUnit;
  hasWeightInfo: boolean;
  hasVolumeInfo: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ComparisonUnit>(
    currentComparisonUnit,
  );
  const [error, setError] = useState<string | null>(null);

  // Bij elke keer openen begint de selectie bij de HUIDIGE waarde — nooit
  // bij een keuze uit een vorige open-sessie van deze dialoog.
  useEffect(() => {
    if (open) {
      setSelected(currentComparisonUnit);
      setError(null);
    }
  }, [open, currentComparisonUnit]);

  const saveMutation = useMutation({
    mutationFn: () => updateProductComparisonUnit(productId, selected),
    onSuccess: () => {
      // comparison_unit hoort bij het CANONIEKE product, dus raakt ALLE
      // historische prijswaarnemingen van dat product tegelijk —
      // receipt_item_prices is een gewone (niet-materialized) view en
      // berekent dus automatisch opnieuw zodra deze query wordt herhaald.
      queryClient.invalidateQueries({ queryKey: ["receipt_item_prices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Sinds deze dialoog ook vanuit de Productcatalogus bereikbaar is:
      // dezelfde comparison_unit is daar ook zichtbaar.
      queryClient.invalidateQueries({ queryKey: ["product_catalog"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const isChanged = selected !== currentComparisonUnit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vergelijkeenheid wijzigen</DialogTitle>
          <DialogDescription>
            Deze instelling bepaalt hoe alle aankopen van {productName} in
            prijsanalyses worden vergeleken.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="font-medium text-foreground break-words">
              {productName}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Huidig</p>
            <p className="text-foreground">
              {UNIT_LABELS[currentComparisonUnit]}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Nieuwe waarde
            </label>
            <select
              className={selectClassName}
              value={selected}
              onChange={(e) => setSelected(e.target.value as ComparisonUnit)}
            >
              {COMPARISON_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>

          {(hasWeightInfo || hasVolumeInfo) && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2.5">
              {hasWeightInfo &&
                "Er zijn varianten met gewichtsinformatie beschikbaar."}
              {hasWeightInfo && hasVolumeInfo && " "}
              {hasVolumeInfo &&
                "Er zijn varianten met volume-informatie beschikbaar."}
            </p>
          )}

          {isChanged && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
              Wijzigen van {UNIT_LABELS[currentComparisonUnit]} naar{" "}
              {UNIT_LABELS[selected]} herberekent bestaande prijsanalyses waar
              voldoende gewicht-/verpakkingsinformatie beschikbaar is. Niet elke
              aankoop kan worden omgerekend als die informatie ontbreekt — die
              blijft dan zonder vergelijkprijs, nooit gegokt.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

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
            disabled={saveMutation.isPending || !isChanged}
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
