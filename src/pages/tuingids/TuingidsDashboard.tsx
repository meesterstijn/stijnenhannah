import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { WeatherForecast } from "@/components/weather-forecast";
import { MONTH_OPTIONS } from "@/features/tuingids/lib/plantStatus";
import { instanceWaterStatus, instanceFeedingStatus } from "@/features/tuingids/lib/plantInstanceStatus";
import {
  fetchActivePlantInstances,
  plantInstanceDisplayName,
  hasActiveInstancesForSpecies,
} from "@/features/tuingids/lib/plantInstances";
import { fetchPlants } from "@/features/tuingids/lib/plantLogs";

function Widget({ emoji, title, children, to }: { emoji: string; title: string; children: React.ReactNode; to?: string }) {
  const inner = (
    <div className="sv-panel p-4 space-y-3 h-full">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <p className="sv-heading text-xl">{title}</p>
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

function PlantPill({ name, photo_url }: { name: string; photo_url?: string | null }) {
  return (
    <span className="sv-badge-ok inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 max-w-full">
      {photo_url
        ? <img src={photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
        : <span>🌱</span>}
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function TuingidsDashboard() {
  const { data: species = [], isLoading: speciesLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });
  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ["plant_instances", "active"],
    queryFn: fetchActivePlantInstances,
  });

  const speciesById = new Map(species.map((s) => [s.id, s]));
  const currentMonth = MONTH_OPTIONS[new Date().getMonth()];

  // Care widgets are exemplaar-gericht: two instances of the same species
  // (e.g. "Koralik kas" and "Koralik dakterras") show as two separate pills,
  // since watering/feeding is tracked per concrete plant.
  const waterInstances = instances.filter((i) => {
    const s = speciesById.get(i.species_id);
    return s && instanceWaterStatus(i, s)?.overdue;
  });
  const feedInstances = instances.filter((i) => {
    const s = speciesById.get(i.species_id);
    return s && instanceFeedingStatus(i, s)?.overdue;
  });

  // Calendar/species-general widgets dedupe per species: a species with
  // multiple planted instances still only needs to show up once here.
  const plantedSpecies = species.filter((s) => hasActiveInstancesForSpecies(s.id, instances));
  const bloomPlants = plantedSpecies.filter((s) => s.bloom_months?.includes(currentMonth));
  const harvestPlants = plantedSpecies.filter((s) => s.harvest_months?.includes(currentMonth));
  const pruningPlants = plantedSpecies.filter((s) => s.pruning_notes);

  const isLoading = speciesLoading || instancesLoading;
  if (isLoading) {
    return (
      <div className="flex justify-center py-20 sv-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Widget emoji="🌦" title="Weer vandaag">
          <WeatherForecast variant="stacked" />
        </Widget>

        <Widget emoji="💧" title={`Water geven (${waterInstances.length})`} to="/tuinieren">
          {waterInstances.length === 0 ? (
            <p className="text-xs sv-muted">Alle exemplaren zijn bijgewerkt ✓</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {waterInstances.slice(0, 6).map((i) => (
                <PlantPill key={i.id} name={plantInstanceDisplayName(i, speciesById.get(i.species_id))} photo_url={speciesById.get(i.species_id)?.photo_url} />
              ))}
              {waterInstances.length > 6 && <span className="text-xs sv-muted">+{waterInstances.length - 6} meer</span>}
            </div>
          )}
        </Widget>

        <Widget emoji="🌿" title={`Bemesten (${feedInstances.length})`} to="/tuinieren">
          {feedInstances.length === 0 ? (
            <p className="text-xs sv-muted">Niets te bemesten vandaag ✓</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {feedInstances.slice(0, 6).map((i) => (
                <PlantPill key={i.id} name={plantInstanceDisplayName(i, speciesById.get(i.species_id))} photo_url={speciesById.get(i.species_id)?.photo_url} />
              ))}
              {feedInstances.length > 6 && <span className="text-xs sv-muted">+{feedInstances.length - 6} meer</span>}
            </div>
          )}
        </Widget>

        <Widget emoji="🌸" title={`In bloei deze maand (${bloomPlants.length})`}>
          {bloomPlants.length === 0 ? (
            <p className="text-xs sv-muted">Geen planten in bloei</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bloomPlants.map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
            </div>
          )}
        </Widget>

        <Widget emoji="🍅" title={`Komende oogst (${harvestPlants.length})`}>
          {harvestPlants.length === 0 ? (
            <p className="text-xs sv-muted">Niets te oogsten deze maand</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {harvestPlants.map((p) => <PlantPill key={p.id} name={p.name} photo_url={p.photo_url} />)}
            </div>
          )}
        </Widget>

        <Widget emoji="✂️" title="Snoeien">
          {pruningPlants.length === 0 ? (
            <p className="text-xs sv-muted">Geen snoeiplanten aanwezig</p>
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
    <Link to={to} className="sv-panel p-4 flex items-center gap-3 hover:opacity-90 transition-opacity">
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="sv-heading text-xl">{label}</p>
        <p className="text-xs sv-muted">{desc}</p>
      </div>
    </Link>
  );
}
