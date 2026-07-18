import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type Plant, type PlantPhoto } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Sprout,
  Droplet,
  Trash2,
  Loader2,
  Pencil,
  X,
  Image as ImageIcon,
} from "lucide-react";

const SUN_OPTIONS = ["Volle zon", "Half schaduw", "Schaduw"] as const;

const LIFECYCLE_OPTIONS = ["Eenjarig", "Meerjarig"] as const;

const WINTER_HARDINESS_OPTIONS = [
  "Winterhard",
  "Beperkt winterhard",
  "Niet winterhard",
] as const;

const PROPAGATION_OPTIONS = [
  "Stekken",
  "Zaad",
  "Scheuren / delen",
  "Uitlopers",
  "Bladstek",
  "Knollen / bollen",
] as const;

const MONTH_OPTIONS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function chipClass(active: boolean): string {
  return `sv-chip px-3 py-1.5 text-sm font-medium${active ? " active" : ""}`;
}

function monthChipClass(active: boolean): string {
  return `sv-chip px-3 py-1 text-xs font-medium capitalize${active ? " active" : ""}`;
}

function warnChipClass(active: boolean): string {
  return `sv-chip px-3 py-1.5 text-sm font-medium${active ? " active warn" : ""}`;
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="text-2xl font-semibold tracking-wide sv-heading">
      {children}
    </p>
  );
}

type PlantDraft = {
  name: string;
  species: string;
  fun_fact: string;
  location: string;
  lifecycle: string;
  size_cm: string;
  sun_needs: string;
  season_notes: string;
  water_notes: string;
  planted: boolean;
  water_interval_days: string;
  last_watered_at: string;
  feeding_notes: string;
  soil_notes: string;
  temperature_notes: string;
  humidity_notes: string;
  winter_hardiness: string;
  winter_notes: string;
  pruning_notes: string;
  pest_notes: string;
  toxic_to_humans: boolean;
  toxic_to_cats: boolean;
  toxicity_notes: string;
  sow_months: string[];
  sow_week: string;
  sow_notes: string;
  bloom_months: string[];
  bloom_week: string;
  bloom_notes: string;
  propagation_methods: string[];
  propagation_notes: string;
  harvest_notes: string;
  harvest_months: string[];
  harvest_week: string;
  greenhouse_notes: string;
  general_notes: string;
  photo_url: string;
  reminders_enabled: boolean;
};

const emptyDraft: PlantDraft = {
  name: "",
  species: "",
  fun_fact: "",
  location: "",
  lifecycle: "",
  size_cm: "",
  sun_needs: "",
  season_notes: "",
  water_notes: "",
  planted: false,
  water_interval_days: "",
  last_watered_at: "",
  feeding_notes: "",
  soil_notes: "",
  temperature_notes: "",
  humidity_notes: "",
  winter_hardiness: "",
  winter_notes: "",
  pruning_notes: "",
  pest_notes: "",
  toxic_to_humans: false,
  toxic_to_cats: false,
  toxicity_notes: "",
  sow_months: [],
  sow_week: "",
  sow_notes: "",
  bloom_months: [],
  bloom_week: "",
  bloom_notes: "",
  propagation_methods: [],
  propagation_notes: "",
  harvest_notes: "",
  harvest_months: [],
  harvest_week: "",
  greenhouse_notes: "",
  general_notes: "",
  photo_url: "",
  reminders_enabled: true,
};

