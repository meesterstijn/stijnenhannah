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
import { ShoppingBasket, BookHeart, Camera, ArrowRight, ListTodo, NotebookPen, CalendarDays } from "lucide-react";

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
      const { data } = await supabase.from("todos").select("id, text, done, created_at").order("created_at", { ascending: true });
      return (data ?? []) as Todo[];
    },
  });

  const openItems = items.filter((i) => !i.done);
  const openTodos = todos.filter((t) => !t.done);
  const firstTodo = openTodos[0];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-3">
        <WeatherWidget />
        <div className="hidden sm:block"><SnelleLinksWidget /></div>
        <div className="hidden sm:block"><BijbelWidget /></div>
      </section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickCard
          to="/boodschappen"
          icon={ShoppingBasket}
          title="Boodschappen"
          desc={openItems.length ? `${openItems.length} nog te halen` : "Lijst is leeg"}
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
      className="group rounded-2xl bg-card border border-border/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-3 sm:min-h-[100px]"
    >
      <Icon className="h-5 w-5 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-base font-semibold leading-tight truncate">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
