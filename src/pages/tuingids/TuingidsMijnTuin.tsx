import { useQuery } from "@tanstack/react-query";
import { type Plant, type PlantInstance } from "@/lib/supabase";
import { Loader2, Droplet, Leaf, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/features/tuingids/components/EmptyState";
import { MONTH_OPTIONS } from "@/features/tuingids/lib/plantStatus";
import {
  effectiveInstanceWaterIntervalDays,
  isInstanceWaterSkippedToday,
} from "@/features/tuingids/lib/plantInstanceStatus";
import { useRecordInstanceCare } from "@/features/tuingids/hooks/usePlantCareActions";
import {
  fetchActivePlantInstances,
  fetchAllGrowingSeasons,
  plantInstanceDisplayName,
} from "@/features/tuingids/lib/plantInstances";
import { fetchPlants } from "@/features/tuingids/lib/plantLogs";

// Health score is computed from the INSTANCE's own state (last_watered_at,
// status) combined with the SPECIES' general advice (interval days) — see
// plantInstanceStatus.ts. A dormant/archived/dead/removed instance never
// shows an urgent health penalty the way an active one does.
function healthScore(instance: PlantInstance, species: Plant | undefined): number {
  let score = 100;
  if (instance.status === "active" && species) {
    const interval = effectiveInstanceWaterIntervalDays(instance, species);
    if (interval) {
      if (!instance.last_watered_at) { score -= 30; }
      else if (!isInstanceWaterSkippedToday(instance)) {
        const daysLeft = Math.ceil((new Date(instance.last_watered_at).getTime() + interval * 86400000 - Date.now()) / 86400000);
        if (daysLeft < 0) score += daysLeft * 5;
      }
    }
    if (species.feeding_interval_days) {
      if (!instance.last_fed_at) { score -= 15; }
      else {
        const daysLeft = Math.ceil((new Date(instance.last_fed_at).getTime() + species.feeding_interval_days * 86400000 - Date.now()) / 86400000);
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
  const { data: species = [], isLoading: speciesLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });
  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ["plant_instances", "active"],
    queryFn: fetchActivePlantInstances,
  });
  const { data: seasons = [] } = useQuery({
    queryKey: ["growing_seasons", "all"],
    queryFn: fetchAllGrowingSeasons,
  });

  const { recordWatering, recordFeeding, recordingWaterId, recordingFeedId } = useRecordInstanceCare();

  const speciesById = new Map(species.map((s) => [s.id, s]));
  const activeSeasonByInstance = new Map(seasons.filter((s) => s.status === "active").map((s) => [s.plant_instance_id, s.id]));
  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];
  const isLoading = speciesLoading || instancesLoading;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin sv-muted" /></div>;
  }

  if (instances.length === 0) {
    return (
      <EmptyState
        emoji="🌱"
        title="Nog geen geplante exemplaren"
        description="Gebruik 'Nieuw exemplaar planten' op de Tuinieren-pagina om hier je eerste exemplaar te zien."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="sv-muted text-sm">{instances.length} geplante exemplaar{instances.length !== 1 ? "en" : ""}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {instances.map((instance) => {
          const plantSpecies = speciesById.get(instance.species_id);
          const name = plantInstanceDisplayName(instance, plantSpecies);
          const score = healthScore(instance, plantSpecies);
          const blooming = plantSpecies?.bloom_months?.includes(currentMonth);
          const harvesting = plantSpecies?.harvest_months?.includes(currentMonth);
          return (
            <div key={instance.id} className="sv-panel p-4 space-y-3">
              <div className="flex items-center gap-3">
                {plantSpecies?.photo_url
                  ? <img src={plantSpecies.photo_url} alt="" className="sv-icon-slot h-12 w-12 rounded-xl object-cover shrink-0" />
                  : <div className="sv-icon-slot h-12 w-12 rounded-xl flex items-center justify-center shrink-0"><Sprout className="h-5 w-5" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="sv-heading text-2xl truncate">{name}</p>
                  {plantSpecies && plantSpecies.name !== name && (
                    <p className="text-xs sv-muted truncate">{plantSpecies.name}</p>
                  )}
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {blooming && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🌸 In bloei</span>}
                    {harvesting && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🍅 Oogsten</span>}
                    {instance.location && <span className="text-xs sv-muted">{instance.location}</span>}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs sv-muted mb-1">Gezondheid</p>
                <HealthBar score={score} />
              </div>

              {instance.last_watered_at && (
                <p className="text-xs sv-muted">
                  Laatste water: {new Date(instance.last_watered_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border flex-1 text-xs gap-1"
                  onClick={() => recordWatering(instance, name, activeSeasonByInstance.get(instance.id) ?? null)}
                  disabled={recordingWaterId === instance.id}
                >
                  <Droplet className="h-3 w-3" /> Water
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border flex-1 text-xs gap-1"
                  onClick={() => recordFeeding(instance, name, activeSeasonByInstance.get(instance.id) ?? null)}
                  disabled={recordingFeedId === instance.id}
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
