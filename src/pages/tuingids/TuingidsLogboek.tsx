import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Plant, type PlantInstance, type GrowingSeason } from "@/lib/supabase";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { useGrowthPhotos } from "@/features/tuingids/hooks/useGrowthPhotos";
import {
  fetchPlants,
  fetchAllHarvestLogs,
  fetchAllPruningLogs,
  fetchAllRepotLogs,
  fetchAllInspectionLogs,
  fetchAllPhotos,
} from "@/features/tuingids/lib/plantLogs";
import {
  fetchPlantInstances,
  fetchAllGrowingSeasons,
  plantInstanceDisplayName,
} from "@/features/tuingids/lib/plantInstances";
import { buildAllLogboekEvents, type LogboekEvent } from "@/features/tuingids/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { LogboekDashboard } from "@/features/tuingids/components/LogboekDashboard";
import { LogboekTimeline, type LogboekEventMeta } from "@/features/tuingids/components/LogboekTimeline";
import { GrowthComparisonChart } from "@/features/tuingids/components/GrowthComparisonChart";
import { GrowthPhotoTimeline } from "@/features/tuingids/components/GrowthPhotoTimeline";
import type { LogEntry } from "@/features/tuingids/types";

type FormState = Omit<LogEntry, "id" | "created_at">;

function emptyForm(): FormState {
  return {
    plant_id: null,
    plant_name: "",
    plant_instance_id: null,
    growing_season_id: null,
    date: new Date().toISOString().slice(0, 10),
    height_cm: null,
    flower_count: null,
    fruit_count: null,
    fruit_length_cm: null,
    fruit_width_cm: null,
    notes: "",
    watered: false,
    fertilized: false,
    photo_url: "",
  };
}

function segBtn(active: boolean) {
  return `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? "sv-badge-ok" : "sv-muted"}`;
}

