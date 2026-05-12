import { Link } from "react-router-dom";
import { WeatherWidget } from "@/components/weather-widget";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ShoppingBasket, CalendarDays, BookHeart, ArrowRight } from "lucide-react";

type GroceryItem = { id: string; text: string; done: boolean };
type WeekPlan = Record<string, string>;

const dayKeys = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export default function Home() {
  const [items] = useLocalStorage<GroceryItem[]>("groceries", []);
  const [plan] = useLocalStorage<WeekPlan>("weekplan", {});
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7;
  const todayKey = dayKeys[todayIdx];
  const todayMeal = plan[todayKey];

  const openItems = items.filter((i) => !i.done);
  const greeting =
    today.getHours() < 12
      ? "Goeiemorgen"
      : today.getHours() < 18
        ? "Goeiemiddag"
        : "Goeienavond";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {today.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold mt-2">
          {greeting}, lieverds
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Welkom in jullie kleine digitale huiskamer. Hier vinden jullie alles bij elkaar.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <WeatherWidget />

        <Link
          to="/weekmenu"
          className="rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Vanavond eten</p>
          <p className="font-serif text-3xl font-semibold mt-2">
            {todayMeal || "Nog niets gepland"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {todayMeal ? "Eet smakelijk samen 🍷" : "Plan iets lekkers in het weekmenu →"}
          </p>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <QuickCard
          to="/boodschappen"
          icon={ShoppingBasket}
          title="Boodschappen"
          desc={openItems.length ? `${openItems.length} nog te halen` : "Lijst is leeg"}
        />
        <QuickCard
          to="/weekmenu"
          icon={CalendarDays}
          title="Weekmenu"
          desc={`${Object.values(plan).filter(Boolean).length} van 7 dagen ingevuld`}
        />
        <QuickCard
          to="/recepten"
          icon={BookHeart}
          title="Recepten"
          desc="Bewaar wat jullie graag eten"
        />
      </section>
    </div>
  );
}

function QuickCard({
  to, icon: Icon, title, desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3"
    >
      <Icon className="h-7 w-7 text-primary" strokeWidth={1.6} />
      <div>
        <p className="font-serif text-xl font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
    </Link>
  );
}
