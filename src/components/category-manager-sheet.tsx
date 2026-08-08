import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Pencil, Plus, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getHistory, saveToHistory } from "@/lib/history";
import {
  getCategories,
  saveCategories,
  getAssignments,
  assignCategory,
  removeAssignmentsForCategory,
  type Category,
} from "@/lib/categories";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  historyTable?: string;
};

// Dit is het enige boodschappen-/categoriebeheerscherm van de pagina (zie
// Boodschappen.tsx: de menuknop opent 'm direct, geen tussenoverzicht meer).
// Bewust een NIEUW bestand i.p.v. het "manage"-gedeelte van HistoryPicker te
// hergebruiken: history-picker.tsx wordt ook door Recepten.tsx gebruikt (voor
// het kiezen van ingrediënten uit geschiedenis) en mag dus niet aangepast
// worden voor deze Boodschappen-specifieke flow. De onderliggende databron
// (getCategories/saveCategories/getAssignments/assignCategory uit
// lib/categories.ts, getHistory/saveToHistory uit lib/history.ts) is wél
// exact dezelfde als voorheen — geen nieuwe tabellen, geen nieuw datamodel.
export function CategoryManagerSheet({ open, onOpenChange, historyTable = "product_history" }: Props) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: getCategories,
    enabled: open,
  });
  const { data: history = [] } = useQuery({
    queryKey: [historyTable],
    queryFn: () => getHistory(historyTable),
    enabled: open,
  });
  const { data: assignments = {} } = useQuery({
    queryKey: ["product_assignments"],
    queryFn: getAssignments,
    enabled: open,
  });

  const [newCatName, setNewCatName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Zelfde bulk-vervang-primitief (delete-alles + her-insert met sort_order =
  // arrayindex) als de oude omhoog/omlaag-knoppen al gebruikten — geen tweede
  // opslagmechanisme voor volgorde. Optimistisch bijgewerkt in de query-cache
  // zodat het slepen meteen voelt, met rollback bij een mislukte save.
  const reorder = useMutation({
    mutationFn: (next: Category[]) => saveCategories(next),
    onMutate: async (next) => {
      setReorderError(null);
      await queryClient.cancelQueries({ queryKey: ["product_categories"] });
      const previous = queryClient.getQueryData<Category[]>(["product_categories"]);
      queryClient.setQueryData(["product_categories"], next);
      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) queryClient.setQueryData(["product_categories"], context.previous);
      setReorderError("Volgorde opslaan is mislukt. Probeer het opnieuw.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["product_categories"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorder.mutate(arrayMove(categories, oldIndex, newIndex));
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const id = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    await saveCategories([...categories, { id, name }]);
    queryClient.invalidateQueries({ queryKey: ["product_categories"] });
    setNewCatName("");
  }

  async function removeCategory(id: string) {
    await saveCategories(categories.filter((c) => c.id !== id));
    await removeAssignmentsForCategory(id);
    queryClient.invalidateQueries({ queryKey: ["product_categories"] });
    queryClient.invalidateQueries({ queryKey: ["product_assignments"] });
  }

  function startRename(cat: Category) {
    setRenaming(cat.id);
    setRenameValue(cat.name);
  }

  async function commitRename() {
    const id = renaming;
    setRenaming(null);
    if (!id) return;
    const name = renameValue.trim();
    const current = categories.find((c) => c.id === id);
    if (!name || !current || name === current.name) return;
    await saveCategories(categories.map((c) => (c.id === id ? { ...c, name } : c)));
    queryClient.invalidateQueries({ queryKey: ["product_categories"] });
  }

  async function unassign(product: string) {
    await assignCategory(product, null);
    queryClient.invalidateQueries({ queryKey: ["product_assignments"] });
  }

  async function assignFromDropdown(product: string, categoryId: string) {
    await assignCategory(product, categoryId === "none" ? null : categoryId);
    queryClient.invalidateQueries({ queryKey: ["product_assignments"] });
  }

  async function addProduct(categoryId: string) {
    const name = newProductName.trim();
    if (!name) return;
    await saveToHistory(name, historyTable);
    await assignCategory(name, categoryId);
    queryClient.invalidateQueries({ queryKey: [historyTable] });
    queryClient.invalidateQueries({ queryKey: ["product_assignments"] });
    setNewProductName("");
    setAddingProductTo(null);
  }

  const productsByCategory = new Map<string, string[]>();
  const unassigned: string[] = [];
  for (const product of history) {
    const catId = assignments[product.toLowerCase()];
    if (catId && categories.some((c) => c.id === catId)) {
      productsByCategory.set(catId, [...(productsByCategory.get(catId) ?? []), product]);
    } else {
      unassigned.push(product);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="shopping-page category-manager w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-0 flex flex-col gap-0 [&>button.absolute]:hidden"
      >
        <div className="shrink-0 flex items-center gap-2 border-b border-border/60 bg-white px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Sluiten"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground truncate">Boodschappen beheren</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[700px] mx-auto space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categorieën
              </p>

              {reorderError && <p className="text-sm text-destructive">{reorderError}</p>}

              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nog geen categorieën.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <CategoryRow
                          key={cat.id}
                          category={cat}
                          products={productsByCategory.get(cat.id) ?? []}
                          isRenaming={renaming === cat.id}
                          renameValue={renameValue}
                          onRenameValueChange={setRenameValue}
                          onStartRename={() => startRename(cat)}
                          onCommitRename={commitRename}
                          onCancelRename={() => setRenaming(null)}
                          onRemove={() => removeCategory(cat.id)}
                          onUnassignProduct={unassign}
                          isAddingProduct={addingProductTo === cat.id}
                          newProductName={newProductName}
                          onNewProductNameChange={setNewProductName}
                          onStartAddProduct={() => {
                            setAddingProductTo(cat.id);
                            setNewProductName("");
                          }}
                          onCancelAddProduct={() => setAddingProductTo(null)}
                          onSubmitAddProduct={() => addProduct(cat.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="Nieuwe categorie..."
                  className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={!newCatName.trim()}
                  className="shrink-0 h-9 px-3 rounded-lg border border-border/70 bg-white text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Categorie toevoegen
                </button>
              </div>
            </div>

            {unassigned.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Niet ingedeeld
                </p>
                <div className="rounded-xl border border-border/60 bg-white divide-y divide-border/40">
                  {unassigned.map((product) => (
                    <div key={product} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="text-foreground truncate">{product}</span>
                      <select
                        value="none"
                        onChange={(e) => assignFromDropdown(product, e.target.value)}
                        className="text-xs border border-border/70 rounded-lg px-2 py-1 bg-white text-foreground shrink-0"
                      >
                        <option value="none">— kies categorie —</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CategoryRow({
  category,
  products,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRemove,
  onUnassignProduct,
  isAddingProduct,
  newProductName,
  onNewProductNameChange,
  onStartAddProduct,
  onCancelAddProduct,
  onSubmitAddProduct,
}: {
  category: Category;
  products: string[];
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRemove: () => void;
  onUnassignProduct: (product: string) => void;
  isAddingProduct: boolean;
  newProductName: string;
  onNewProductNameChange: (v: string) => void;
  onStartAddProduct: () => void;
  onCancelAddProduct: () => void;
  onSubmitAddProduct: () => void;
}) {
  // Slepen kan alleen vanaf de greep (attributes/listeners staan alleen op
  // de GripVertical-knop hieronder) — zo starten hernoemen/verwijderen/
  // product-toevoegen nooit per ongeluk een sleepactie, en blijft scrollen
  // door de rest van de lijst overal elders gewoon werken.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border/60 bg-white overflow-hidden"
    >
      <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-2 border-b border-border/40">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${category.name} verslepen om te herordenen`}
          className="touch-none shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {isRenaming ? (
          <input
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitRename();
              }
              if (e.key === "Escape") onCancelRename();
            }}
            autoFocus
            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-foreground/30 focus:outline-none py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={onStartRename}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-sm font-medium text-foreground group"
          >
            <span className="truncate">{category.name}</span>
            <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
          </button>
        )}

        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {products.length}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${category.name} verwijderen`}
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2 space-y-1">
        {products.length === 0 && !isAddingProduct && (
          <p className="text-xs text-muted-foreground/70 py-1">Nog geen producten.</p>
        )}
        {products.map((product) => (
          <div key={product} className="flex items-center justify-between gap-2 py-1 text-sm">
            <span className="text-foreground truncate">{product}</span>
            <button
              type="button"
              onClick={() => onUnassignProduct(product)}
              aria-label={`${product} uit ${category.name} halen`}
              className="shrink-0 h-6 w-6 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {isAddingProduct ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitAddProduct();
            }}
            className="flex gap-1.5 pt-1"
          >
            <input
              value={newProductName}
              onChange={(e) => onNewProductNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onCancelAddProduct()}
              placeholder="Productnaam..."
              autoFocus
              className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              type="submit"
              disabled={!newProductName.trim()}
              className="shrink-0 h-8 px-2.5 rounded-lg border border-border/70 text-xs font-medium hover:bg-muted/40 disabled:opacity-40 transition-colors"
            >
              Toevoegen
            </button>
            <button
              type="button"
              onClick={onCancelAddProduct}
              aria-label="Annuleer"
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onStartAddProduct}
            className="pt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Product toevoegen
          </button>
        )}
      </div>
    </div>
  );
}
