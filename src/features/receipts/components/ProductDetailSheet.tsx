import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EditReceiptItemMatchDialog } from "./EditReceiptItemMatchDialog";
import { ProductComparisonUnitDialog } from "./ProductComparisonUnitDialog";
import type { ComparisonUnit } from "../lib/productMatching";
import {
  aggregateProductPricesByStore,
  buildCombinedStoreComparison,
  buildLatestPriceByStore,
  buildProductPriceDetail,
  computeProductPriceStats,
  detectPackageUnitHints,
  determineHistoricallyBestValueStore,
  type CombinedStoreComparison,
  type ItemPriceRow,
  type ValidPriceObservation,
} from "../lib/receiptAnalysis";
import {
  formatComparisonPrice,
  formatComparisonUnitLabel,
  formatDateLong,
  formatDateShortWithYear,
  formatPriceDiff,
  formatVariantLabel,
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

function StoreStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// Winkelvergelijking v1 — één kaart per store_id, combineert de meest
// recente geldige vergelijkprijs (prioriteit, groot/prominent) met de
// bestaande historische statistieken (Historiek: gemiddeld/laagste/hoogste/
// aantal, secundair/muted). Vervangt de eerdere twee losse secties ("Per
// winkel" met de averagePrice-gebaseerde "Historisch goedkoopst"-badge, en
// "Vergelijk winkels") — die badge/claim is hiermee vervallen, zie
// buildCombinedStoreComparison() in receiptAnalysis.ts. Puur presentatie,
// geen eigen berekening: elk veld komt rechtstreeks van de al gecombineerde
// data.
function StoreComparisonCard({ store }: { store: CombinedStoreComparison }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white p-3">
      <p className="text-sm font-medium text-foreground break-words">
        {store.storeName}
      </p>

      <div className="mt-1.5">
        <p className="text-xs text-muted-foreground">Laatste prijs</p>
        <p className="text-lg font-semibold text-foreground leading-tight">
          {formatComparisonPrice(
            store.latestComparisonPaidPrice,
            store.latestComparisonPriceUnit,
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDateShortWithYear(store.latestPurchaseDate)}
        </p>
      </div>

      <div className="mt-2.5 space-y-0.5 border-t border-border/50 pt-2.5">
        <p className="text-xs text-muted-foreground mb-1">Historiek</p>
        <StoreStatRow
          label="Gemiddeld"
          value={formatComparisonPrice(
            store.averagePrice,
            store.latestComparisonPriceUnit,
          )}
        />
        <StoreStatRow
          label="Laagste"
          value={formatComparisonPrice(
            store.lowestPrice,
            store.latestComparisonPriceUnit,
          )}
        />
        <StoreStatRow
          label="Hoogste"
          value={formatComparisonPrice(
            store.highestPrice,
            store.latestComparisonPriceUnit,
          )}
        />
        <p className="text-xs text-muted-foreground pt-1">
          {store.observationCount}{" "}
          {store.observationCount === 1
            ? "prijswaarneming"
            : "prijswaarnemingen"}
          {store.hasMultipleVariants
            ? " · gebaseerd op verschillende verpakkingen"
            : ""}
        </p>
      </div>
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

  // Winkelvergelijking v1 — combineert de twee bestaande, onafhankelijke
  // winkelaggregaties (historisch gemiddelde/laagste/hoogste + meest
  // recente vergelijkprijs) tot één rij per store_id. Alles hergebruikt
  // exact detail.observations — dezelfde, al bepaalde actieve
  // comparison_price_unit-groep als de rest van het productdetail. Geen
  // aparte selectie, geen nieuwe query.
  const storeStats = useMemo(() => {
    if (!detail) return [];
    return aggregateProductPricesByStore(detail.observations);
  }, [detail]);
  const latestStorePrices = useMemo(() => {
    if (!detail) return [];
    return buildLatestPriceByStore(detail.observations);
  }, [detail]);
  const combinedStores = useMemo(
    () => buildCombinedStoreComparison(latestStorePrices, storeStats),
    [latestStorePrices, storeStats],
  );
  // Eén hoofdconclusie in V1: voordeligst op basis van de laatste aankoop
  // (nooit op basis van historisch gemiddelde) — vereist minimaal 2
  // winkels, anders is er niets te vergelijken.
  const bestValueStoreId = useMemo(
    () => determineHistoricallyBestValueStore(latestStorePrices),
    [latestStorePrices],
  );
  const bestValueStoreName =
    combinedStores.find((s) => s.storeId === bestValueStoreId)?.storeName ??
    null;

  const unitLabel = detail?.comparisonUnit
    ? formatComparisonUnitLabel(detail.comparisonUnit)
    : null;
  const title = detail?.productName ?? productName ?? "Product";

  // Bestaande koppeling corrigeren voor precies één receipt_item_id (zie
  // EditReceiptItemMatchDialog). Wijzigt product_id -> de regel kan na het
  // invalideren van receipt_item_prices uit dit productdetail verdwijnen —
  // dat is correct en vereist hier geen speciale afhandeling: detail/stats
  // hierboven zijn al memo's op itemPrices/productId, dus ze rekenen
  // automatisch opnieuw op de vernieuwde data.
  const [editingReceiptItemId, setEditingReceiptItemId] = useState<
    string | null
  >(null);

  // Comparison unit van het canonieke product bewerken v1 — puur
  // informatieve hint op basis van AL geladen package_unit-waarden, geen
  // nieuwe query.
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const packageUnitHints = useMemo(
    () =>
      productId
        ? detectPackageUnitHints(itemPrices, productId)
        : { hasWeightInfo: false, hasVolumeInfo: false },
    [itemPrices, productId],
  );

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

        {productId && detail?.comparisonUnit && (
          <button
            type="button"
            onClick={() => setUnitDialogOpen(true)}
            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Vergelijkeenheid wijzigen
          </button>
        )}

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
                  Winkelvergelijking
                </h3>
                {combinedStores.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    Nog onvoldoende winkeldata om te vergelijken.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {combinedStores.map((s) => (
                      <StoreComparisonCard key={s.storeId} store={s} />
                    ))}
                    {bestValueStoreName && (
                      <p className="text-[11px] text-muted-foreground">
                        Voordeligst op basis van laatste aankoop:{" "}
                        {bestValueStoreName}
                      </p>
                    )}
                  </div>
                )}
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
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground break-words">
                          {storeLabel(o)}
                          {o.variant_name
                            ? ` · ${formatVariantLabel({
                                variant_name: o.variant_name,
                                package_size: o.package_size,
                                package_unit: o.package_unit,
                              })}`
                            : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingReceiptItemId(o.receipt_item_id)
                          }
                          className="shrink-0 px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Bewerken
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <EditReceiptItemMatchDialog
        receiptItemId={editingReceiptItemId}
        open={editingReceiptItemId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingReceiptItemId(null);
        }}
      />

      {productId && detail?.comparisonUnit && (
        <ProductComparisonUnitDialog
          productId={productId}
          productName={title}
          currentComparisonUnit={detail.comparisonUnit as ComparisonUnit}
          hasWeightInfo={packageUnitHints.hasWeightInfo}
          hasVolumeInfo={packageUnitHints.hasVolumeInfo}
          open={unitDialogOpen}
          onOpenChange={setUnitDialogOpen}
        />
      )}
    </Sheet>
  );
}
