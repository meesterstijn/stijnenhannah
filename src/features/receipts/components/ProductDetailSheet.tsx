import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  buildProductPriceDetail,
  computeProductPriceStats,
  type ItemPriceRow,
  type ValidPriceObservation,
} from "../lib/receiptAnalysis";
import {
  formatComparisonPrice,
  formatComparisonUnitLabel,
  formatDateLong,
  formatDateShortWithYear,
  formatPriceDiff,
} from "../lib/formatters";

function storeLabel(o: ValidPriceObservation): string {
  const store = o.store_name ?? "Onbekende winkel";
  return o.branch_name ? `${store} · ${o.branch_name}` : store;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground leading-tight">
        {value}
      </p>
    </div>
  );
}

// Productdetail & prijsgeschiedenis v1 — genest bovenop ReceiptAnalysisSheet
// (dat zelf al een Sheet is). Radix' Dialog-primitive (waarop Sheet is
// gebouwd) ondersteunt meerdere onafhankelijk geopende instanties: elke
// Sheet.Root beheert zijn eigen open-state/portal/focus-trap, en de later
// gemonteerde (dus later in de DOM toegevoegde) instantie tekent boven de
// eerdere — hetzelfde patroon dat overal in dit project voor Dialog-op-
// Dialog-bevestigingen wordt gebruikt. Er is dus geen aparte route of
// custom stacking-logica nodig; sluiten van deze Sheet laat de onderliggende
// ReceiptAnalysisSheet ongewijzigd open en bruikbaar staan.
//
// Krijgt de al opgehaalde, ONGEFILTERDE item-prices-dataset als prop mee
// (dezelfde react-query-cache-data als ReceiptAnalysisSheet gebruikt) —
// geen eigen query, dus geen N+1-gedrag bij het openen van een product.
// Gebruikt bewust ALLE beschikbare waarnemingen, niet de periode-gefilterde
// subset van de ouder-sheet (productdetail v1 heeft geen eigen periodefilter).
export function ProductDetailSheet({
  open,
  onOpenChange,
  productId,
  productName,
  itemPrices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName: string | null;
  itemPrices: ItemPriceRow[];
}) {
  const detail = useMemo(() => {
    if (!productId) return null;
    return buildProductPriceDetail(itemPrices, productId);
  }, [itemPrices, productId]);

  const stats = useMemo(() => {
    if (!detail) return null;
    return computeProductPriceStats(detail.observations);
  }, [detail]);

  const unitLabel = detail?.comparisonUnit
    ? formatComparisonUnitLabel(detail.comparisonUnit)
    : null;
  const title = detail?.productName ?? productName ?? "Product";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {title}
            {unitLabel ? ` / ${unitLabel}` : ""}
          </SheetTitle>
          <SheetDescription>
            Prijsgeschiedenis op basis van al je geïmporteerde kassabonnen.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {!stats && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Voor dit product zijn nog geen vergelijkbare prijswaarnemingen
              beschikbaar.
            </p>
          )}

          {stats && detail && (
            <>
              {detail.excludedOtherUnitCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {detail.excludedOtherUnitCount}{" "}
                  {detail.excludedOtherUnitCount === 1
                    ? "eerdere prijswaarneming"
                    : "eerdere prijswaarnemingen"}{" "}
                  met een afwijkende valuta/eenheid zijn hier niet in
                  meegenomen.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="Laatste prijs"
                  value={formatComparisonPrice(
                    stats.latest.comparison_paid_price,
                    stats.latest.comparison_price_unit,
                  )}
                />
                <StatCard
                  label="Gemiddelde prijs"
                  value={formatComparisonPrice(
                    stats.average,
                    detail.primaryPriceUnit,
                  )}
                />
                <StatCard
                  label="Laagste prijs"
                  value={formatComparisonPrice(
                    stats.lowest,
                    detail.primaryPriceUnit,
                  )}
                />
                <StatCard
                  label="Hoogste prijs"
                  value={formatComparisonPrice(
                    stats.highest,
                    detail.primaryPriceUnit,
                  )}
                />
                <div className="col-span-2 rounded-xl border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">
                    Aantal prijswaarnemingen
                  </p>
                  <p className="text-lg font-semibold text-foreground leading-tight">
                    {stats.count}{" "}
                    {stats.count === 1
                      ? "prijswaarneming"
                      : "prijswaarnemingen"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-white p-3">
                <p className="text-xs text-muted-foreground">
                  Ten opzichte van vorige waarneming
                </p>
                {stats.previous ? (
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {formatPriceDiff(
                      stats.diffAbsolute ?? 0,
                      stats.latest.comparison_price_unit,
                      stats.diffPercent,
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Nog geen eerdere prijs om mee te vergelijken.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-white p-3">
                <p className="text-xs text-muted-foreground">
                  Laatste prijswaarneming
                </p>
                <p className="text-sm text-foreground mt-0.5">
                  {storeLabel(stats.latest)} ·{" "}
                  {formatDateLong(stats.latest.purchase_date)}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Prijsgeschiedenis
                </h3>
                <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                  {detail.observations.map((o) => (
                    <li key={o.receipt_item_id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground">
                          {formatDateShortWithYear(o.purchase_date)}
                        </span>
                        <span className="text-sm font-medium text-foreground shrink-0">
                          {formatComparisonPrice(
                            o.comparison_paid_price,
                            o.comparison_price_unit,
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {storeLabel(o)}
                        {o.variant_name ? ` · ${o.variant_name}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
