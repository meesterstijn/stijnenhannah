import { Link } from "react-router-dom";
import { WeatherWidget } from "@/components/weather-widget";
import { BijbelWidget } from "@/components/bijbel-widget";
import { VerjaarDagWidget } from "@/components/verjaardag-widget";
import { SnelleLinksWidget } from "@/components/snelle-links-widget";
import { SchoonmaakWidget } from "@/components/schoonmaak-widget";
import { VakantieWidget } from "@/components/vakantie-widget";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ShoppingBasket, BookHeart, Camera, ArrowRight, ListTodo, NotebookPen } from "lucide-react";

type GroceryItem = { id: string; text: string; done: boolean };
type Todo = { id: string; done: boolean };

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
      const { data } = await supabase.from("todos").select("id, done");
      return (data ?? []) as Todo[];
    },
  });

  const openItems = items.filter((i) => !i.done);
  const openTodos = todos.filter((t) => !t.done);

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        <WeatherWidget />
        <SnelleLinksWidget />
        <BijbelWidget />
        <QuickCard
          to="/todo"
          icon={ListTodo}
          title="To-do"
          desc={openTodos.length ? `${openTodos.length} nog te doen` : "Alles gedaan"}
        />
        <QuickCard
          to="/notities"
          icon={NotebookPen}
          title="Notities"
          desc="Schrijf het op"
        />
        <VerjaarDagWidget />
        <SchoonmaakWidget />
        <VakantieWidget />
        <QuickCard
          to="/boodschappen"
          icon={ShoppingBasket}
          title="Boodschappen"
          desc={openItems.length ? `${openItems.length} nog te halen` : "Lijst is leeg"}
        />
        <QuickCard
          to="/recepten"
          icon={BookHeart}
          title="Recepten"
          desc="Bewaar wat jullie graag eten"
        />
        <QuickCard
          to="/fotografie"
          icon={Camera}
          title="Fotografie"
          desc="Jullie mooiste momenten"
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
      className="group rounded-2xl bg-card border border-border/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4 sm:min-h-[200px]"
    >
      <Icon className="h-7 w-7 text-primary shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-xl font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
