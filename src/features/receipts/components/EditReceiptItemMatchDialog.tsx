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
import { getCategories } from "@/lib/categories";
import {
  COMPARISON_UNITS,
  createProduct,
  createProductVariant,
  editReceiptItemMatch,
  fetchProductVariants,
  fetchProducts,
  fetchReceiptItemEditContext,
  findExistingAliasForReceiptItem,
  type ComparisonUnit,
  type Product,
} from "../lib/productMatching";
import { fetchStores } from "../lib/stores";
import {
  formatCurrencyAmount,
  formatDateLong,
  formatVariantLabel,
} from "../lib/formatters";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function findDuplicateProduct(
  name: string,
  products: Product[],
): Product | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return (
    products.find(
      (p) => p.canonical_name.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

type VariantMode = "none" | "existing" | "new";

// Bestaande productkoppeling bewerken v1 — correctie van EEN al gekoppelde
// kassabonregel (raw_name/bedragen blijven altijd onaangeraakt, zie
// edit_receipt_item_match_v1 in 20260902000000). Bewust een Dialog (niet
// nog een Sheet): dit is een kleine, gerichte correctie, geen nieuw
// hoofdscherm — zelfde vormtaal als het bestaande MatchReceiptItemDialog
// voor exact dezelfde matching-taak. Radix ondersteunt onafhankelijk
// geopende Dialog/Sheet-instanties op elke nestingsdiepte (al benut door
// ProductDetailSheet-in-ReceiptAnalysisSheet), dus deze derde laag
// (Dialog-in-Sheet-in-Sheet) is even veilig.
export function EditReceiptItemMatchDialog({
  receiptItemId,
  open,
  onOpenChange,
}: {
  receiptItemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [productMode, setProductMode] = useState<"existing" | "new">(
    "existing",
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [newProductComparisonUnit, setNewProductComparisonUnit] =
    useState<ComparisonUnit>("piece");
  const [variantMode, setVariantMode] = useState<VariantMode>("none");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantBrand, setVariantBrand] = useState("");
  const [variantStoreId, setVariantStoreId] = useState("");
  const [variantPackageSize, setVariantPackageSize] = useState("");
  const [variantPackageUnit, setVariantPackageUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [pendingAlias, setPendingAlias] = useState<{
    productId: string;
    productVariantId: string | null;
  } | null>(null);

  const contextQuery = useQuery({
    queryKey: ["receipt_item_edit_context", receiptItemId],
    queryFn: () => fetchReceiptItemEditContext(receiptItemId as string),
    enabled: open && !!receiptItemId,
  });
  const context = contextQuery.data;

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
  const { data: existingVariants = [] } = useQuery({
    queryKey: ["product_variants", selectedProductId],
    queryFn: () => fetchProductVariants(selectedProductId),
    enabled: open && productMode === "existing" && !!selectedProductId,
  });

  // Vult het formulier één keer met de huidige koppeling zodra de context
  // geladen is — een bewerking start bij "wat is het nu?", niet bij een
  // leeg formulier. Reset bij sluiten, zodat een volgende open (voor een
  // ander receipt item) niet de vorige invoer meesleept.
  useEffect(() => {
    if (open && context && !initialized) {
      setProductMode("existing");
      setSelectedProductId(context.product_id ?? "");
      setVariantMode(context.product_variant_id ? "existing" : "none");
      setSelectedVariantId(context.product_variant_id ?? "");
      setInitialized(true);
    }
    if (!open && initialized) {
      setInitialized(false);
      setProductMode("existing");
      setSelectedProductId("");
      setNewProductName("");
      setNewProductCategoryId("");
      setNewProductComparisonUnit("piece");
      setVariantMode("none");
      setSelectedVariantId("");
      setVariantName("");
      setVariantBrand("");
      setVariantStoreId("");
      setVariantPackageSize("");
      setVariantPackageUnit("");
      setError(null);
      setPendingAlias(null);
    }
  }, [open, context, initialized]);

  function invalidateAfterEdit() {
    queryClient.invalidateQueries({ queryKey: ["receipt_item_prices"] });
    queryClient.invalidateQueries({ queryKey: ["receipt_items"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    // Prefix-invalidatie dekt zowel ["shopping_receipts","history"] als de
    // nieuwe ["shopping_receipts","detail",receiptId] — nodig sinds deze
    // dialoog nu ook vanuit een geopende ReceiptDetailSheet bereikbaar is.
    queryClient.invalidateQueries({ queryKey: ["shopping_receipts"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!context) throw new Error("Kassabonregel niet geladen.");

      let productId = selectedProductId;
      if (productMode === "new") {
        if (!newProductName.trim())
          throw new Error("Vul een naam voor het nieuwe product in.");
        const duplicate = findDuplicateProduct(newProductName, products);
        if (duplicate) {
          throw new Error(
            `Dit product bestaat al: "${duplicate.canonical_name}". Kies het bestaande product in plaats van een nieuw product aan te maken.`,
          );
        }
        const product = await createProduct({
          canonicalName: newProductName,
          categoryId: newProductCategoryId || null,
          comparisonUnit: newProductComparisonUnit,
        });
        productId = product.id;
      } else if (!productId) {
        throw new Error("Kies een product.");
      }

      let productVariantId: string | null = null;
      if (variantMode === "existing") {
        if (!selectedVariantId)
          throw new Error(
            "Kies een bestaande variant, of kies 'Geen variant'.",
          );
        productVariantId = selectedVariantId;
      } else if (variantMode === "new") {
        if (!variantName.trim())
          throw new Error("Vul een naam voor de nieuwe variant in.");
        const trimmedSize = variantPackageSize.trim();
        const packageSize = trimmedSize ? Number(trimmedSize) : null;
        if (packageSize !== null) {
          if (!(packageSize > 0)) {
            throw new Error("Verpakkingsgrootte moet groter dan 0 zijn.");
          }
          if (!variantPackageUnit) {
            throw new Error("Kies een eenheid bij de verpakkingsgrootte.");
          }
        }
        const variant = await createProductVariant({
          productId,
          variantName,
          brand: variantBrand.trim() || null,
          storeId: variantStoreId || null,
          packageSize,
          packageUnit: packageSize !== null ? variantPackageUnit : null,
        });
        productVariantId = variant.id;
      }

      // Alias wordt hier nooit aangeraakt (updateAlias: false) — de
      // koppeling van de kassabonregel zelf staat na deze call altijd al
      // correct vast; de alias-keuze is een losse, optionele vervolgstap
      // (zie onSuccess), exact zoals de bestaande "ook koppelen"-stap na
      // een nieuwe match.
      await editReceiptItemMatch({
        receiptItemId: context.id,
        productId,
        productVariantId,
        updateAlias: false,
      });

      return { productId, productVariantId };
    },
    onSuccess: async ({ productId, productVariantId }) => {
      invalidateAfterEdit();
      if (!context) {
        onOpenChange(false);
        return;
      }
      try {
        const aliasExists = await findExistingAliasForReceiptItem(context.id);
        if (aliasExists) {
          setPendingAlias({ productId, productVariantId });
          return;
        }
      } catch {
        // Best-effort — als de aliascheck zelf faalt, gewoon sluiten; de
        // koppeling zelf is al veilig opgeslagen.
      }
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const aliasMutation = useMutation({
    mutationFn: async () => {
      if (!pendingAlias || !context) return;
      await editReceiptItemMatch({
        receiptItemId: context.id,
        productId: pendingAlias.productId,
        productVariantId: pendingAlias.productVariantId,
        updateAlias: true,
      });
    },
    onSuccess: () => {
      invalidateAfterEdit();
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const showVariantExistingOption =
    productMode === "existing" && !!selectedProductId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Productkoppeling bewerken</DialogTitle>
          <DialogDescription>
            Bondata wordt niet aangepast — alleen de koppeling naar product en
            variant.
          </DialogDescription>
        </DialogHeader>

        {contextQuery.isLoading && (
          <div className="py-8 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!contextQuery.isLoading && !context && (
          <p className="text-sm text-destructive">
            Kassabonregel kon niet worden geladen.
          </p>
        )}

        {context && (
          <>
            <div className="space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="font-medium text-foreground">{context.raw_name}</p>
              {context.raw_brand && (
                <p className="text-xs text-muted-foreground">
                  {context.raw_brand}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {context.store_name ?? "Onbekende winkel"} ·{" "}
                {formatDateLong(context.purchase_date)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrencyAmount(
                  context.paid_line_total ?? 0,
                  context.currency,
                )}
              </p>
            </div>

            {pendingAlias ? (
              <>
                <div className="space-y-2 text-sm">
                  <p className="rounded-lg bg-amber-50 p-2.5 text-amber-800">
                    Deze kassabonomschrijving wordt ook gebruikt voor
                    automatische herkenning bij{" "}
                    {context.store_name ?? "deze winkel"}.
                  </p>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Alleen deze aankoop aanpassen
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      aliasMutation.mutate();
                    }}
                    disabled={aliasMutation.isPending}
                    className="gap-2"
                  >
                    {aliasMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Alias ook bijwerken
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={productMode === "existing" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setProductMode("existing")}
                  >
                    Bestaand product
                  </Button>
                  <Button
                    type="button"
                    variant={productMode === "new" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setProductMode("new");
                      setVariantMode("none");
                      setSelectedVariantId("");
                    }}
                  >
                    Nieuw product
                  </Button>
                </div>

                {productMode === "existing" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Canoniek product
                    </label>
                    <select
                      className={selectClassName}
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setVariantMode("none");
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
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">
                        Naam
                      </label>
                      <Input
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="bijv. Wasabi pinda's"
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
                          onChange={(e) =>
                            setNewProductCategoryId(e.target.value)
                          }
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

                <div className="space-y-1.5 border-t border-border/50 pt-3">
                  <label className="text-xs text-muted-foreground">
                    Variant
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVariantMode("none")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        variantMode === "none"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/70 text-foreground hover:bg-muted/40"
                      }`}
                    >
                      Geen variant
                    </button>
                    {showVariantExistingOption && (
                      <button
                        type="button"
                        onClick={() => setVariantMode("existing")}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                          variantMode === "existing"
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/70 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        Bestaande variant
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVariantMode("new")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        variantMode === "new"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/70 text-foreground hover:bg-muted/40"
                      }`}
                    >
                      Nieuwe variant
                    </button>
                  </div>
                </div>

                {variantMode === "existing" && showVariantExistingOption && (
                  <div className="space-y-1.5">
                    {existingVariants.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Dit product heeft nog geen varianten.
                      </p>
                    ) : (
                      <select
                        className={selectClassName}
                        value={selectedVariantId}
                        onChange={(e) => setSelectedVariantId(e.target.value)}
                      >
                        <option value="">Kies een variant...</option>
                        {existingVariants.map((v) => {
                          const storeName = v.store_id
                            ? (stores.find((s) => s.id === v.store_id)
                                ?.canonical_name ?? "winkelgebonden")
                            : null;
                          return (
                            <option key={v.id} value={v.id}>
                              {formatVariantLabel(v, storeName)}
                              {!v.store_id
                                ? " · generiek / meerdere winkels"
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                )}

                {variantMode === "new" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">
                        Variantnaam
                      </label>
                      <Input
                        value={variantName}
                        onChange={(e) => setVariantName(e.target.value)}
                        placeholder="bijv. Biologische kwark 500 g"
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
                          Winkelbinding
                        </label>
                        <select
                          className={selectClassName}
                          value={variantStoreId}
                          onChange={(e) => setVariantStoreId(e.target.value)}
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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          Verpakkingsgrootte (optioneel — alleen als echt
                          bekend)
                        </label>
                        <Input
                          type="number"
                          step="any"
                          value={variantPackageSize}
                          onChange={(e) =>
                            setVariantPackageSize(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          Eenheid
                        </label>
                        <select
                          className={selectClassName}
                          value={variantPackageUnit}
                          onChange={(e) =>
                            setVariantPackageUnit(e.target.value)
                          }
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
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
