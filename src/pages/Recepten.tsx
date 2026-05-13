import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Recipe } from "@/lib/supabase";
import { getHistory, removeFromHistory, parseItem, saveToHistory } from "@/lib/history";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Clock, Users, Trash2, ChefHat, Loader2, X, Check, ShoppingBasket,
} from "lucide-react";

type Ingredient = { name: string; amount: string };

function ingredientsToText(list: Ingredient[]): string {
  return list
    .filter((i) => i.name.trim())
    .map((i) => (i.amount.trim() ? `${i.amount.trim()} ${i.name.trim()}` : i.name.trim()))
    .join("\n");
}

function textToIngredients(text: string): Ingredient[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([0-9][^\s]*\s+|[0-9]+\s+)?(.+)$/);
      if (m && m[1]) return { amount: m[1].trim(), name: m[2].trim() };
      return { amount: "", name: line.trim() };
    });
}

const empty = { title: "", time: "", servings: "", ingredients: "", steps: "" };

async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Recepten() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(empty);
  const [ingredientList, setIngredientList] = useState<Ingredient[]>([]);
  const [view, setView] = useState<Recipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: fetchRecipes,
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const addRecipe = useMutation({
    mutationFn: async (recipe: typeof empty) => {
      const { error } = await supabase.from("recipes").insert({
        ...recipe,
        created_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setDraft(empty);
      setIngredientList([]);
      setSaveError(null);
      setOpen(false);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const removeRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setView(null);
    },
  });

  function handleOpenDialog(val: boolean) {
    setOpen(val);
    if (!val) { setDraft(empty); setIngredientList([]); }
  }

  function addIngredientFromHistory(names: string[]) {
    setIngredientList((prev) => [
      ...prev,
      ...names.map((name) => ({ name, amount: "" })),
    ]);
    setPickerOpen(false);
  }

  function updateIngredient(index: number, field: "name" | "amount", value: string) {
    setIngredientList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeIngredient(index: number) {
    setIngredientList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!draft.title.trim()) return;
    ingredientList.forEach((i) => { if (i.name.trim()) saveToHistory(i.name.trim()); });
    const ingredients = ingredientsToText(ingredientList);
    addRecipe.mutate({ ...draft, ingredients });
  }

  async function addAllToShoppingList() {
    if (!view?.ingredients) return;
    setAddingToList(true);
    const lines = view.ingredients.split("\n").filter(Boolean);
    for (const line of lines) {
      await supabase.from("groceries").insert({ text: line, done: false });
    }
    queryClient.invalidateQueries({ queryKey: ["groceries"] });
    setAddingToList(false);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Onze keuken</p>
          <h1 className="font-serif text-4xl font-semibold mt-2">Recepten</h1>
          <p className="text-muted-foreground mt-2">
            Bewaar gerechten die jullie graag samen maken.
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenDialog}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl">
              <Plus className="h-4 w-4" /> Nieuw recept
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Nieuw recept</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Naam van het gerecht"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Tijd (bv. 30 min)"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                />
                <Input
                  placeholder="Personen (bv. 2)"
                  value={draft.servings}
                  onChange={(e) => setDraft({ ...draft, servings: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Ingrediënten</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Kies uit lijst
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => setIngredientList((prev) => [...prev, { name: "", amount: "" }])}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Voeg toe
                    </Button>
                  </div>
                </div>

                {ingredientList.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    Nog geen ingrediënten — kies uit je lijst of typ hieronder.
                  </p>
                )}

                <div className="space-y-2">
                  {ingredientList.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={ing.amount}
                        onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                        placeholder="200g / 2x / 1L"
                        className="w-28 shrink-0 text-sm"
                      />
                      <Input
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, "name", e.target.value)}
                        placeholder="product"
                        className="flex-1 text-sm"
                      />
                      <button
                        onClick={() => removeIngredient(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

              </div>

              <Textarea
                placeholder="Bereiding"
                rows={5}
                value={draft.steps}
                onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
              />
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <DialogFooter>
              <Button
                onClick={handleSave}
                disabled={!draft.title.trim() || addRecipe.isPending}
                className="rounded-xl"
              >
                {addRecipe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="flex justify-center text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center">
          <ChefHat className="h-10 w-10 mx-auto text-muted-foreground" strokeWidth={1.4} />
          <p className="font-serif text-xl mt-4">Nog geen recepten</p>
          <p className="text-sm text-muted-foreground mt-1">
            Voeg jullie eerste favoriete gerecht toe.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => setView(r)}
              className="text-left rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="font-serif text-xl font-semibold">{r.title}</p>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {r.time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {r.time}
                  </span>
                )}
                {r.servings && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {r.servings}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-3xl">{view.title}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-4 text-sm text-muted-foreground">
                {view.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {view.time}
                  </span>
                )}
                {view.servings && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> {view.servings} personen
                  </span>
                )}
              </div>
              {view.ingredients && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif text-lg font-semibold">Ingrediënten</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={addAllToShoppingList}
                      disabled={addingToList}
                    >
                      {addedFeedback ? (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Toegevoegd!</>
                      ) : addingToList ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <><ShoppingBasket className="h-3.5 w-3.5 mr-1" /> Toevoegen aan boodschappenlijst</>
                      )}
                    </Button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {view.ingredients.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">·</span> {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {view.steps && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-2">Bereiding</h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{view.steps}</p>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => removeRecipe.mutate(view.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Verwijder
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <IngredientPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdd={addIngredientFromHistory}
      />
    </div>
  );
}

function IngredientPickerSheet({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (names: string[]) => void;
}) {
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setHistory(getHistory());
      setSelected(new Set());
      setDeleteMode(false);
      setToDelete(new Set());
    }
  }, [open]);

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

  function confirmDelete() {
    toDelete.forEach(removeFromHistory);
    setHistory((prev) => prev.filter((h) => !toDelete.has(h)));
    setToDelete(new Set());
    setDeleteMode(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="rounded-b-2xl max-h-[80vh] flex flex-col">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle>Kies ingrediënten</SheetTitle>
            {history.length > 0 && (
              deleteMode ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-xl text-xs"
                    onClick={() => { setDeleteMode(false); setToDelete(new Set()); }}>
                    Annuleer
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-xl text-xs"
                    disabled={toDelete.size === 0} onClick={confirmDelete}>
                    Verwijder {toDelete.size > 0 ? toDelete.size : ""}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={() => setDeleteMode(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Beheer lijst
                </Button>
              )
            )}
          </div>
        </SheetHeader>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nog geen geschiedenis — voeg eerst boodschappen toe via de boodschappenlijst.
          </p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 py-2">
                {history.map((item) => {
                  const isSelected = !deleteMode && selected.has(item);
                  const isMarkedDelete = deleteMode && toDelete.has(item);
                  return (
                    <button
                      key={item}
                      onClick={() => deleteMode ? toggleToDelete(item) : toggleSelect(item)}
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
                  );
                })}
              </div>
            </div>
            {!deleteMode && (
              <div className="pt-4 pb-2">
                <Button
                  className="w-full rounded-xl"
                  disabled={selected.size === 0}
                  onClick={() => onAdd(Array.from(selected))}
                >
                  {selected.size === 0
                    ? "Selecteer ingrediënten"
                    : `Voeg ${selected.size} toe`}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