// A pure name-based `plant_name` free-text field used to be the only way to
// log a growth entry here (no plant_instance_id/growing_season_id was ever
// set). Phase 4: this form now requires picking one existing, concrete
// plant_instances row from a real select list — never a typed name — so
// every new entry links via UUID like the rest of the instance
// architecture. Species-only "quick note" logging no longer exists; use an
// instance's own Groeilogboek (in Tuinieren) if no instance exists yet.
export default function TuingidsLogboek() {
  const { entries, addEntry, isAdding } = useGrowthLog();
  const { getPhotosForInstance } = useGrowthPhotos();

  // ─── Top-level tab ───────────────────────────────────────────────────────
  const [view, setView] = useState<"logboek" | "groei">("logboek");

  // ─── Logboek form ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Groei per exemplaar state ───────────────────────────────────────────
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [groeiSeasonId, setGroeiSeasonId] = useState<string>("all"); // "all" | seasonId
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Shared queries ──────────────────────────────────────────────────────
  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });
  const { data: instances = [] } = useQuery<PlantInstance[]>({
    queryKey: ["plant_instances", "all"],
    queryFn: fetchPlantInstances,
  });
  const { data: seasons = [] } = useQuery<GrowingSeason[]>({
    queryKey: ["growing_seasons", "all"],
    queryFn: fetchAllGrowingSeasons,
  });
  const { data: harvestLogs = [] } = useQuery({
    queryKey: ["plant_harvest_logs", "all"],
    queryFn: fetchAllHarvestLogs,
  });
  const { data: pruningLogs = [] } = useQuery({
    queryKey: ["plant_pruning_logs", "all"],
    queryFn: fetchAllPruningLogs,
  });
  const { data: repotLogs = [] } = useQuery({
    queryKey: ["plant_repot_logs", "all"],
    queryFn: fetchAllRepotLogs,
  });
  const { data: inspectionLogs = [] } = useQuery({
    queryKey: ["plant_inspection_logs", "all"],
    queryFn: fetchAllInspectionLogs,
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["plant_photos", "all"],
    queryFn: fetchAllPhotos,
  });

  // ─── Derived maps (shared) ───────────────────────────────────────────────
  const speciesById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const instancesById = useMemo(() => new Map(instances.map((i) => [i.id, i])), [instances]);
  const activeInstances = useMemo(() => instances.filter((i) => i.status === "active"), [instances]);
  const activeSeasonIds = useMemo(() => new Set(seasons.filter((s) => s.status === "active").map((s) => s.id)), [seasons]);
  const activeSeasonByInstance = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seasons) if (s.status === "active") map.set(s.plant_instance_id, s.id);
    return map;
  }, [seasons]);

  const locations = useMemo(
    () => [...new Set(instances.map((i) => i.location).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, "nl")),
    [instances],
  );

  // ─── Logboek filters ─────────────────────────────────────────────────────
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const events = useMemo(
    () => buildAllLogboekEvents({ entries, harvestLogs, pruningLogs, repotLogs, plants, instances, seasons, inspectionLogs, photos }),
    [entries, harvestLogs, pruningLogs, repotLogs, plants, instances, seasons, inspectionLogs, photos],
  );

  const filteredEvents = useMemo(() => {
    return events.filter((e: LogboekEvent) => {
      if (instanceFilter !== "all" && e.instanceId !== instanceFilter) return false;
      if (speciesFilter !== "all") {
        const instance = e.instanceId ? instancesById.get(e.instanceId) : null;
        const eventSpeciesId = instance?.species_id ?? e.plantId;
        if (eventSpeciesId !== speciesFilter) return false;
      }
      if (locationFilter !== "all") {
        const instance = e.instanceId ? instancesById.get(e.instanceId) : null;
        if (instance?.location !== locationFilter) return false;
      }
      if (seasonFilter === "current") {
        if (!e.growingSeasonId || !activeSeasonIds.has(e.growingSeasonId)) return false;
      } else if (seasonFilter !== "all") {
        if (e.growingSeasonId !== seasonFilter) return false;
      }
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [events, instanceFilter, speciesFilter, locationFilter, seasonFilter, dateFrom, dateTo, instancesById, activeSeasonIds]);

  const seasonsById = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const eventMetaById = useMemo(() => {
    const map = new Map<string, LogboekEventMeta>();
    for (const e of filteredEvents) {
      const instance = e.instanceId ? instancesById.get(e.instanceId) : null;
      const species = instance ? speciesById.get(instance.species_id) : e.plantId ? speciesById.get(e.plantId) : undefined;
      const season = e.growingSeasonId ? seasonsById.get(e.growingSeasonId) : null;
      map.set(e.id, {
        species: species?.name,
        location: instance?.location ?? undefined,
        season: season ? (season.label ?? `Seizoen ${season.year}`) : undefined,
      });
    }
    return map;
  }, [filteredEvents, instancesById, speciesById, seasonsById]);

  const activeFilterCount =
    (instanceFilter !== "all" ? 1 : 0) +
    (speciesFilter !== "all" ? 1 : 0) +
    (locationFilter !== "all" ? 1 : 0) +
    (seasonFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const filteredEntries = useMemo(() => {
    const filteredInstanceIds = new Set(filteredEvents.map((e) => e.instanceId).filter((id): id is string => !!id));
    if (instanceFilter === "all" && speciesFilter === "all" && locationFilter === "all" && seasonFilter === "all" && !dateFrom && !dateTo) {
      return entries;
    }
    return entries.filter((e) => e.plant_instance_id && filteredInstanceIds.has(e.plant_instance_id));
  }, [entries, filteredEvents, instanceFilter, speciesFilter, locationFilter, seasonFilter, dateFrom, dateTo]);

  // ─── Groei per exemplaar derived ─────────────────────────────────────────
  // Seasons for the currently selected instance, newest first
  const instanceSeasons = useMemo(
    () => seasons
      .filter((s) => s.plant_instance_id === selectedInstanceId)
      .sort((a, b) => b.year - a.year || b.started_at.localeCompare(a.started_at)),
    [seasons, selectedInstanceId],
  );

  // Entries for the selected instance, optionally filtered by season
  const groeiEntries = useMemo(() => {
    if (!selectedInstanceId) return [];
    const forInstance = entries.filter((e) => e.plant_instance_id === selectedInstanceId);
    if (groeiSeasonId === "all") return forInstance;
    return forInstance.filter((e) => e.growing_season_id === groeiSeasonId);
  }, [entries, selectedInstanceId, groeiSeasonId]);

  // Photos for the selected instance (already filtered by instance in the hook)
  const groeiPhotos = useMemo(
    () => getPhotosForInstance(selectedInstanceId),
    [getPhotosForInstance, selectedInstanceId],
  );

  // ─── Form helpers ─────────────────────────────────────────────────────────
  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function selectInstance(instanceId: string) {
    const instance = instancesById.get(instanceId);
    if (!instance) return;
    const species = speciesById.get(instance.species_id);
    patch({
      plant_instance_id: instance.id,
      plant_id: instance.species_id,
      plant_name: plantInstanceDisplayName(instance, species),
      growing_season_id: activeSeasonByInstance.get(instance.id) ?? null,
    });
  }

  function handleSave() {
    setFormError(null);
    if (!form.plant_instance_id) {
      setFormError("Kies eerst een exemplaar.");
      return;
    }
    addEntry(form);
    setForm(emptyForm());
    setFormOpen(false);
  }

  function handleInstanceSelect(instanceId: string) {
    setSelectedInstanceId(instanceId);
    // Pre-select the active season for this instance, or "all" when none
    const activeSeason = seasons.find(
      (s) => s.plant_instance_id === instanceId && s.status === "active",
    );
    setGroeiSeasonId(activeSeason ? activeSeason.id : "all");
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex sv-inset rounded-full p-1 gap-1">
          <button type="button" onClick={() => setView("logboek")} className={segBtn(view === "logboek")}>
            Logboek
          </button>
          <button type="button" onClick={() => setView("groei")} className={segBtn(view === "groei")}>
            📷 Groei per exemplaar
          </button>
        </div>

        {view === "logboek" && (
          <Button onClick={() => setFormOpen((v) => !v)} className="sv-button gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Toevoegen
          </Button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOGBOEK VIEW                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {view === "logboek" && (
        <>
          {formOpen && (
            <div className="sv-panel p-5 space-y-4">
              <p className="sv-heading text-xl">Nieuwe notitie</p>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Exemplaar</label>
                  <select
                    value={form.plant_instance_id ?? ""}
                    onChange={(e) => (e.target.value ? selectInstance(e.target.value) : patch({ plant_instance_id: null, plant_id: null, plant_name: "", growing_season_id: null }))}
                    className="w-full px-3 py-2 text-sm focus:outline-none sv-inset rounded-lg"
                  >
                    <option value="">Kies een exemplaar...</option>
                    {activeInstances.map((i) => {
                      const species = speciesById.get(i.species_id);
                      return (
                        <option key={i.id} value={i.id}>
                          {plantInstanceDisplayName(i, species)}{species ? ` — ${species.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Datum</label>
                  <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Hoogte (cm)</label>
                  <Input type="number" min={0} placeholder="bijv. 45" value={form.height_cm ?? ""} onChange={(e) => patch({ height_cm: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Bloemen</label>
                  <Input type="number" min={0} placeholder="0" value={form.flower_count ?? ""} onChange={(e) => patch({ flower_count: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Vruchten</label>
                  <Input type="number" min={0} placeholder="0" value={form.fruit_count ?? ""} onChange={(e) => patch({ fruit_count: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs sv-muted">Foto URL (optioneel)</label>
                <Input placeholder="https://..." value={form.photo_url} onChange={(e) => patch({ photo_url: e.target.value })} />
              </div>

              <Textarea placeholder="Notities..." rows={3} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.watered} onChange={(e) => patch({ watered: e.target.checked })} />
                  💧 Water gegeven
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.fertilized} onChange={(e) => patch({ fertilized: e.target.checked })} />
                  🌿 Bemest
                </label>
              </div>

              {formError && <p className="text-xs sv-destructive-text">{formError}</p>}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!form.plant_instance_id || isAdding} className="sv-button">Opslaan</Button>
                <Button variant="ghost" onClick={() => { setForm(emptyForm()); setFormError(null); setFormOpen(false); }} className="sv-button sv-button-ghost">Annuleer</Button>
              </div>
            </div>
          )}

          <div className="sv-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="sv-heading text-lg">Filters</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setInstanceFilter("all"); setSpeciesFilter("all"); setLocationFilter("all"); setSeasonFilter("all"); setDateFrom(""); setDateTo(""); }}
                  className="text-xs sv-muted underline"
                >
                  Wis filters ({activeFilterCount})
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs sv-muted">Exemplaar</label>
                <select value={instanceFilter} onChange={(e) => setInstanceFilter(e.target.value)} className="w-full px-3 py-2 text-sm sv-inset rounded-lg">
                  <option value="all">Alle exemplaren</option>
                  {instances.map((i) => {
                    const species = speciesById.get(i.species_id);
                    return (
                      <option key={i.id} value={i.id}>
                        {plantInstanceDisplayName(i, species)}{species ? ` — ${species.name}` : ""}{i.status !== "active" ? ` (${i.status})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Plantsoort</label>
                <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} className="w-full px-3 py-2 text-sm sv-inset rounded-lg">
                  <option value="all">Alle plantsoorten</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Locatie</label>
                <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full px-3 py-2 text-sm sv-inset rounded-lg">
                  <option value="all">Alle locaties</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Seizoen</label>
                <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="w-full px-3 py-2 text-sm sv-inset rounded-lg">
                  <option value="all">Alle seizoenen</option>
                  <option value="current">Huidig (actieve) seizoenen</option>
                  {seasons.map((s) => {
                    const instance = instancesById.get(s.plant_instance_id);
                    const species = instance ? speciesById.get(instance.species_id) : undefined;
                    const name = instance ? plantInstanceDisplayName(instance, species) : "Onbekend exemplaar";
                    return (
                      <option key={s.id} value={s.id}>
                        {name} — {s.label ?? `Seizoen ${s.year}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Vanaf</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Tot en met</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <LogboekDashboard events={filteredEvents} />
          <LogboekTimeline events={filteredEvents} metaById={eventMetaById} />
          <GrowthComparisonChart entries={filteredEntries} />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* GROEI PER EXEMPLAAR VIEW                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {view === "groei" && (
        <div className="space-y-5">
          {/* Controls row */}
          <div className="grid sm:grid-cols-3 gap-3">
            {/* Instance selector — all instances (active + archived/dead so
                historical photos remain accessible) */}
            <div className="space-y-1">
              <label className="text-xs sv-muted font-medium">Plantexemplaar</label>
              <select
                value={selectedInstanceId}
                onChange={(e) => handleInstanceSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm focus:outline-none sv-inset rounded-lg"
              >
                <option value="">Kies een exemplaar...</option>
                {instances.map((i) => {
                  const species = speciesById.get(i.species_id);
                  const activeSeason = seasons.find(
                    (s) => s.plant_instance_id === i.id && s.status === "active",
                  );
                  return (
                    <option key={i.id} value={i.id}>
                      {plantInstanceDisplayName(i, species)}
                      {species ? ` — ${species.name}` : ""}
                      {activeSeason ? ` (${activeSeason.label ?? `Seizoen ${activeSeason.year}`})` : ""}
                      {i.status !== "active" ? ` · ${i.status}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Season selector — only visible when an instance is selected */}
            {selectedInstanceId && (
              <div className="space-y-1">
                <label className="text-xs sv-muted font-medium">Seizoen</label>
                <select
                  value={groeiSeasonId}
                  onChange={(e) => setGroeiSeasonId(e.target.value)}
                  className="w-full px-3 py-2 text-sm focus:outline-none sv-inset rounded-lg"
                >
                  <option value="all">Alle seizoenen</option>
                  {instanceSeasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label ?? `Seizoen ${s.year}`}
                      {s.status === "active" ? " (actief)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort direction */}
            {selectedInstanceId && groeiEntries.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs sv-muted font-medium">Sortering</label>
                <div className="flex sv-inset rounded-full p-1 gap-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setSortDir("asc")}
                    className={segBtn(sortDir === "asc")}
                  >
                    Oudste eerst
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortDir("desc")}
                    className={segBtn(sortDir === "desc")}
                  >
                    Nieuwste eerst
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          {!selectedInstanceId ? (
            <p className="text-sm sv-muted">
              Kies een plantexemplaar om de groei te bekijken.
            </p>
          ) : (
            <div className="sv-panel p-5">
              <GrowthPhotoTimeline
                entries={groeiEntries}
                photos={groeiPhotos}
                showLightbox
                sortDir={sortDir}
                emptyMessage="Voor dit plantexemplaar zijn nog geen groeifoto's vastgelegd. Voeg een foto toe via 🌱 Groei bijhouden bij het exemplaar."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
