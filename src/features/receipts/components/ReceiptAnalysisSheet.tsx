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
  fetchSpendingSummary,
  fetchItemPrices,
  filterSummaryByPeriod,
  filterItemPricesByPeriod,
  aggregateTotalPaid,
  aggregateSpendingExcludingDeposit,
  aggregateDiscountTotal,
  aggregateDepositTotal,
  aggregateSpendingByStore,
  recentItemPrices,
  PERIODS,
  PERIOD_LABELS,
  type Period,
  type NullAwareAggregate,
} from "../lib/receiptAnalysis";
import {
  formatCurrencyAmount,
  formatComparisonPrice,
  formatDateShort,
} from "../lib/formatters";

function bonWoord(n: number) {
  return n === 1 ? "bon" : "bonnen";
}

// Toont elke currency die in de periode voorkomt op een eigen regel (in de
// praktijk vandaag altijd alleen EUR) — nooit currencies bij elkaar
// optellen. `footnoteWhenPartial` maakt per kaart een iets andere, meer
// specifieke toelichting mogelijk (zie de "Boodschappen"-kaart hieronder),
// zonder de NULL-transparantie-logica te dupliceren.
function MoneyStatCard({
  label,
  aggregate,
  average = false,
  footnoteWhenPartial,
}: {
  label: string;
  aggregate: NullAwareAggregate;
  average?: boolean;
  footnoteWhenPartial?: (known: number, total: number) => string;
}) {
  const known = aggregate.stats.reduce((acc, s) => acc + s.count, 0);
  const visible = aggregate.stats.filter((s) => s.count > 0);
  return (
    <div className="rounded-xl border border-border/70 bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {visible.length === 0 ? (
        <p className="text-lg font-semibold text-foreground">—</p>
      ) : (
        visible.map((s) => (
          <p
            key={s.currency}
            className="text-lg font-semibold text-foreground leading-tight"
          >
            {formatCurrencyAmount(
              average ? s.sum / s.count : s.sum,
              s.currency,
            )}
          </p>
        ))
      )}
      {known < aggregate.totalCount && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {footnoteWhenPartial
            ? footnoteWhenPartial(known, aggregate.totalCount)
            : `Bekend voor ${known} van ${aggregate.totalCount} ${bonWoord(aggregate.totalCount)}.`}
        </p>
      )}
    </div>
  );
}

// Kassabonanalyse v1 — mobile-first full-screen sheet, opent vanuit
// ReceiptImportCard. Leest uitsluitend uit de twee goedgekeurde views
// (receipt_spending_summary, receipt_item_prices); geen enkele waarde wordt
// hier opnieuw uit raw shopping_receipt_items berekend of teruggeschreven.
// Beide views worden één keer volledig opgehaald (klein datavolume) en
// daarna puur client-side per periode gefilterd/geaggregeerd — zo triggert
// het wisselen van periode geen nieuwe netwerkaanvraag.
export function ReceiptAnalysisSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [period, setPeriod] = useState<Period>("this_month");

  const summaryQuery = useQuery({
    queryKey: ["receipt_spending_summary", "all"],
    queryFn: fetchSpendingSummary,
    enabled: open,
  });
  const itemPricesQuery = useQuery({
    queryKey: ["receipt_item_prices", "all"],
    queryFn: fetchItemPrices,
    enabled: open,
  });

  const filteredSummary = useMemo(
    () => filterSummaryByPeriod(summaryQuery.data ?? [], period),
    [summaryQuery.data, period],
  );
  const filteredItemPrices = useMemo(
    () => filterItemPricesByPeriod(itemPricesQuery.data ?? [], period),
    [itemPricesQuery.data, period],
  );

  const totalPaid = useMemo(
    () => aggregateTotalPaid(filteredSummary),
    [filteredSummary],
  );
  // Hergebruikt totalPaid.stats (geen nieuwe query/berekening) — hetzelfde
  // "hoeveel bonnen hadden een bekend total_paid"-signaal dat de kerncijfer-
  // kaarten al tonen, nu ook voor de winkellijst hieronder.
  const knownTotalPaidCount = useMemo(
    () => totalPaid.stats.reduce((acc, s) => acc + s.count, 0),
    [totalPaid],
  );
  const excludingDeposit = useMemo(
    () => aggregateSpendingExcludingDeposit(filteredSummary),
    [filteredSummary],
  );
  const discount = useMemo(
    () => aggregateDiscountTotal(filteredSummary),
    [filteredSummary],
  );
  const deposit = useMemo(
    () => aggregateDepositTotal(filteredSummary),
    [filteredSummary],
  );
  const storeSpending = useMemo(
    () => aggregateSpendingByStore(filteredSummary),
    [filteredSummary],
  );
  const recentPrices = useMemo(
    () => recentItemPrices(filteredItemPrices, 10),
    [filteredItemPrices],
  );

  const isLoading = summaryQuery.isLoading || itemPricesQuery.isLoading;
  const isError = summaryQuery.isError || itemPricesQuery.isError;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Kassabonanalyse</SheetTitle>
          <SheetDescription>
            Uitgaven en prijzen op basis van je geïmporteerde kassabonnen.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  period === p
                    ? "bg-foreground text-background border-foreground"
                    : "border-border/70 text-foreground hover:bg-muted/40"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && isError && (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-destructive">
                Analyse laden is mislukt.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  summaryQuery.refetch();
                  itemPricesQuery.refetch();
                }}
              >
                Opnieuw proberen
              </Button>
            </div>
          )}

          {!isLoading && !isError && filteredSummary.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nog geen kassabonnen in deze periode.
            </p>
          )}

          {!isLoading && !isError && filteredSummary.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MoneyStatCard label="Uitgegeven" aggregate={totalPaid} />
                <MoneyStatCard
                  label="Boodschappen"
                  aggregate={excludingDeposit}
                  footnoteWhenPartial={(known, total) =>
                    `Excl. statiegeld voor ${known} van ${total} ${bonWoord(total)} berekenbaar.`
                  }
                />
                <MoneyStatCard label="Korting" aggregate={discount} />
                <MoneyStatCard label="Statiegeld" aggregate={deposit} />
                <MoneyStatCard label="Gem. bon" aggregate={totalPaid} average />
                <div className="rounded-xl border border-border/70 bg-white p-3">
                  <p className="text-xs text-muted-foreground">Aantal bonnen</p>
                  <p className="text-lg font-semibold text-foreground">
                    {filteredSummary.length}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Uitgaven per winkel
                </h3>
                {knownTotalPaidCount < totalPaid.totalCount && (
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Gebaseerd op {knownTotalPaidCount} van{" "}
                    {totalPaid.totalCount} {bonWoord(totalPaid.totalCount)} met
                    bekend totaal.
                  </p>
                )}
                <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                  {storeSpending.map((s) => (
                    <li
                      key={`${s.storeId ?? s.storeName}-${s.currency}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="truncate">{s.storeName}</span>
                      <span className="font-medium shrink-0">
                        {formatCurrencyAmount(s.total, s.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Recente productprijzen
                </h3>
                {recentPrices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    Nog geen gekoppelde productprijzen in deze periode.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-white">
                    {recentPrices.map((p) => (
                      <li key={p.receipt_item_id} className="px-3 py-2.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.store_name ?? "Onbekende winkel"} ·{" "}
                          {formatDateShort(p.purchase_date)}
                        </p>
                        <p className="text-sm text-foreground mt-0.5">
                          {formatComparisonPrice(
                            p.comparison_paid_price,
                            p.comparison_price_unit,
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
