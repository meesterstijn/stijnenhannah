import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Plus, X, LayoutList } from "lucide-react";
import { getHistory, removeFromHistory, updateInHistory } from "@/lib/history";
import {
  getCategories, saveCategories, getAssignments, assignCategory,
  removeAssignmentsForCategory, type Category,
} from "@/lib/categories";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (names: string[]) => void;
  title?: string;
  historyTable?: string;
};

type Mode = "pick" | "delete" | "manage";

export function HistoryPicker({ open, onOpenChange, onAdd, title = "Eerder toegevoegd", historyTable = "product_history" }: Props) {
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: [historyTable],
    queryFn: () => getHistory(historyTable),
    enabled: open,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories"],
    queryFn: getCategories,
    enabled: open,
  });
  const { data: assignments = {} } = useQuery({
    queryKey: ["product_assignments"],
    queryFn: getAssignments,
    enabled: open,
  });

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("pick");
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setMode("pick");
      setToDelete(new Set());
      setActiveCategory("all");
      setEditingItem(null);
    }
  }, [open]);

  useEffect(() => {
    if (editingItem !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingItem]);

  async function commitEdit() {
    if (!editingItem) return;
    await updateInHistory(editingItem, editValue, historyTable);
    queryClient.invalidateQueries({ queryKey: [historyTable] });
    setEditingItem(null);
  }

  function toggleSelect(item: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  function toggleToDelete(item: string) {
    setToDelete((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  async function confirmDelete() {
    await Promise.all(Array.from(toDelete).map((item) => removeFromHistory(item, historyTable)));
    setToDelete(new Set());
    setMode("pick");
    queryClient.invalidateQueries({ queryKey: [historyTable] });
  }

  async function handleAssign(product: string, categoryId: string) {
    await assignCategory(product, categoryId === "none" ? null : categoryId);
    queryClient.invalidateQueries({ queryKey: ["product_assignments"] });
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

  const visibleItems =
    activeCategory === "all"
      ? history
      : activeCategory === "none"
      ? history.filter((h) => !assignments[h.toLowerCase()])
      : history.filter((h) => assignments[h.toLowerCase()] === activeCategory);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="rounded-b-2xl max-h-[85vh] flex flex-col [&>button.absolute]:hidden">
        <SheetHeader className="pb-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="hidden">{mode === "manage" ? "Categorieën beheren" : title}</SheetTitle>
            <div className="flex gap-2">
              {mode === "pick" && (
                <>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs text-muted-foreground"
                    onClick={() => setMode("manage")}>
                    <LayoutList className="h-3.5 w-3.5" />
                  </Button>
                  {history.length > 0 && (
                    <Button variant="outline" size="sm" className="rounded-xl text-xs text-muted-foreground"
                      onClick={() => setMode("delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
              {mode === "delete" && (
                <>
                  <Button variant="ghost" size="sm" className="rounded-xl text-xs"
                    onClick={() => { setMode("pick"); setToDelete(new Set()); }}>
                    Annuleer
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-xl text-xs"
                    disabled={toDelete.size === 0} onClick={confirmDelete}>
                    Verwijder {toDelete.size > 0 ? toDelete.size : ""}
                  </Button>
                </>
              )}
              {mode === "manage" && (
                <Button variant="ghost" size="sm" className="rounded-xl text-xs"
                  onClick={() => setMode("pick")}>
                  Terug
                </Button>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {mode === "manage" ? (
          <ManageCategories
            categories={categories}
            history={history}
            assignments={assignments}
            newCatName={newCatName}
            onNewCatNameChange={setNewCatName}
            onAddCategory={addCategory}
            onRemoveCategory={removeCategory}
            onAssign={handleAssign}
          />
        ) : (
          <>
            {categories.length > 0 && history.length > 0 && (
              <div className="shrink-0 flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-none">
                {[{ id: "all", name: "Alles" }, ...categories].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nog geen geschiedenis — voeg eerst producten toe.
              </p>
            ) : visibleItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Geen producten in deze categorie.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-wrap gap-3 py-2">
                  {visibleItems.map((item) => {
                    const isSelected = mode === "pick" && selected.has(item);
                    const isMarkedDelete = mode === "delete" && toDelete.has(item);
                    const isEditing = editingItem === item;

                    if (isEditing) {
                      return (
                        <div key={item} className="px-3 py-2 rounded-2xl border border-primary bg-card flex items-center gap-1">
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                              if (e.key === "Escape") setEditingItem(null);
                            }}
                            className="bg-transparent text-sm font-medium focus:outline-none w-28"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={item} className="relative group">
                        <button
                          onClick={() => mode === "delete" ? toggleToDelete(item) : toggleSelect(item)}
                          className={`px-3 py-4 rounded-2xl border text-sm font-medium text-center transition-colors leading-tight ${
                            isMarkedDelete
                              ? "bg-destructive border-destructive text-destructive-foreground"
                              : isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-card border-border text-foreground"
                          }`}
                        >
                          {item}
                        </button>
                        {mode === "pick" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditValue(item); setEditingItem(item); }}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Bewerk"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "pick" && history.length > 0 && (
              <div className="pt-4 pb-2 shrink-0">
                <Button className="w-full rounded-xl" disabled={selected.size === 0}
                  onClick={() => onAdd(Array.from(selected))}>
                  {selected.size === 0 ? "Selecteer producten" : `Voeg ${selected.size} toe`}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ManageCategories({
  categories, history, assignments, newCatName,
  onNewCatNameChange, onAddCategory, onRemoveCategory, onAssign,
}: {
  categories: Category[];
  history: string[];
  assignments: Record<string, string>;
  newCatName: string;
  onNewCatNameChange: (v: string) => void;
  onAddCategory: () => void;
  onRemoveCategory: (id: string) => void;
  onAssign: (product: string, categoryId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Categorieën</p>
        <div className="flex gap-2">
          <Input
            value={newCatName}
            onChange={(e) => onNewCatNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddCategory()}
            placeholder="Nieuwe categorie..."
            className="text-sm"
          />
          <Button size="icon" onClick={onAddCategory} className="shrink-0 rounded-xl">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat) => (
            <div key={cat.id}
              className="flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-xl border border-border bg-card text-sm">
              <span>{cat.name}</span>
              <button onClick={() => onRemoveCategory(cat.id)}
                className="h-5 w-5 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive transition-colors">
                <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Producten indelen</p>
          <div className="space-y-1">
            {history.map((product) => {
              const current = assignments[product.toLowerCase()] ?? "none";
              return (
                <div key={product} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-sm">{product}</span>
                  <select
                    value={current}
                    onChange={(e) => onAssign(product, e.target.value)}
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground"
                  >
                    <option value="none">— geen —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
