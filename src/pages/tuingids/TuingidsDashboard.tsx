import { useQuery } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { Droplet, Leaf, Scissors, Apple, Flower2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { WeatherForecast } from "@/components/weather-forecast";

const MONTH_OPTIONS = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

function effectiveWaterInterval(p: Plant): number | null {
  if (p.growing_method === "Pot" && p.pot_water_interval_days) return p.pot_water_interval_days;
  return p.water_interval_days;
}

function isOverdue(p: Plant): boolean {
  const interval = effectiveWaterInterval(p);
  if (!p.planted || !interval) return false;
  if (!p.last_watered_at) return true;
  const due = new Date(p.last_watered_at).getTime() + interval * 86400000;
  return due <= Date.now();
}

function isFeedingOverdue(p: Plant): boolean {
  if (!p.planted || !p.feeding_interval_days) return false;
  if (!p.last_fed_at) return true;
  const due = new Date(p.last_fed_at).getTime() + p.feeding_interval_days * 86400000;
  return due <= Date.now();
}

function Widget({ emoji, title, children, to }: { emoji: string; title: string; children: React.ReactNode; to?: string }) {
  const inner = (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 h-full">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <p className="font-semibold text-sm">{title}</p>
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}

function PlantPill({ name, photo_url }: { name: string; photo_url?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-2.5 py-1 max-w-full">
      {photo_url
        ? <img src={photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
        : <span>🌱</span>}
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function TuingidsDashboard() {
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plants").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });

  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
  const waterPlants = plants.filter(isOverdue);
  const feedPlants = plants.filter(isFeedingOverdue);
  const bloomPlants = plants.filter((p) => p.bloom_months?.includes(currentMonth));
  const harvestPlants = plants.filter((p) => p.harvest_months?.includes(currentMonth));
  const pruningPlants = plants.filter((p) => p.pruning_notes);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
        <h1 className="font-serif text-3xl font-semibold mt-1">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Weer */}
        <Widget emoji="🌦" title="Weer vandaag">
          <div className="scale-90 origin-left">
            <WeatherForecast />
          </div>
        </Widget>

        {/* Water */}
        <Widget emoji="💧" title={`Water geven (${waterPlants.length})`} to="/tuinieren">
          {waterPlants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Alle planten zijn bijgewerkt ✓</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {waterPlants.slice(0, 6).map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
              {waterPlants.length > 6 && <span className="text-xs text-muted-foreground">+{waterPlants.length - 6} meer</span>}
            </div>
          )}
        </Widget>

        {/* Bemesten */}
        <Widget emoji="🌿" title={`Bemesten (${feedPlants.length})`} to="/tuinieren">
          {feedPlants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Niets te bemesten vandaag ✓</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {feedPlants.slice(0, 6).map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
              {feedPlants.length > 6 && <span className="text-xs text-muted-foreground">+{feedPlants.length - 6} meer</span>}
            </div>
          )}
        </Widget>

        {/* Bloeiend */}
        <Widget emoji="🌸" title={`In bloei deze maand (${bloomPlants.length})`}>
          {bloomPlants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen planten in bloei</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bloomPlants.map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
            </div>
          )}
        </Widget>

        {/* Oogst */}
        <Widget emoji="🍅" title={`Komende oogst (${harvestPlants.length})`}>
          {harvestPlants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Niets te oogsten deze maand</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {harvestPlants.map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
            </div>
          )}
        </Widget>

        {/* Snoeien */}
        <Widget emoji="✂️" title="Snoeien">
          {pruningPlants.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen snoeiplanten aanwezig</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pruningPlants.slice(0, 4).map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
            </div>
          )}
        </Widget>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <QuickLink to="/tuingids/dokter" emoji="🩺" label="Plantendokter" desc="Diagnose opzoeken" />
        <QuickLink to="/tuingids/encyclopedie" emoji="📖" label="Encyclopedie" desc="Leer over tuinieren" />
        <QuickLink to="/tuingids/logboek" emoji="📷" label="Groeilogboek" desc="Groei bijhouden" />
      </div>
    </div>
  );
}

function QuickLink({ to, emoji, label, desc }: { to: string; emoji: string; label: string; desc: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:bg-accent/30 transition-colors">
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
