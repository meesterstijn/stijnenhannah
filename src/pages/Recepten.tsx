import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Recipe } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Clock, Users, Trash2, ChefHat, Loader2 } from "lucide-react";

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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(empty);
  const [view, setView] = useState<Recipe | null>(null);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: fetchRecipes,
  });

  const addRecipe = useMutation({
    mutationFn: async (recipe: typeof empty) => {
      const { error } = await supabase.from("recipes").insert(recipe);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setDraft(empty);
      setOpen(false);
    },
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl">
              <Plus className="h-4 w-4" /> Nieuw recept
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Nieuw recept</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
              <Textarea
                placeholder="Ingrediënten (één per regel)"
                rows={5}
                value={draft.ingredients}
                onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
              />
              <Textarea
                placeholder="Bereiding"
                rows={5}
                value={draft.steps}
                onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => draft.title.trim() && addRecipe.mutate(draft)}
                className="rounded-xl"
              >
                Opslaan
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
                  <h3 className="font-serif text-lg font-semibold mb-2">Ingrediënten</h3>
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
    </div>
  );
}
