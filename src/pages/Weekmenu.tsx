import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type WeekPlanRow } from "@/lib/supabase";
import { textToIngredients } from "@/lib/ingredients";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModernPageHeader } from "@/components/modern-page-header";
import { ModernSection, cardSurface } from "@/components/modern-surfaces";
import { CalendarDays, Loader2, ShoppingBasket, Check, ChefHat, Download } from "lucide-react";

const days = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

const START_DAY_OPTIONS = [
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
] as const;
type StartDay = (typeof START_DAY_OPTIONS)[number]["key"];

function reorderFromStartDay(startKey: StartDay) {
  const startIdx = days.findIndex((d) => d.key === startKey);
  return [...days.slice(startIdx), ...days.slice(0, startIdx)];
}

type DayPlan = { meal: string; recipe_id: string | null };

async function fetchPlan(): Promise<Record<string, DayPlan>> {
  const { data, error } = await supabase.from("weekplan").select("*");
  if (error) throw error;
  return Object.fromEntries(
    (data as WeekPlanRow[]).map((r) => [
      r.day,
      { meal: r.meal, recipe_id: r.recipe_id },
    ]),
  );
}

async function fetchRecipeOptions(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title")
    .order("title");
  if (error) throw error;
  return data ?? [];
}

export default function Weekmenu() {
  const queryClient = useQueryClient();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayKey = days[todayIdx].key;

  const [startDay, setStartDay] = useLocalStorage<StartDay>(
    "weekmenu-start-day",
    "zo",
  );
  const orderedDays = reorderFromStartDay(startDay);

  const { data: plan = {}, isLoading } = useQuery({
    queryKey: ["weekplan"],
    queryFn: fetchPlan,
  });

  function handleExport() {
    const data = Object.values(plan);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekmenu-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const { data: recipeOptions = [] } = useQuery({
    queryKey: ["recipe-options"],
    queryFn: fetchRecipeOptions,
  });

  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const saveDay = useMutation({
    mutationFn: async ({
      day,
      meal,
      recipe_id,
    }: {
      day: string;
      meal: string;
      recipe_id: string | null;
    }) => {
      const { error } = await supabase
        .from("weekplan")
        .upsert({ day, meal, recipe_id }, { onConflict: "day" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekplan"] }),
  });

  const clearWeek = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weekplan").delete().neq("day", "");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["weekplan"] }),
  });

  const linkedRecipeIds = [
    ...new Set(
      Object.values(plan)
        .map((p) => p.recipe_id)
        .filter((id): id is string => !!id),
    ),
  ];

  async function generateShoppingList() {
    if (linkedRecipeIds.length === 0) return;
    setGenerating(true);
    setGenerateError(null);
    setGeneratedCount(null);
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("ingredients")
        .in("id", linkedRecipeIds);
      if (error) throw error;

      const seen = new Set<string>();
      const items: string[] = [];
      for (const recipe of data ?? []) {
        for (const { name } of textToIngredients(recipe.ingredients ?? "")) {
          const trimmed = name.trim();
          const key = trimmed.toLowerCase();
          if (!trimmed || seen.has(key)) continue;
          seen.add(key);
          items.push(trimmed);
        }
      }

      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from("groceries")
          .insert(items.map((text) => ({ text, done: false })));
        if (insertError) throw insertError;
        queryClient.invalidateQueries({ queryKey: ["groceries"] });
      }
      setGeneratedCount(items.length);
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <ModernPageHeader
        icon={CalendarDays}
        eyebrow="Wat eten we deze week?"
        title="Weekmenu"
        description="Vul per dag in wat jullie eten, of koppel een opgeslagen recept. Wijzigingen worden meteen opgeslagen."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={Object.keys(plan).length === 0} className="rounded-xl gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporteer</span>
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Week begint op</p>
        <div className="flex gap-2">
          {START_DAY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStartDay(opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                startDay === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ModernSection title="Boodschappenlijst">
        <div className={`${cardSurface()} space-y-3`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-serif text-lg font-semibold">
                Boodschappenlijst voor de week
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {linkedRecipeIds.length > 0
                  ? `${linkedRecipeIds.length} ${linkedRecipeIds.length === 1 ? "recept" : "recepten"} gekoppeld deze week.`
                  : "Koppel eerst een recept aan een dag hieronder."}
              </p>
            </div>
            <Button
              onClick={generateShoppingList}
              disabled={linkedRecipeIds.length === 0 || generating}
              className="rounded-xl shrink-0"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShoppingBasket className="h-4 w-4" /> Genereer lijst
                </>
              )}
            </Button>
          </div>
          {generatedCount !== null && (
            <p className="text-sm text-primary flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              {generatedCount > 0
                ? `${generatedCount} ${generatedCount === 1 ? "product" : "producten"} toegevoegd aan je boodschappenlijst.`
                : "Geen ingrediënten gevonden bij de gekoppelde recepten."}
            </p>
          )}
          {generateError && (
            <p className="text-sm text-destructive">{generateError}</p>
          )}
        </div>
      </ModernSection>

      <ModernSection title="Dagoverzicht">
        {isLoading ? (
          <div className="flex justify-center text-muted-foreground py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3">
            {orderedDays.map((d) => {
              const isToday = d.key === todayKey;
              const dayPlan = plan[d.key] ?? { meal: "", recipe_id: null };
              return (
                <div
                  key={d.key}
                  className={`${cardSurface({ padding: "none" })} ${
                    isToday ? "!border-primary/30 !bg-primary/5" : ""
                  } p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors`}
                >
                  <div className="sm:w-28 shrink-0 flex items-center gap-2">
                    <div>
                      <p
                        className={`font-serif text-lg font-semibold ${isToday ? "text-primary" : ""}`}
                      >
                        {d.label}
                      </p>
                      {isToday && (
                        <p className="text-[10px] uppercase tracking-widest text-primary/80">
                          Vandaag
                        </p>
                      )}
                    </div>
                    {dayPlan.recipe_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary shrink-0">
                        <ChefHat className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <Input
                      key={`${d.key}:${dayPlan.meal}:${dayPlan.recipe_id ?? ""}`}
                      defaultValue={dayPlan.meal}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === dayPlan.meal) return;
                        saveDay.mutate({
                          day: d.key,
                          meal: value,
                          recipe_id: null,
                        });
                      }}
                      placeholder="Bijv. pasta pesto met kip"
                      className="bg-background/60 border-border/50 rounded-xl flex-1"
                    />
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        const recipe = recipeOptions.find((r) => r.id === id);
                        if (recipe)
                          saveDay.mutate({
                            day: d.key,
                            meal: recipe.title,
                            recipe_id: recipe.id,
                          });
                      }}
                      className="text-xs bg-background/60 border border-border/50 rounded-xl px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-44 shrink-0"
                    >
                      <option value="">Koppel recept…</option>
                      {recipeOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => clearWeek.mutate()}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Wis hele week
        </button>
      </ModernSection>
    </div>
  );
}