function plantToDraft(p: Plant): PlantDraft {
  return {
    name: p.name,
    species: p.species ?? "",
    fun_fact: p.fun_fact ?? "",
    location: p.location ?? "",
    lifecycle: p.lifecycle ?? "",
    size_cm: p.size_cm ? String(p.size_cm) : "",
    sun_needs: p.sun_needs ?? "",
    season_notes: p.season_notes ?? "",
    water_notes: p.water_notes ?? "",
    planted: p.planted,
    water_interval_days: p.water_interval_days
      ? String(p.water_interval_days)
      : "",
    last_watered_at: p.last_watered_at ? p.last_watered_at.slice(0, 10) : "",
    feeding_notes: p.feeding_notes ?? "",
    soil_notes: p.soil_notes ?? "",
    temperature_notes: p.temperature_notes ?? "",
    humidity_notes: p.humidity_notes ?? "",
    winter_hardiness: p.winter_hardiness ?? "",
    winter_notes: p.winter_notes ?? "",
    pruning_notes: p.pruning_notes ?? "",
    pest_notes: p.pest_notes ?? "",
    toxic_to_humans: p.toxic_to_humans,
    toxic_to_cats: p.toxic_to_cats,
    toxicity_notes: p.toxicity_notes ?? "",
    sow_months: p.sow_months ?? [],
    sow_week: p.sow_week ?? "",
    sow_notes: p.sow_notes ?? "",
    bloom_months: p.bloom_months ?? [],
    bloom_week: p.bloom_week ?? "",
    bloom_notes: p.bloom_notes ?? "",
    propagation_methods: p.propagation_methods ?? [],
    propagation_notes: p.propagation_notes ?? "",
    harvest_notes: p.harvest_notes ?? "",
    harvest_months: p.harvest_months ?? [],
    harvest_week: p.harvest_week ?? "",
    greenhouse_notes: p.greenhouse_notes ?? "",
    general_notes: p.general_notes ?? "",
    photo_url: p.photo_url ?? "",
    reminders_enabled: p.reminders_enabled,
  };
}

function draftToRow(d: PlantDraft) {
  return {
    name: d.name.trim(),
    species: d.species.trim() || null,
    fun_fact: d.fun_fact.trim() || null,
    location: d.location.trim() || null,
    lifecycle: d.lifecycle || null,
    size_cm: d.size_cm ? Number(d.size_cm) : null,
    sun_needs: d.sun_needs || null,
    season_notes: d.season_notes.trim() || null,
    water_notes: d.water_notes.trim() || null,
    planted: d.planted,
    water_interval_days: d.water_interval_days
      ? Number(d.water_interval_days)
      : null,
    last_watered_at: d.last_watered_at
      ? new Date(d.last_watered_at).toISOString()
      : null,
    feeding_notes: d.feeding_notes.trim() || null,
    soil_notes: d.soil_notes.trim() || null,
    temperature_notes: d.temperature_notes.trim() || null,
    humidity_notes: d.humidity_notes.trim() || null,
    winter_hardiness: d.winter_hardiness || null,
    winter_notes: d.winter_notes.trim() || null,
    pruning_notes: d.pruning_notes.trim() || null,
    pest_notes: d.pest_notes.trim() || null,
    toxic_to_humans: d.toxic_to_humans,
    toxic_to_cats: d.toxic_to_cats,
    toxicity_notes: d.toxicity_notes.trim() || null,
    sow_months: d.sow_months,
    sow_week: d.sow_week.trim() || null,
    sow_notes: d.sow_notes.trim() || null,
    bloom_months: d.bloom_months,
    bloom_week: d.bloom_week.trim() || null,
    bloom_notes: d.bloom_notes.trim() || null,
    propagation_methods: d.propagation_methods,
    propagation_notes: d.propagation_notes.trim() || null,
    harvest_notes: d.harvest_notes.trim() || null,
    harvest_months: d.harvest_months,
    harvest_week: d.harvest_week.trim() || null,
    greenhouse_notes: d.greenhouse_notes.trim() || null,
    general_notes: d.general_notes.trim() || null,
    photo_url: d.photo_url.trim() || null,
    reminders_enabled: d.reminders_enabled,
  };
}

function waterStatus(p: Plant): { label: string; overdue: boolean } | null {
  if (!p.planted) return null;
  if (!p.water_interval_days) return null;
  if (!p.last_watered_at)
    return { label: "Nog geen water gegeven", overdue: true };
  const dueAt =
    new Date(p.last_watered_at).getTime() +
    p.water_interval_days * 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return { label: "Water geven!", overdue: true };
  if (daysLeft === 1) return { label: "Morgen water geven", overdue: false };
  return { label: `Over ${daysLeft} dagen`, overdue: false };
}

