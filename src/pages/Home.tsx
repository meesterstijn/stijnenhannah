import { Link } from "react-router-dom";
import { WeatherWidget } from "@/components/weather-widget";
import { BijbelWidget } from "@/components/bijbel-widget";
import { VerjaarDagWidget } from "@/components/verjaardag-widget";
import { SnelleLinksWidget } from "@/components/snelle-links-widget";
import { SchoonmaakWidget } from "@/components/schoonmaak-widget";
import { VakantieWidget } from "@/components/vakantie-widget";
import { SpotifyWidget } from "@/components/spotify-widget";
import { WifiWidget } from "@/components/wifi-widget";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  ShoppingBasket,
  BookHeart,
  Camera,
  ListTodo,
  NotebookPen,
  CalendarDays,
  Sparkles,
  Sprout,
  Crosshair,
} from "lucide-react";

type GroceryItem = { id: string; text: string; done: boolean };
type Todo = { id: string; text: string; done: boolean; created_at: string };

export default function Home() {
  const { data: items = [] } = useQuery({
    queryKey: ["groceries", "home-count"],
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data } = await supabase.from("groceries").select("id, done");
      return (data ?? []) as GroceryItem[];
    },
  });

  const { data: todos = [] } = useQuery({
    queryKey: ["todos", "home-count"],
    queryFn: async (): Promise<Todo[]> => {
      const { data } = await supabase
        .from("todos")
        .select("id, text, done, created_at")
        .order("created_at", { ascending: true });
      return (data ?? []) as Todo[];
    },
  });

  const openItems = items.filter((i) => !i.done);
  const openTodos = todos.filter((t) => !t.done);
  const firstTodo = openTodos[0];

  return (
    <div className="tuinieren-theme space-y-4">
      <section className="grid gap-4 sm:grid-cols-3">
        <WeatherWidget />
        <div className="hidden sm:block">
          <SnelleLinksWidget />
        </div>
        <div className="hidden sm:block">
          <BijbelWidget />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickCard
          to="/boodschappen"
          icon={ShoppingBasket}
          title="Boodschappen"
          desc={
            openItems.length
              ? `${openItems.length} nog te halen`
              : "Lijst is leeg"
          }
        />
        <QuickCard
          to="/notities"
          icon={NotebookPen}
          title="Notities"
          desc="Schrijf het op"
        />
        <QuickCard
          to="/todo"
          icon={ListTodo}
          title="To-do"
          desc={firstTodo ? firstTodo.text : "Alles gedaan"}
        />
        <QuickCard
          to="/recepten"
          icon={BookHeart}
          title="Recepten"
          desc="Bewaar wat jullie graag eten"
        />
        <QuickCard
          to="/weekmenu"
          icon={CalendarDays}
          title="Weekmenu"
          desc="Plan de week en genereer je lijst"
        />
        <QuickCard
          to="/tuinieren"
          icon={Sprout}
          title="Tuinieren"
          desc="Houd de verzorging van je planten bij"
        />
        <QuickCard
          to="/dagvraag"
          icon={Sparkles}
          title="Dagvraag"
          desc="Elke dag een antwoord van Gemini"
        />
        <QuickCard
          to="/rainbow-six-siege"
          icon={Crosshair}
          title="Rainbow Six Siege"
          desc="Plan en speel jullie eigen R6 LAN Night"
        />
        <SpotifyWidget />
        <VerjaarDagWidget />
        <SchoonmaakWidget />
        <VakantieWidget />
        <QuickCard
          to="/fotografie"
          icon={Camera}
          title="Fotografie"
          desc="Jullie mooiste momenten"
        />
        <WifiWidget />
      </section>
    </div>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="sv-panel group p-4 hover:-translate-y-0.5 transition-transform flex items-center gap-3 sm:min-h-[100px]"
    >
      <div className="sv-icon-slot h-10 w-10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="sv-heading text-2xl leading-tight truncate">
          {title}
        </p>
        <p className="text-xs sv-muted mt-0.5 leading-tight truncate">
          {desc}
        </p>
      </div>
    </Link>
  );
}
