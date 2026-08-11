import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Check, Loader2, Plus, RotateCcw, Trash2, Luggage, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModernPageHeader } from "@/components/modern-page-header";
import {
  ModernSection,
  ModernEmptyState,
  cardSurface,
} from "@/components/modern-surfaces";
import { JapanTravel } from "./JapanTravel";

type View = "home" | "paklijst" | "japan";

type PackingItem = {
  id: string;
  text: string;
  category: string;
  checked_stijn: boolean;
  checked_hannah: boolean;
  position: number;
};

type Person = "stijn" | "hannah";

const PERSONS: { key: Person; label: string }[] = [
  { key: "stijn", label: "Stijn" },
  { key: "hannah", label: "Hannah" },
];

const CATEGORIES = ["Documenten", "Kleding", "Toilettas", "Elektronica", "Overig"];

export default function Vakantie() {
  const [view, setView] = useState<View>("home");

  if (view === "paklijst") return <PackingListView onBack={() => setView("home")} />;
  if (view === "japan") return <JapanTravel onBack={() => setView("home")} />;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ModernPageHeader
        icon={Luggage}
        eyebrow="Overzicht"
        title="Vakantie"
        back={{ to: "/" }}
      />

      <ModernSection title="Onderdelen">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setView("paklijst")}
            className={`${cardSurface({ interactive: true })} flex items-center gap-4 text-left`}
          >
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Luggage className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-base font-semibold">Paklijst</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inpakken voor de reis
              </p>
            </div>
          </button>

          <button
            onClick={() => setView("japan")}
            className={`${cardSurface({ interactive: true })} flex items-center gap-4 text-left`}
          >
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-base font-semibold">Japan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zinnen &amp; vertaler
              </p>
            </div>
          </button>
        </div>
      </ModernSection>
    </div>
  );
}

function PackingListView({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const [person, setPerson] = useState<Person>("stijn");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("Overig");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["packing_items"],
    queryFn: async (): Promise<PackingItem[]> => {
      const { data, error } = await supabase
        .from("packing_items")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkedKey = person === "stijn" ? "checked_stijn" : "checked_hannah";

  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("packing_items")
        .update({ [checkedKey]: checked })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey: ["packing_items"] });
      const prev = queryClient.getQueryData<PackingItem[]>(["packing_items"]);
      queryClient.setQueryData<PackingItem[]>(["packing_items"], (old = []) =>
        old.map((i) => (i.id === id ? { ...i, [checkedKey]: checked } : i))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["packing_items"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["packing_items"] }),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const position = items.filter((i) => i.category === newCategory).length;
      const { error } = await supabase.from("packing_items").insert({
        text: newText.trim(),
        category: newCategory,
        checked_stijn: false,
        checked_hannah: false,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packing_items"] });
      setNewText("");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packing_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packing_items"] }),
  });

  const resetAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("packing_items")
        .update({ [checkedKey]: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packing_items"] }),
  });

  const total = items.length;
  const checked = items.filter((i) => i[checkedKey]).length;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ModernPageHeader
        icon={Luggage}
        eyebrow="Vakantie"
        title="Paklijst"
        back={{ onClick: onBack }}
        actions={
          checked > 0 ? (
            <button
              onClick={() => resetAll.mutate()}
              disabled={resetAll.isPending}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Uitvinken
            </button>
          ) : undefined
        }
      />

      <div className={`${cardSurface({ padding: "sm" })} space-y-4`}>
        <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
          {PERSONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPerson(p.key)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                person === p.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(checked / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {checked === total ? "Alles ingepakt!" : `${checked} van ${total}`}
            </span>
          </div>
        )}
      </div>

      <ModernSection title="Items">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <ModernEmptyState
            icon={Luggage}
            title="Nog geen items"
            description="Voeg hieronder je eerste paklijst-item toe."
          />
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              return (
                <div
                  key={cat}
                  className={`${cardSurface({ padding: "none" })} overflow-hidden`}
                >
                  <div className="px-5 py-2.5 bg-muted/30 border-b border-border/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {catItems.map((item) => {
                      const isChecked = item[checkedKey];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-5 py-3 group transition-colors hover:bg-accent/20"
                        >
                          <button
                            onClick={() => toggle.mutate({ id: item.id, checked: !isChecked })}
                            className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                              isChecked
                                ? "bg-primary border-primary"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                          </button>
                          <span className={`flex-1 text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                            {item.text}
                          </span>
                          <button
                            onClick={() => deleteItem.mutate(item.id)}
                            className="rounded-lg p-1 -m-1 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModernSection>

      <ModernSection title="Nieuw item">
        <div className={`${cardSurface()} space-y-3`}>
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="text-xs rounded-xl border border-border/70 bg-background/60 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Item toevoegen…"
              className="flex-1 bg-background/60 border-border/50 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newText.trim()) addItem.mutate();
              }}
            />
          </div>
          <Button
            className="w-full rounded-xl gap-1"
            disabled={!newText.trim() || addItem.isPending}
            onClick={() => addItem.mutate()}
          >
            {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Toevoegen</>}
          </Button>
        </div>
      </ModernSection>
    </div>
  );
}
