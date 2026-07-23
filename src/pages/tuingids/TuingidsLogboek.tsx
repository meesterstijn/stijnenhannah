import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Sprout } from "lucide-react";
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
import { INSTANCE_STATUS_LABELS } from "@/features/tuingids/lib/plantInstanceStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LogboekDashboard } from "@/features/tuingids/components/LogboekDashboard";
import { LogboekTimeline, type LogboekEventMeta } from "@/features/tuingids/components/LogboekTimeline";
import { GrowthComparisonChart } from "@/features/tuingids/components/GrowthComparisonChart";
import { GrowthPhotoTimeline } from "@/features/tuingids/components/GrowthPhotoTimeline";
import type { LogEntry } from "@/features/tuingids/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = Omit<LogEntry, "id" | "created_at">;
type GroeiSortKey =
  | "name_asc"
  | "name_desc"
  | "newest"
  | "oldest"
  | "most_photos"
  | "most_entries"
  | "last_updated";
type GroeiStatusFilter = "all" | "active" | "inactive" | "Meerjarig" | "Eenjarig";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function chipBtn(active: boolean) {
  return `sv-chip px-3 py-1.5 text-sm font-medium${active ? " active" : ""}`;
}

function formatDateNl(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── GrowthInstanceTile ──────────────────────────────────────────────────────

function GrowthInstanceTile({
  instance,
  species,
  displaySeason,
  photoCount,
  entryCount,
  lastUpdated,
  isSelected,
  onSelect,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  displaySeason: GrowingSeason | undefined;
  photoCount: number;
  entryCount: number;
  lastUpdated: string | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const name = plantInstanceDisplayName(instance, species);
  const showSpeciesSubtitle = species && species.name !== name;

  const seasonLabel = displaySeason
    ? (displaySeason.label ?? `Seizoen ${displaySeason.year}`) +
      (displaySeason.status === "active" ? " · Actief" : " · Afgerond")
    : null;

  const statusLabel =
    instance.status !== "active" ? INSTANCE_STATUS_LABELS[instance.status] : null;

  const lifecycleLabel = species?.lifecycle ?? null;

  const stats = [
    photoCount > 0 ? `${photoCount} foto${photoCount === 1 ? "" : "'s"}` : null,
    entryCount > 0 ? `${entryCount} logboekitem${entryCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`sv-panel w-full text-left p-4 flex items-start gap-3 transition-all ${
        isSelected ? "ring-2 ring-green-500 ring-offset-1" : "hover:-translate-y-0.5"
      }`}
    >
      {species?.photo_url ? (
        <img
          src={species.photo_url}
          alt=""
          className="h-14 w-14 rounded-lg object-cover shrink-0 sv-icon-slot"
        />
      ) : (
        <div className="h-14 w-14 sv-icon-slot flex items-center justify-center shrink-0">
          <Sprout className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="sv-heading text-xl leading-snug truncate">{name}</p>

        {showSpeciesSubtitle && (
          <p className="text-xs sv-muted truncate">{species!.name}</p>
        )}

        {instance.location && (
          <p className="text-xs sv-muted truncate">{instance.location}</p>
        )}

        {seasonLabel && (
          <p className="text-xs sv-muted truncate">{seasonLabel}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {statusLabel && (
            <span className="inline-block text-xs sv-badge-overdue rounded-full px-2 py-0.5">
              {statusLabel}
            </span>
          )}
          {lifecycleLabel && (
            <span className="inline-block text-xs sv-badge-ok rounded-full px-2 py-0.5">
              {lifecycleLabel}
            </span>
          )}
        </div>

        {stats && <p className="text-xs sv-muted truncate mt-0.5">{stats}</p>}

        {lastUpdated && (
          <p className="text-xs sv-muted truncate">
            Bijgewerkt {formatDateNl(lastUpdated)}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TuingidsLogboek() {
  const { entries, addEntry, isAdding } = useGrowthLog();
  const { photos: growthLogPhotos, getPhotosForInstance } = useGrowthPhotos();

  // ─── Top-level tab ───────────────────────────────────────────────────────
  const [view, setView] = useState<"logboek" | "groei">("logboek");

  // ─── Logboek form ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Groei per exemplaar state ───────────────────────────────────────────
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groeiSearch, setGroeiSearch] = useState("");
  const [groeiStatusFilter, setGroeiStatusFilter] = useState<GroeiStatusFilter>("all");
  const [groeiSortKey, setGroeiSortKey] = useState<GroeiSortKey>("name_asc");

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
  const activeSeasonIds = useMemo(
    () => new Set(seasons.filter((s) => s.status === "active").map((s) => s.id)),
    [seasons],
  );
  const activeSeasonByInstance = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seasons) if (s.status === "active") map.set(s.plant_instance_id, s.id);
    return map;
  }, [seasons]);

  const locations = useMemo(
    () =>
      [...new Set(instances.map((i) => i.location).filter((l): l is string => !!l))].sort((a, b) =>
        a.localeCompare(b, "nl"),
      ),
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
    () =>
      buildAllLogboekEvents({
        entries,
        harvestLogs,
        pruningLogs,
        repotLogs,
        plants,
        instances,
        seasons,
        inspectionLogs,
        photos,
      }),
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
      const species = instance
        ? speciesById.get(instance.species_id)
        : e.plantId
          ? speciesById.get(e.plantId)
          : undefined;
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
    const filteredInstanceIds = new Set(
      filteredEvents.map((e) => e.instanceId).filter((id): id is string => !!id),
    );
    if (
      instanceFilter === "all" &&
      speciesFilter === "all" &&
      locationFilter === "all" &&
      seasonFilter === "all" &&
      !dateFrom &&
      !dateTo
    ) {
      return entries;
    }
    return entries.filter(
      (e) => e.plant_instance_id && filteredInstanceIds.has(e.plant_instance_id),
    );
  }, [entries, filteredEvents, instanceFilter, speciesFilter, locationFilter, seasonFilter, dateFrom, dateTo]);

  // ─── Groei per exemplaar derived ─────────────────────────────────────────

  // Single-pass computation of all per-instance stats needed by the tile grid.
  const instanceStats = useMemo(() => {
    const photoCount = new Map<string, number>();
    for (const p of growthLogPhotos) {
      photoCount.set(p.plant_instance_id, (photoCount.get(p.plant_instance_id) ?? 0) + 1);
    }

    const entryCount = new Map<string, number>();
    const lastUpdated = new Map<string, string>();
    for (const e of entries) {
      if (!e.plant_instance_id) continue;
      entryCount.set(e.plant_instance_id, (entryCount.get(e.plant_instance_id) ?? 0) + 1);
      const cur = lastUpdated.get(e.plant_instance_id);
      if (!cur || e.date > cur) lastUpdated.set(e.plant_instance_id, e.date);
    }

    // Display season: prefer active season; fall back to most-recently-started.
    const displaySeason = new Map<string, GrowingSeason>();
    for (const s of seasons) {
      const cur = displaySeason.get(s.plant_instance_id);
      if (!cur || s.started_at > cur.started_at) displaySeason.set(s.plant_instance_id, s);
    }
    for (const s of seasons) {
      if (s.status === "active") displaySeason.set(s.plant_instance_id, s);
    }

    return { photoCount, entryCount, lastUpdated, displaySeason };
  }, [growthLogPhotos, entries, seasons]);

  // Filtered and sorted instance list for the tile grid.
  const groeiFilteredInstances = useMemo(() => {
    const q = groeiSearch.trim().toLowerCase();
    const filtered = instances.filter((i) => {
      const species = speciesById.get(i.species_id);
      if (q) {
        const searchable = [
          plantInstanceDisplayName(i, species),
          species?.name ?? "",
          species?.species ?? "",
          i.custom_name ?? "",
          i.location ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (groeiStatusFilter === "active" && i.status !== "active") return false;
      if (groeiStatusFilter === "inactive" && i.status === "active") return false;
      if (groeiStatusFilter === "Meerjarig" && species?.lifecycle !== "Meerjarig") return false;
      if (groeiStatusFilter === "Eenjarig" && species?.lifecycle !== "Eenjarig") return false;
      return true;
    });

    filtered.sort((a, b) => {
      const nA = plantInstanceDisplayName(a, speciesById.get(a.species_id)).toLowerCase();
      const nB = plantInstanceDisplayName(b, speciesById.get(b.species_id)).toLowerCase();
      switch (groeiSortKey) {
        case "name_asc":
          return nA.localeCompare(nB, "nl");
        case "name_desc":
          return nB.localeCompare(nA, "nl");
        case "newest":
          return (instanceStats.displaySeason.get(b.id)?.started_at ?? "").localeCompare(
            instanceStats.displaySeason.get(a.id)?.started_at ?? "",
          );
        case "oldest":
          return (instanceStats.displaySeason.get(a.id)?.started_at ?? "").localeCompare(
            instanceStats.displaySeason.get(b.id)?.started_at ?? "",
          );
        case "most_photos":
          return (
            (instanceStats.photoCount.get(b.id) ?? 0) -
            (instanceStats.photoCount.get(a.id) ?? 0)
          );
        case "most_entries":
          return (
            (instanceStats.entryCount.get(b.id) ?? 0) -
            (instanceStats.entryCount.get(a.id) ?? 0)
          );
        case "last_updated":
          return (instanceStats.lastUpdated.get(b.id) ?? "").localeCompare(
            instanceStats.lastUpdated.get(a.id) ?? "",
          );
        default:
          return nA.localeCompare(nB, "nl");
      }
    });

    return filtered;
  }, [instances, speciesById, groeiSearch, groeiStatusFilter, groeiSortKey, instanceStats]);

  // All growth log entries for the selected instance (season is implicit per tile).
  const groeiEntries = useMemo(() => {
    if (!selectedInstanceId) return [];
    return entries.filter((e) => e.plant_instance_id === selectedInstanceId);
  }, [entries, selectedInstanceId]);

  // Growth photos for the selected instance.
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

  // ─── Render ───────────────────────────────────────────────────────────────
  const selectedInstance = selectedInstanceId ? instancesById.get(selectedInstanceId) : null;
  const selectedSpecies = selectedInstance ? speciesById.get(selectedInstance.species_id) : null;
  const selectedInstanceName = selectedInstance
    ? plantInstanceDisplayName(selectedInstance, selectedSpecies ?? undefined)
    : null;

  const GROEI_FILTER_OPTIONS: { value: GroeiStatusFilter; label: string }[] = [
    { value: "all", label: "Alles" },
    { value: "active", label: "Actief" },
    { value: "inactive", label: "Afgerond" },
    { value: "Meerjarig", label: "Meerjarig" },
    { value: "Eenjarig", label: "Eenjarig" },
  ];

  const GROEI_SORT_OPTIONS: { value: GroeiSortKey; label: string }[] = [
    { value: "name_asc", label: "Naam A–Z" },
    { value: "name_desc", label: "Naam Z–A" },
    { value: "newest", label: "Nieuwste seizoen" },
    { value: "oldest", label: "Oudste seizoen" },
    { value: "most_photos", label: "Meeste foto's" },
    { value: "most_entries", label: "Meeste notities" },
    { value: "last_updated", label: "Bijgewerkt" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex sv-inset rounded-full p-1 gap-1">
          <button
            type="button"
            onClick={() => setView("logboek")}
            className={segBtn(view === "logboek")}
          >
            Logboek
          </button>
          <button
            type="button"
            onClick={() => setView("groei")}
            className={segBtn(view === "groei")}
          >
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
                    onChange={(e) =>
                      e.target.value
                        ? selectInstance(e.target.value)
                        : patch({
                            plant_instance_id: null,
                            plant_id: null,
                            plant_name: "",
                            growing_season_id: null,
                          })
                    }
                    className="w-full px-3 py-2 text-sm focus:outline-none sv-inset rounded-lg"
                  >
                    <option value="">Kies een exemplaar...</option>
                    {activeInstances.map((i) => {
                      const species = speciesById.get(i.species_id);
                      return (
                        <option key={i.id} value={i.id}>
                          {plantInstanceDisplayName(i, species)}
                          {species ? ` — ${species.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Datum</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Hoogte (cm)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="bijv. 45"
                    value={form.height_cm ?? ""}
                    onChange={(e) =>
                      patch({ height_cm: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Bloemen</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.flower_count ?? ""}
                    onChange={(e) =>
                      patch({ flower_count: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs sv-muted">Vruchten</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.fruit_count ?? ""}
                    onChange={(e) =>
                      patch({ fruit_count: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs sv-muted">Foto URL (optioneel)</label>
                <Input
                  placeholder="https://..."
                  value={form.photo_url}
                  onChange={(e) => patch({ photo_url: e.target.value })}
                />
              </div>

              <Textarea
                placeholder="Notities..."
                rows={3}
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.watered}
                    onChange={(e) => patch({ watered: e.target.checked })}
                  />
                  💧 Water gegeven
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.fertilized}
                    onChange={(e) => patch({ fertilized: e.target.checked })}
                  />
                  🌿 Bemest
                </label>
              </div>

              {formError && <p className="text-xs sv-destructive-text">{formError}</p>}

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!form.plant_instance_id || isAdding}
                  className="sv-button"
                >
                  Opslaan
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm(emptyForm());
                    setFormError(null);
                    setFormOpen(false);
                  }}
                  className="sv-button sv-button-ghost"
                >
                  Annuleer
                </Button>
              </div>
            </div>
          )}

          <div className="sv-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="sv-heading text-lg">Filters</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInstanceFilter("all");
                    setSpeciesFilter("all");
                    setLocationFilter("all");
                    setSeasonFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-xs sv-muted underline"
                >
                  Wis filters ({activeFilterCount})
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs sv-muted">Exemplaar</label>
                <select
                  value={instanceFilter}
                  onChange={(e) => setInstanceFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm sv-inset rounded-lg"
                >
                  <option value="all">Alle exemplaren</option>
                  {instances.map((i) => {
                    const species = speciesById.get(i.species_id);
                    return (
                      <option key={i.id} value={i.id}>
                        {plantInstanceDisplayName(i, species)}
                        {species ? ` — ${species.name}` : ""}
                        {i.status !== "active" ? ` (${i.status})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Plantsoort</label>
                <select
                  value={speciesFilter}
                  onChange={(e) => setSpeciesFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm sv-inset rounded-lg"
                >
                  <option value="all">Alle plantsoorten</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Locatie</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm sv-inset rounded-lg"
                >
                  <option value="all">Alle locaties</option>
                  {locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Seizoen</label>
                <select
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm sv-inset rounded-lg"
                >
                  <option value="all">Alle seizoenen</option>
                  <option value="current">Huidig (actieve) seizoenen</option>
                  {seasons.map((s) => {
                    const instance = instancesById.get(s.plant_instance_id);
                    const species = instance ? speciesById.get(instance.species_id) : undefined;
                    const name = instance
                      ? plantInstanceDisplayName(instance, species)
                      : "Onbekend exemplaar";
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
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs sv-muted">Tot en met</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
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
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sv-muted pointer-events-none" />
            <Input
              placeholder="Zoek exemplaar op naam, soort of locatie..."
              value={groeiSearch}
              onChange={(e) => setGroeiSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {GROEI_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroeiStatusFilter(opt.value)}
                className={chipBtn(groeiStatusFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {GROEI_SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroeiSortKey(opt.value)}
                className={chipBtn(groeiSortKey === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tile grid */}
          {instances.length === 0 ? (
            <div className="sv-panel p-10 text-center">
              <Sprout className="h-10 w-10 mx-auto sv-muted" strokeWidth={1.4} />
              <p className="sv-heading text-2xl mt-4">Nog geen exemplaren</p>
              <p className="text-sm sv-muted mt-1">
                Voeg een exemplaar toe via Mijn tuin om de groei bij te houden.
              </p>
            </div>
          ) : groeiFilteredInstances.length === 0 ? (
            <p className="text-sm sv-muted px-1">
              Geen exemplaren gevonden. Probeer een andere zoekopdracht of filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groeiFilteredInstances.map((instance) => (
                <GrowthInstanceTile
                  key={instance.id}
                  instance={instance}
                  species={speciesById.get(instance.species_id)}
                  displaySeason={instanceStats.displaySeason.get(instance.id)}
                  photoCount={instanceStats.photoCount.get(instance.id) ?? 0}
                  entryCount={instanceStats.entryCount.get(instance.id) ?? 0}
                  lastUpdated={instanceStats.lastUpdated.get(instance.id)}
                  isSelected={selectedInstanceId === instance.id}
                  onSelect={() => setSelectedInstanceId(instance.id)}
                />
              ))}
            </div>
          )}

          {/* Groeilogboek for the selected instance */}
          {selectedInstance && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="sv-heading text-2xl truncate">{selectedInstanceName}</p>
                  {selectedSpecies && selectedSpecies.name !== selectedInstanceName && (
                    <p className="text-sm sv-muted">{selectedSpecies.name}</p>
                  )}
                </div>
                <div className="flex sv-inset rounded-full p-1 gap-1 shrink-0">
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

              <div className="sv-panel p-5">
                <GrowthPhotoTimeline
                  entries={groeiEntries}
                  photos={groeiPhotos}
                  showLightbox
                  sortDir={sortDir}
                  emptyMessage="Voor dit plantexemplaar zijn nog geen groeifoto's vastgelegd. Voeg een foto toe via 🌱 Groei bijhouden bij het exemplaar."
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
