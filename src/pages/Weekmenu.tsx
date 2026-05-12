import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type WeekPlanRow } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const days = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

async function fetchPlan(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("weekplan").select("*");
  if (error) throw error;
  return Object.fromEntries((data as WeekPlanRow[]).map((r) => [r.day, r.meal]));
}

export default function Weekmenu() {
  const queryClient = useQueryClient();
  const todayIdx = (new Date().getDay() + 6) % 7;

  const { data: plan = {}, isLoading } = useQuery({
    queryKey: ["weekplan"],
    queryFn: fetchPlan,
  });

  const updateDay = useMutation({
    mutationFn: async ({ day, meal }: { day: string; meal: string }) => {
      const { error } = await supabase
        .from("weekplan")
        .upsert({ day, meal }, { onConflict: "day" });
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Wat eten we deze week?
        </p>
        <h1 className="font-serif text-4xl font-semibold mt-2">Weekmenu</h1>
        <p className="text-muted-foreground mt-2">
          Vul per dag in wat jullie eten. Wijzigingen worden meteen opgeslagen.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {days.map((d, i) => {
            const isToday = i === todayIdx;
            return (
              <div
                key={d.key}
                className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-4 transition-colors ${
                  isToday ? "bg-accent/30 border-accent/60" : "bg-card border-border/60"
                }`}
              >
                <div className="w-24 sm:w-32 shrink-0">
                  <p className={`font-serif text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                    {d.label}
                  </p>
                  {isToday && (
                    <p className="text-[10px] uppercase tracking-widest text-primary/80">Vandaag</p>
                  )}
                </div>
                <Input
                  defaultValue={plan[d.key] ?? ""}
                  onBlur={(e) => updateDay.mutate({ day: d.key, meal: e.target.value })}
                  placeholder="Bijv. pasta pesto met kip"
                  className="bg-background/60 border-border/40"
                />
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
    </div>
  );
}
