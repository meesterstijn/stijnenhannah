import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWeather, iconFor, descFor } from "@/hooks/useWeather";
import { BijbelWidget } from "@/components/bijbel-widget";
import { VerjaarDagWidget } from "@/components/verjaardag-widget";
import { SnelleLinksWidget } from "@/components/snelle-links-widget";
import { SchoonmaakWidget } from "@/components/schoonmaak-widget";
import { VakantieWidget } from "@/components/vakantie-widget";
import { SpotifyWidget } from "@/components/spotify-widget";
import { WifiWidget } from "@/components/wifi-widget";
import {
  Home as HomeIcon,
  LogOut,
  ShoppingBasket,
  BookHeart,
  Camera,
  ListTodo,
  NotebookPen,
  CalendarDays,
  Sprout,
  Crosshair,
  Martini,
  CloudSun,
  Guitar,
  Dices,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

type GroceryItem = { id: string; text: string; done: boolean };
type Todo = { id: string; text: string; done: boolean; created_at: string };
type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

const MEER_SECTION_ID = "home-meer";

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

  const { data: weather } = useWeather();

  const openItems = items.filter((i) => !i.done);
  const openTodos = todos.filter((t) => !t.done);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  const WeatherIcon = weather ? iconFor(weather.code) : null;

  function scrollToMeer() {
    document
      .getElementById(MEER_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="home-dashboard">
      <div className="home-bg" aria-hidden />

      <header className="home-header">
        <Link to="/" className="flex items-center gap-2 opacity-95">
          <HomeIcon className="h-5 w-5" strokeWidth={1.8} />
          <span className="font-semibold text-[15px]">Ons Huisje</span>
        </Link>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="flex items-center justify-center h-9 w-9 rounded-full opacity-90 hover:opacity-100 transition-opacity"
          aria-label="Uitloggen"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <div className="home-content">
        <section className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="home-greeting">Hej! 👋</p>
            <p className="home-date">{dateLabelCap}</p>
          </div>

          <Link to="/weer" className="home-weather shrink-0">
            {WeatherIcon && (
              <WeatherIcon className="h-9 w-9" strokeWidth={1.5} />
            )}
            {weather ? (
              <div>
                <p className="home-weather-temp">{weather.temp}°</p>
                <p className="home-weather-desc">{descFor(weather.code)}</p>
                <p className="home-weather-city">{weather.city}</p>
              </div>
            ) : (
              <p className="home-weather-desc">Weer laden…</p>
            )}
          </Link>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <HomeTile
            to="/boodschappen"
            icon={ShoppingBasket}
            title="Boodschappen"
            desc={
              openItems.length
                ? `${openItems.length} nog te halen`
                : "Lijst is leeg"
            }
          />
          <HomeTile
            to="/todo"
            icon={ListTodo}
            title="To-do"
            desc={
              openTodos.length ? `${openTodos.length} open` : "Alles gedaan"
            }
          />
          <HomeTile
            to="/notities"
            icon={NotebookPen}
            title="Notities"
            desc="Schrijf het op"
          />
          <HomeTile
            to="/recepten"
            icon={BookHeart}
            title="Recepten"
            desc="Bewaar wat jullie graag eten"
          />
        </section>

        <section className="flex flex-col gap-3">
          <HomeWideCard
            to="/weekmenu"
            icon={CalendarDays}
            title="Weekmenu"
            desc="Plan de week en genereer je lijst"
          />
          <HomeWideCard
            to="/tuinieren"
            icon={Sprout}
            title="Tuin"
            desc="Bekijk je planten en verzorging"
          />
        </section>

        <section
          id={MEER_SECTION_ID}
          className="flex flex-col gap-3 scroll-mt-20"
        >
          <p className="home-section-heading">Meer</p>
          <div className="home-glass-scope dark grid grid-cols-2 sm:grid-cols-3 gap-3">
            <HomeTile
              to="/rainbow-six-siege"
              icon={Crosshair}
              title="Rainbow Six Siege"
              desc="Plan jullie LAN Night"
              compact
            />
            <HomeTile
              to="/cocktail-bar"
              icon={Martini}
              title="Cocktail Bar"
              desc="Handcrafted cocktails"
              compact
            />
            <HomeTile
              to="/gitaar"
              icon={Guitar}
              title="Gitaar"
              desc="Akkoorden en songteksten"
              compact
            />
            <HomeTile
              to="/game-night"
              icon={Dices}
              title="Game Night"
              desc="Vanavond wordt er gespeeld"
              compact
            />
            <HomeTile
              to="/fotografie"
              icon={Camera}
              title="Fotografie"
              desc="Jullie mooiste momenten"
              compact
            />
            <HomeTile
              to="/weer"
              icon={CloudSun}
              title="Weer"
              desc="Volledige verwachting"
              compact
            />
            <SpotifyWidget />
            <VerjaarDagWidget />
            <SchoonmaakWidget />
            <VakantieWidget />
            <WifiWidget />
            <BijbelWidget />
            <SnelleLinksWidget />
          </div>
        </section>
      </div>

      <nav className="home-bottom-nav">
        <span className="home-bottom-nav-item active">
          <HomeIcon className="h-5 w-5" strokeWidth={1.8} />
          Home
          <span className="home-bottom-nav-dot" />
        </span>
        <Link to="/boodschappen" className="home-bottom-nav-item">
          <ShoppingBasket className="h-5 w-5" strokeWidth={1.8} />
          Lijsten
          <span className="home-bottom-nav-dot" />
        </Link>
        <Link to="/tuinieren" className="home-bottom-nav-item">
          <Sprout className="h-5 w-5" strokeWidth={1.8} />
          Tuin
          <span className="home-bottom-nav-dot" />
        </Link>
        <Link to="/recepten" className="home-bottom-nav-item">
          <BookHeart className="h-5 w-5" strokeWidth={1.8} />
          Recepten
          <span className="home-bottom-nav-dot" />
        </Link>
        <button
          type="button"
          onClick={scrollToMeer}
          className="home-bottom-nav-item"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />
          Meer
          <span className="home-bottom-nav-dot" />
        </button>
      </nav>
    </div>
  );
}

function HomeTile({
  to,
  icon: Icon,
  title,
  desc,
  compact,
}: {
  to: string;
  icon: IconType;
  title: string;
  desc: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link to={to} className="sv-panel p-3 flex flex-col gap-2">
        <div className="sv-icon-slot h-9 w-9 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="sv-heading text-sm leading-tight truncate">{title}</p>
          <p className="sv-muted text-xs mt-0.5 leading-tight truncate">
            {desc}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={to} className="home-card">
      <Icon className="home-card-icon h-6 w-6" strokeWidth={1.6} />
      <p className="home-card-title">{title}</p>
      <p className="home-card-desc">{desc}</p>
    </Link>
  );
}

function HomeWideCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: IconType;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="home-wide-card">
      <Icon className="h-6 w-6 shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="home-wide-card-title">{title}</p>
        <p className="home-wide-card-desc">{desc}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 opacity-70" />
    </Link>
  );
}
