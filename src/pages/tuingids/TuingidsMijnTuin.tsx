import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { Loader2, Droplet, Leaf, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/features/tuingids/components/EmptyState";

const MONTH_OPTIONS = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];

function healthScore(p: Plant): number {
  let score = 100;
  if (p.planted) {
    const interval = p.growing_method === "Pot" && p.pot_water_interval_days
      ? p.pot_water_interval_days : p.water_interval_days;
    if (interval) {
      if (!p.last_watered_at) { score -= 30; }
      else {
        const daysLeft = Math.ceil((new Date(p.last_watered_at).getTime() + interval * 86400000 - Date.now()) / 86400000);
        if (daysLeft < 0) score += daysLeft * 5;
      }
    }
    if (p.feeding_interval_days) {
      if (!p.last_fed_at) { score -= 15; }
      else {
        const daysLeft = Math.ceil((new Date(p.last_fed_at).getTime() + p.feeding_interval_days * 86400000 - Date.now()) / 86400000);
        if (daysLeft < 0) score += daysLeft * 3;
      }
    }
  }
  return Math.max(0, Math.min(100, score));
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden sv-inset">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs sv-muted w-8 text-right">{score}%</span>
    </div>
  );
}

export default function TuingidsMijnTuin() {
  const queryClient = useQueryClient();
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plants").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Plant[];
    },
  });

  const markWatered = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").update({
        last_watered_at: new Date().toISOString(),
        last_water_reminder_sent_at: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plants"] }),
  });

  const markFed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").update({
        last_fed_at: new Date().toISOString(),
        last_feeding_reminder_sent_at: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plants"] }),
  });

  const planted = plants.filter((p) => p.planted);
  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin sv-muted" /></div>;
  }

  if (planted.length === 0) {
    return (
      <EmptyState
        emoji="🌱"
        title="Nog geen ingeplante planten"
        description="Markeer een plant als 'gepland' op de tuinpagina om hem hier te zien."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="sv-muted text-sm">{planted.length} ingeplante planten</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {planted.map((p) => {
          const score = healthScore(p);
          const blooming = p.bloom_months?.includes(currentMonth);
          const harvesting = p.harvest_months?.includes(currentMonth);
          return (
            <div key={p.id} className="sv-panel p-4 space-y-3">
              <div className="flex items-center gap-3">
                {p.photo_url
                  ? <img src={p.photo_url} alt="" className="sv-icon-slot h-12 w-12 rounded-xl object-cover shrink-0" />
                  : <div className="sv-icon-slot h-12 w-12 rounded-xl flex items-center justify-center shrink-0"><Sprout className="h-5 w-5" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="sv-heading text-2xl truncate">{p.name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {blooming && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🌸 In bloei</span>}
                    {harvesting && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🍅 Oogsten</span>}
                    {p.location && <span className="text-xs sv-muted">{p.location}</span>}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs sv-muted mb-1">Gezondheid</p>
                <HealthBar score={score} />
              </div>

              {p.last_watered_at && (
                <p className="text-xs sv-muted">
                  Laatste water: {new Date(p.last_watered_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border flex-1 text-xs gap-1"
                  onClick={() => markWatered.mutate(p.id)}
                  disabled={markWatered.isPending}
                >
                  <Droplet className="h-3 w-3" /> Water
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border flex-1 text-xs gap-1"
                  onClick={() => markFed.mutate(p.id)}
                  disabled={markFed.isPending}
                >
                  <Leaf className="h-3 w-3" /> Bemest
                </Button>
                <Link to="/tuinieren">
                  <Button size="sm" variant="outline" className="sv-button sv-button-thin-border text-xs">Bekijk</Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
