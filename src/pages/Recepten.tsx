import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Recipe } from "@/lib/supabase";
import { saveToHistory } from "@/lib/history";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { HistoryPicker } from "@/components/history-picker";
import { KitchenTimer } from "@/components/kitchen-timer";
import {
  type Ingredient,
  ingredientsToText,
  textToIngredients,
  ingredientDisplayLine,
} from "@/lib/ingredients";
import {
  Plus, Clock, Users, Trash2, ChefHat, Loader2, X, Check, ShoppingBasket, Pencil, Download,
} from "lucide-react";

const RECIPE_CATEGORIES = ["Brood", "Gebak", "Gerechten"] as const;
type RecipeCategory = typeof RECIPE_CATEGORIES[number];

const empty = { title: "", time: "", servings: "", ingredients: "", steps: "", category: "Gerechten" };

function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cat: RecipeCategory) => void;
}) {
  return (
    <div className="flex gap-2">
      {RECIPE_CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            value === cat
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

function IngredientsEditor({
  ingredients,
  setIngredients,
  onPickFromHistory,
}: {
  ingredients: Ingredient[];
  setIngredients: Dispatch<SetStateAction<Ingredient[]>>;
  onPickFromHistory: () => void;
}) {
  const [bulkText, setBulkText] = useState("");

  function updateIngredient(index: number, field: "name" | "amount", value: string) {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function processBulk() {
    const parsed = textToIngredients(bulkText).filter((i) => i.name.trim());
    if (parsed.length === 0) return;
    setIngredients((prev) => [...prev, ...parsed]);
    setBulkText("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Ingrediënten</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={onPickFromHistory}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Kies uit lijst
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => setIngredients((prev) => [...prev, { name: "", amount: "" }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Voeg toe
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Textarea
          placeholder={"Plak hier in één keer alle ingrediënten, bv:\n200g bloem\n2 eieren\n1 el suiker"}
          rows={3}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          className="text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-lg text-xs w-full"
          onClick={processBulk}
          disabled={!bulkText.trim()}
        >
          Verwerk geplakte tekst
        </Button>
      </div>

      {ingredients.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          Nog geen ingrediënten — plak een lijst hierboven, kies uit je lijst, of typ hieronder.
        </p>
      )}

      <div className="space-y-2">
        {ingredients.map((ing, i) => (
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
  );
}

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
  const [pickerTarget, setPickerTarget] = useState<"add" | "edit">("add");
  const [addingToList, setAddingToList] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | "Alles">("Alles");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState(empty);
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: fetchRecipes,
  });

  function handleExport() {
    const data = recipes.map(({ id: _id, created_at: _ca, ...r }) => r);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recepten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

  const updateRecipe = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & typeof empty) => {
      const { error } = await supabase.from("recipes").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id, ...fields }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setView((prev) => (prev && prev.id === id ? { ...prev, ...fields } : prev));
      setEditMode(false);
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const [categoryError, setCategoryError] = useState<string | null>(null);

  const updateCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from("recipes").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { category }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setView((prev) => prev ? { ...prev, category } : null);
      setCategoryError(null);
    },
    onError: (err: Error) => setCategoryError(err.message),
  });

  function handleOpenDialog(val: boolean) {
    setOpen(val);
    if (!val) { setDraft(empty); setIngredientList([]); }
  }

  function addIngredientFromHistory(names: string[]) {
    const additions = names.map((name) => ({ name, amount: "" }));
    if (pickerTarget === "edit") {
      setEditIngredients((prev) => [...prev, ...additions]);
    } else {
      setIngredientList((prev) => [...prev, ...additions]);
    }
    setPickerOpen(false);
  }

  function openPicker(target: "add" | "edit") {
    setPickerTarget(target);
    setPickerOpen(true);
  }

  function handleSave() {
    if (!draft.title.trim()) return;
    ingredientList.forEach((i) => { if (i.name.trim()) saveToHistory(i.name.trim()); });
    const ingredients = ingredientsToText(ingredientList);
    addRecipe.mutate({ ...draft, ingredients });
  }

  function startEdit() {
    if (!view) return;
    setEditDraft({
      title: view.title,
      time: view.time || "",
      servings: view.servings || "",
      ingredients: view.ingredients || "",
      steps: view.steps || "",
      category: view.category || "Gerechten",
    });
    setEditIngredients(textToIngredients(view.ingredients || ""));
    setSaveError(null);
    setEditMode(true);
  }

  function handleSaveEdit() {
    if (!view || !editDraft.title.trim()) return;
    editIngredients.forEach((i) => { if (i.name.trim()) saveToHistory(i.name.trim()); });
    const ingredients = ingredientsToText(editIngredients);
    updateRecipe.mutate({ id: view.id, ...editDraft, ingredients });
  }

  async function addAllToShoppingList() {
    if (!view?.ingredients) return;
    setAddingToList(true);
    const ingredients = textToIngredients(view.ingredients);
    for (const { name } of ingredients) {
      if (name.trim()) await supabase.from("groceries").insert({ text: name.trim(), done: false });
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={recipes.length === 0} className="rounded-xl gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporteer</span>
          </Button>
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
              <CategoryPicker
                value={draft.category}
                onChange={(cat) => setDraft({ ...draft, category: cat })}
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

              <IngredientsEditor
                ingredients={ingredientList}
                setIngredients={setIngredientList}
                onPickFromHistory={() => openPicker("add")}
              />

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
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <KitchenTimer defaultLabel="Timer 1" storageKey="kitchen-timer-label-1" />
        <KitchenTimer defaultLabel="Timer 2" storageKey="kitchen-timer-label-2" />
        <KitchenTimer defaultLabel="Timer 3" storageKey="kitchen-timer-label-3" />
      </div>

      {!isLoading && recipes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {(["Alles", ...RECIPE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
          {recipes
            .filter((r) => activeCategory === "Alles" || r.category === activeCategory)
            .map((r) => (
            <button
              key={r.id}
              onClick={() => setView(r)}
              className="text-left rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3"
            >
              <p className="font-serif text-xl font-semibold leading-snug">{r.title}</p>
              <div className="flex items-center justify-between gap-2 mt-auto">
                <div className="flex gap-3 text-xs text-muted-foreground">
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
                {r.category && activeCategory === "Alles" && (
                  <span className="text-xs text-muted-foreground/70">{r.category}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!view} onOpenChange={(o) => { if (!o) { setView(null); setConfirmDelete(false); setEditMode(false); } }}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-none sm:rounded-2xl">
          {view && editMode ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl sm:text-3xl leading-snug">Recept bewerken</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Naam van het gerecht"
                  value={editDraft.title}
                  onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                />
                <CategoryPicker
                  value={editDraft.category}
                  onChange={(cat) => setEditDraft({ ...editDraft, category: cat })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Tijd (bv. 30 min)"
                    value={editDraft.time}
                    onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })}
                  />
                  <Input
                    placeholder="Personen (bv. 2)"
                    value={editDraft.servings}
                    onChange={(e) => setEditDraft({ ...editDraft, servings: e.target.value })}
                  />
                </div>

                <IngredientsEditor
                  ingredients={editIngredients}
                  setIngredients={setEditIngredients}
                  onPickFromHistory={() => openPicker("edit")}
                />

                <Textarea
                  placeholder="Bereiding"
                  rows={5}
                  value={editDraft.steps}
                  onChange={(e) => setEditDraft({ ...editDraft, steps: e.target.value })}
                />
              </div>
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => { setEditMode(false); setSaveError(null); }}
                >
                  Annuleer
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editDraft.title.trim() || updateRecipe.isPending}
                  className="rounded-xl"
                >
                  {updateRecipe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
                </Button>
              </DialogFooter>
            </>
          ) : view ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl sm:text-3xl leading-snug">{view.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
              <div className="space-y-1.5">
                <div className="flex gap-2 flex-wrap">
                  {RECIPE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => updateCategory.mutate({ id: view.id, category: cat })}
                      disabled={updateCategory.isPending}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        view.category === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {categoryError && (
                  <p className="text-xs text-destructive">{categoryError}</p>
                )}
              </div>
              {view.ingredients && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs"
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
                  <h3 className="font-serif text-lg font-semibold">Ingrediënten</h3>
                  <ul className="space-y-1 text-sm">
                    {view.ingredients.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">·</span> {ingredientDisplayLine(line)}
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
                {confirmDelete ? (
                  <div className="flex items-center gap-3 w-full sm:justify-end">
                    <span className="text-sm text-muted-foreground">Weet je het zeker?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Annuleer
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => removeRecipe.mutate(view.id)}
                      disabled={removeRecipe.isPending}
                    >
                      {removeRecipe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ja, verwijder"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Verwijder
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={startEdit}>
                      <Pencil className="h-4 w-4" /> Bewerken
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <HistoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdd={addIngredientFromHistory}
        title="Kies ingrediënten"
      />
    </div>
  );
}

