import { useLocalStorage } from "@/hooks/use-local-storage";
import { Input } from "@/components/ui/input";

const days = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

type WeekPlan = Record<string, string>;

export default function Weekmenu() {
  const [plan, setPlan] = useLocalStorage<WeekPlan>("weekplan", {});
  const todayIdx = (new Date().getDay() + 6) % 7;

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
                value={plan[d.key] ?? ""}
                onChange={(e) => setPlan({ ...plan, [d.key]: e.target.value })}
                placeholder="Bijv. pasta pesto met kip"
                className="bg-background/60 border-border/40"
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setPlan({})}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        Wis hele week
      </button>
    </div>
  );
}