async function fetchPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plants")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchPhotos(plantId: string): Promise<PlantPhoto[]> {
  const { data, error } = await supabase
    .from("plant_photos")
    .select("*")
    .eq("plant_id", plantId)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function PlantForm({
  draft,
  onChange,
}: {
  draft: PlantDraft;
  onChange: (patch: Partial<PlantDraft>) => void;
}) {
  return (
    <div className="space-y-5">
      <Input
        placeholder="Naam plant"
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Soort (Latijnse naam)"
          value={draft.species}
          onChange={(e) => onChange({ species: e.target.value })}
        />
        <Input
          placeholder="Foto: link of /plant-fotos/bestand.jpg"
          value={draft.photo_url}
          onChange={(e) => onChange({ photo_url: e.target.value })}
        />
      </div>
      <Textarea
        placeholder="Leuk weetje over deze plant (optioneel)"
        rows={2}
        value={draft.fun_fact}
        onChange={(e) => onChange({ fun_fact: e.target.value })}
      />

      <div className="space-y-2">
        <SectionHeading>Eenjarig of meerjarig</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {LIFECYCLE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ lifecycle: draft.lifecycle === opt ? "" : opt })
              }
              className={chipClass(draft.lifecycle === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Grootte in cm</SectionHeading>
        <Input
          type="number"
          min={1}
          placeholder="bv. 150"
          value={draft.size_cm}
          onChange={(e) => onChange({ size_cm: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Standplaats & seizoen</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {SUN_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ sun_needs: draft.sun_needs === opt ? "" : opt })
              }
              className={chipClass(draft.sun_needs === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.season_notes}
          onChange={(e) => onChange({ season_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Water</SectionHeading>
        <Textarea
          placeholder="Water-notities"
          rows={2}
          value={draft.water_notes}
          onChange={(e) => onChange({ water_notes: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm sv-muted">
          <input
            type="checkbox"
            checked={draft.planted}
            onChange={(e) => onChange({ planted: e.target.checked })}
          />
          Gepland (in de grond/pot gezet)
        </label>
        {draft.planted && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs sv-muted">Elke hoeveel dagen water</p>
                <Input
                  type="number"
                  min={1}
                  placeholder="bv. 7"
                  value={draft.water_interval_days}
                  onChange={(e) =>
                    onChange({ water_interval_days: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs sv-muted">Laatst water gegeven op</p>
                <Input
                  type="date"
                  value={draft.last_watered_at}
                  onChange={(e) =>
                    onChange({ last_watered_at: e.target.value })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm sv-muted">
              <input
                type="checkbox"
                checked={draft.reminders_enabled}
                onChange={(e) =>
                  onChange({ reminders_enabled: e.target.checked })
                }
              />
              Stuur een melding als het tijd is om water te geven
            </label>
          </>
        )}
      </div>

      <div className="space-y-2">
        <SectionHeading>Zaaien</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({ sow_months: toggleInArray(draft.sow_months, month) })
              }
              className={monthChipClass(draft.sow_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Zaaiweek (optioneel, bv. week 2)"
          value={draft.sow_week}
          onChange={(e) => onChange({ sow_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige zaai-notities"
          rows={2}
          value={draft.sow_notes}
          onChange={(e) => onChange({ sow_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Bloeien (indien bloemen)</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({
                  bloom_months: toggleInArray(draft.bloom_months, month),
                })
              }
              className={monthChipClass(draft.bloom_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Bloeiweek (optioneel, bv. week 2)"
          value={draft.bloom_week}
          onChange={(e) => onChange({ bloom_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige bloei-notities"
          rows={2}
          value={draft.bloom_notes}
          onChange={(e) => onChange({ bloom_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Oogst</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {MONTH_OPTIONS.map((month) => (
            <button
              key={month}
              type="button"
              onClick={() =>
                onChange({
                  harvest_months: toggleInArray(draft.harvest_months, month),
                })
              }
              className={monthChipClass(draft.harvest_months.includes(month))}
            >
              {month}
            </button>
          ))}
        </div>
        <Input
          placeholder="Oogstweek (optioneel, bv. week 2)"
          value={draft.harvest_week}
          onChange={(e) => onChange({ harvest_week: e.target.value })}
        />
        <Textarea
          placeholder="Overige oogst-notities"
          rows={2}
          value={draft.harvest_notes}
          onChange={(e) => onChange({ harvest_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Kas</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.greenhouse_notes}
          onChange={(e) => onChange({ greenhouse_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Voeding</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.feeding_notes}
          onChange={(e) => onChange({ feeding_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Grond</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.soil_notes}
          onChange={(e) => onChange({ soil_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Klimaat</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.temperature_notes}
          onChange={(e) => onChange({ temperature_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Winterhardheid</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {WINTER_HARDINESS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  winter_hardiness: draft.winter_hardiness === opt ? "" : opt,
                })
              }
              className={chipClass(draft.winter_hardiness === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Winter-notities (bv. vorstvrij houden, afdekken met vorstdoek)"
          rows={2}
          value={draft.winter_notes}
          onChange={(e) => onChange({ winter_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Snoeien</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.pruning_notes}
          onChange={(e) => onChange({ pruning_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Ziektes & plagen</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.pest_notes}
          onChange={(e) => onChange({ pest_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Vermeerderen</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {PROPAGATION_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  propagation_methods: toggleInArray(
                    draft.propagation_methods,
                    opt,
                  ),
                })
              }
              className={chipClass(draft.propagation_methods.includes(opt))}
            >
              {opt}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Overige vermeerder-notities"
          rows={2}
          value={draft.propagation_notes}
          onChange={(e) => onChange({ propagation_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Giftigheid</SectionHeading>
        <p className="text-sm sv-muted">Giftig voor</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onChange({ toxic_to_humans: !draft.toxic_to_humans })
            }
            className={warnChipClass(draft.toxic_to_humans)}
          >
            Mens
          </button>
          <button
            type="button"
            onClick={() => onChange({ toxic_to_cats: !draft.toxic_to_cats })}
            className={warnChipClass(draft.toxic_to_cats)}
          >
            Kat
          </button>
        </div>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.toxicity_notes}
          onChange={(e) => onChange({ toxicity_notes: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Overig</SectionHeading>
        <Textarea
          placeholder="Notities"
          rows={2}
          value={draft.general_notes}
          onChange={(e) => onChange({ general_notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-2xl font-bold tracking-wide sv-heading">{label}</p>
      <p className="text-sm mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function Tuinieren() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlantDraft>(emptyDraft);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [view, setView] = useState<Plant | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<PlantDraft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");

  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["plants"],
    queryFn: fetchPlants,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["plant_photos", view?.id],
    queryFn: () => fetchPhotos(view!.id),
    enabled: !!view,
  });

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setDraft(emptyDraft);
      setSaveError(null);
    }
  }

  const addPlant = useMutation({
    mutationFn: async (d: PlantDraft) => {
      const { error } = await supabase
        .from("plants")
        .insert({ ...draftToRow(d), created_by: session?.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      handleOpenChange(false);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const updatePlant = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("plants")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setView((prev) => (prev ? ({ ...prev, ...patch } as Plant) : null));
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deletePlant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setView(null);
    },
  });

  const addPhoto = useMutation({
    mutationFn: async ({ plantId, url }: { plantId: string; url: string }) => {
      const { error } = await supabase
        .from("plant_photos")
        .insert({ plant_id: plantId, photo_url: url });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plant_photos", view?.id] });
      setPhotoUrlDraft("");
    },
  });

  const removePhoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plant_photos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["plant_photos", view?.id] }),
  });

  function startEdit() {
    if (!view) return;
    setEditDraft(plantToDraft(view));
    setSaveError(null);
    setEditMode(true);
  }

  function handleSaveEdit() {
    if (!view || !editDraft.name.trim()) return;
    updatePlant.mutate(
      { id: view.id, patch: draftToRow(editDraft) },
      { onSuccess: () => setEditMode(false) },
    );
  }

  function markWatered() {
    if (!view) return;
    updatePlant.mutate({
      id: view.id,
      patch: {
        last_watered_at: new Date().toISOString(),
        last_water_reminder_sent_at: null,
      },
    });
  }

  return (
    <div className="tuinieren-theme space-y-8">
      <header className="flex items-end justify-end gap-4 flex-wrap">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="lg" className="sv-button text-2xl">
              <Plus className="h-4 w-4" /> Nieuwe plant
            </Button>
          </DialogTrigger>
          <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh] overflow-y-auto scrollbar-none">
            <DialogHeader>
              <DialogTitle className="sv-heading text-3xl">
                Nieuwe plant
              </DialogTitle>
            </DialogHeader>
            <PlantForm
              draft={draft}
              onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            />
            {saveError && (
              <p className="text-sm sv-destructive-text">{saveError}</p>
            )}
            <DialogFooter>
              <Button
                onClick={() => addPlant.mutate(draft)}
                disabled={!draft.name.trim() || addPlant.isPending}
                className="sv-button"
              >
                {addPlant.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Opslaan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12 sv-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : plants.length === 0 ? (
        <div className="sv-panel p-12 text-center">
          <Sprout className="h-10 w-10 mx-auto" strokeWidth={1.4} />
          <p className="sv-heading text-2xl mt-4">Nog geen planten</p>
          <p className="text-sm sv-muted mt-1">
            Voeg je eerste plant toe om bij te houden.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plants.map((p) => {
            const status = waterStatus(p);
            return (
              <button
                key={p.id}
                onClick={() => setView(p)}
                className="sv-panel text-left p-5 hover:-translate-y-0.5 transition-transform flex items-center gap-3"
              >
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot"
                  />
                ) : (
                  <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                    <Sprout className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="sv-heading text-2xl leading-snug truncate">
                    {p.name}
                  </p>
                  {p.location && (
                    <p className="text-xs sv-muted truncate">{p.location}</p>
                  )}
                  {status && (
                    <span
                      className={`sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit mt-1 ${
                        status.overdue ? "sv-badge-overdue" : "sv-badge-ok"
                      }`}
                    >
                      <Droplet className="h-3 w-3" /> {status.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) {
            setView(null);
            setConfirmDelete(false);
            setEditMode(false);
          }
        }}
      >
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-none">
          {view && editMode ? (
            <>
              <DialogHeader>
                <DialogTitle className="sv-heading text-3xl">
                  Plant bewerken
                </DialogTitle>
              </DialogHeader>
              <PlantForm
                draft={editDraft}
                onChange={(patch) =>
                  setEditDraft((prev) => ({ ...prev, ...patch }))
                }
              />
              {saveError && (
                <p className="text-sm sv-destructive-text">{saveError}</p>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="sv-button sv-button-ghost"
                  onClick={() => {
                    setEditMode(false);
                    setSaveError(null);
                  }}
                >
                  Annuleer
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editDraft.name.trim() || updatePlant.isPending}
                  className="sv-button"
                >
                  {updatePlant.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Opslaan"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : view ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {view.photo_url ? (
                    <img
                      src={view.photo_url}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot"
                    />
                  ) : (
                    <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
                      <Sprout className="h-5 w-5" strokeWidth={1.6} />
                    </div>
                  )}
                  <DialogTitle className="sv-heading text-3xl sm:text-4xl leading-snug">
                    {view.name}
                  </DialogTitle>
                </div>
              </DialogHeader>

              {view.fun_fact && (
                <p className="text-sm italic sv-inset px-4 py-3">
                  {view.fun_fact}
                </p>
              )}

              {(() => {
                const status = waterStatus(view);
                return (
                  <div className="flex items-center gap-3 flex-wrap">
                    {status && (
                      <span
                        className={`sv-heading inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full ${
                          status.overdue ? "sv-badge-overdue" : "sv-badge-ok"
                        }`}
                      >
                        <Droplet className="h-3.5 w-3.5" /> {status.label}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="sv-button sv-button-thin-border text-xl"
                      onClick={markWatered}
                      disabled={updatePlant.isPending}
                    >
                      <Droplet className="h-3.5 w-3.5" /> Water gegeven vandaag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="sv-button sv-button-thin-border text-xl"
                      onClick={() =>
                        updatePlant.mutate({
                          id: view.id,
                          patch: { planted: !view.planted },
                        })
                      }
                      disabled={updatePlant.isPending}
                    >
                      <Sprout className="h-3.5 w-3.5" />{" "}
                      {view.planted ? "Gepland" : "Markeer als gepland"}
                    </Button>
                  </div>
                );
              })()}

              <div className="grid sm:grid-cols-2 gap-4">
                <InfoRow label="Soort" value={view.species} />
                <InfoRow label="Levensduur" value={view.lifecycle} />
                <InfoRow
                  label="Grootte"
                  value={view.size_cm ? `${view.size_cm} cm` : null}
                />
                <InfoRow label="Locatie" value={view.location} />
                <InfoRow label="Zon" value={view.sun_needs} />
                <InfoRow label="Seizoen" value={view.season_notes} />
                <InfoRow
                  label="Water"
                  value={[view.water_notes].filter(Boolean).join(" · ") || null}
                />
                <InfoRow
                  label="Zaaien"
                  value={
                    [
                      view.sow_months.length > 0
                        ? view.sow_months.join(", ")
                        : null,
                      view.sow_week,
                      view.sow_notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow
                  label="Bloeien"
                  value={
                    [
                      view.bloom_months.length > 0
                        ? view.bloom_months.join(", ")
                        : null,
                      view.bloom_week,
                      view.bloom_notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow
                  label="Oogst"
                  value={
                    [
                      view.harvest_months.length > 0
                        ? view.harvest_months.join(", ")
                        : null,
                      view.harvest_week,
                      view.harvest_notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow label="Kas" value={view.greenhouse_notes} />
                <InfoRow label="Voeding" value={view.feeding_notes} />
                <InfoRow label="Grond" value={view.soil_notes} />
                <InfoRow
                  label="Klimaat"
                  value={
                    [view.temperature_notes, view.humidity_notes]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow
                  label="Winterhardheid"
                  value={
                    [view.winter_hardiness, view.winter_notes]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow label="Snoeien" value={view.pruning_notes} />
                <InfoRow label="Ziektes & plagen" value={view.pest_notes} />
                <InfoRow
                  label="Vermeerderen"
                  value={
                    [
                      view.propagation_methods.length > 0
                        ? view.propagation_methods.join(", ")
                        : null,
                      view.propagation_notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow
                  label="Giftig voor"
                  value={
                    [
                      view.toxic_to_humans ? "Mens" : null,
                      view.toxic_to_cats ? "Kat" : null,
                      view.toxicity_notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <InfoRow label="Overig" value={view.general_notes} />
              </div>

              <div className="space-y-3">
                <h3 className="sv-heading text-xl flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Groei bijhouden
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Plak een foto-URL..."
                    value={photoUrlDraft}
                    onChange={(e) => setPhotoUrlDraft(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="sv-button shrink-0"
                    disabled={!photoUrlDraft.trim() || addPhoto.isPending}
                    onClick={() =>
                      addPhoto.mutate({
                        plantId: view.id,
                        url: photoUrlDraft.trim(),
                      })
                    }
                  >
                    {addPhoto.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photo_url}
                          alt=""
                          className="w-full aspect-square object-cover rounded-lg sv-icon-slot"
                        />
                        <p className="text-[10px] sv-muted mt-1">
                          {new Date(photo.taken_at).toLocaleDateString(
                            "nl-NL",
                            { day: "numeric", month: "short" },
                          )}
                        </p>
                        <button
                          onClick={() => removePhoto.mutate(photo.id)}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full sv-icon-slot flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Verwijder foto"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                {confirmDelete ? (
                  <div className="flex items-center gap-3 w-full sm:justify-end">
                    <span className="text-sm sv-muted">Weet je het zeker?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sv-button sv-button-ghost"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Annuleer
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="sv-button sv-button-destructive"
                      onClick={() => deletePlant.mutate(view.id)}
                      disabled={deletePlant.isPending}
                    >
                      {deletePlant.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Ja, verwijder"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      className="sv-button sv-button-ghost"
                    >
                      <Trash2 className="h-4 w-4" /> Verwijder
                    </Button>
                    <Button
                      variant="outline"
                      className="sv-button"
                      onClick={startEdit}
                    >
                      <Pencil className="h-4 w-4" /> Bewerken
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
