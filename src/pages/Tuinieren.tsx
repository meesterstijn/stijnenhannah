import { useState, useMemo, useRef, useEffect } from "react";
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
  SlidersHorizontal,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SUN_OPTIONS = ["Volle zon", "Halfvolle zon", "Half schaduw", "Schaduw"] as const;

const GREENHOUSE_PREF_OPTIONS = ["Kas liefhebber", "Kas of buiten", "Alleen buiten"] as const;

const PLANT_CATEGORY_OPTIONS = [
  "🍅 Moestuin",
  "🍓 Fruit",
  "🌿 Kruiden",
  "🌸 Sierplanten",
  "🌳 Bomen & Mediterrane planten",
] as const;

function parseGreenhouseNotes(raw: string | null): { pref: string; notes: string } {
  if (!raw) return { pref: "", notes: "" };
  for (const p of GREENHOUSE_PREF_OPTIONS) {
    if (raw === p) return { pref: p, notes: "" };
    if (raw.startsWith(p + "\n")) return { pref: p, notes: raw.slice(p.length + 1) };
  }
  return { pref: "", notes: raw };
}

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
  sun_needs: string[];
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
  category: string;
  greenhouse_pref: string;
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
  sun_needs: [],
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
  category: "",
  greenhouse_pref: "",
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
    sun_needs: p.sun_needs ? p.sun_needs.split(",") : [],
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
    category: p.category ?? "",
    greenhouse_pref: parseGreenhouseNotes(p.greenhouse_notes).pref,
    greenhouse_notes: parseGreenhouseNotes(p.greenhouse_notes).notes,
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
    sun_needs: d.sun_needs.length > 0 ? d.sun_needs.join(",") : null,
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
    category: d.category || null,
    greenhouse_notes:
      [d.greenhouse_pref, d.greenhouse_notes.trim()].filter(Boolean).join("\n") || null,
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
      <div className="space-y-2">
        <SectionHeading>Categorie</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {PLANT_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ category: draft.category === opt ? "" : opt })
              }
              className={chipClass(draft.category === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

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
                onChange({ sun_needs: toggleInArray(draft.sun_needs, opt) })
              }
              className={chipClass(draft.sun_needs.includes(opt))}
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
        <div className="flex gap-2 flex-wrap">
          {GREENHOUSE_PREF_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({ greenhouse_pref: draft.greenhouse_pref === opt ? "" : opt })
              }
              className={chipClass(draft.greenhouse_pref === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
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

function PlantCard({ p, onOpen }: { p: Plant; onOpen: (p: Plant) => void }) {
  const status = waterStatus(p);
  return (
    <button
      onClick={() => onOpen(p)}
      className="sv-panel text-left p-5 hover:-translate-y-0.5 transition-transform flex items-center gap-3"
    >
      {p.photo_url ? (
        <img src={p.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 sv-icon-slot" />
      ) : (
        <div className="h-12 w-12 sv-icon-slot flex items-center justify-center shrink-0">
          <Sprout className="h-5 w-5" strokeWidth={1.6} />
        </div>
      )}
      <div className="min-w-0">
        <p className="sv-heading text-2xl leading-snug truncate">{p.name}</p>
        {p.location && <p className="text-xs sv-muted truncate">{p.location}</p>}
        {status && (
          <span className={`sv-heading inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full w-fit mt-1 ${status.overdue ? "sv-badge-overdue" : "sv-badge-ok"}`}>
            <Droplet className="h-3 w-3" /> {status.label}
          </span>
        )}
      </div>
    </button>
  );
}

function SeasonalOverview({ plants }: { plants: Plant[] }) {
  const [open, setOpen] = useState(true);
  const monthIndex = new Date().getMonth();
  const currentMonth = MONTH_OPTIONS[monthIndex];
  const monthLabel = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const sowNow = plants.filter((p) => p.sow_months.includes(currentMonth));
  const bloomNow = plants.filter((p) => p.bloom_months.includes(currentMonth));
  const harvestNow = plants.filter((p) => p.harvest_months.includes(currentMonth));

  if (sowNow.length === 0 && bloomNow.length === 0 && harvestNow.length === 0) return null;

  return (
    <div className="sv-panel p-5 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <p className="sv-heading text-2xl">🌱 {monthLabel}</p>
        {open ? <ChevronUp className="h-4 w-4 sv-muted" /> : <ChevronDown className="h-4 w-4 sv-muted" />}
      </button>
      {open && (
        <div className="space-y-3 pt-1">
          {sowNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">Zaaien</p>
              <p className="text-sm">{sowNow.map((p) => p.name).join(" · ")}</p>
            </div>
          )}
          {bloomNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">In bloei</p>
              <p className="text-sm">{bloomNow.map((p) => p.name).join(" · ")}</p>
            </div>
          )}
          {harvestNow.length > 0 && (
            <div>
              <p className="text-xs sv-muted mb-1">Oogsten</p>
              <p className="text-sm">{harvestNow.map((p) => p.name).join(" · ")}</p>
            </div>
          )}
        </div>
      )}
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!importMsg) return;
    const t = setTimeout(() => setImportMsg(null), 5000);
    return () => clearTimeout(t);
  }, [importMsg]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : [data];
      let imported = 0;
      const errors: string[] = [];
      for (const p of list) {
        if (!p.name?.trim()) { errors.push("plant zonder naam overgeslagen"); continue; }
        const row = {
          name: p.name.trim(),
          category: p.category || null,
          species: p.species || null,
          fun_fact: p.fun_fact || null,
          location: p.location || null,
          lifecycle: p.lifecycle || null,
          size_cm: p.size_cm ? Number(p.size_cm) : null,
          sun_needs: Array.isArray(p.sun_needs) ? p.sun_needs.join(",") : p.sun_needs || null,
          season_notes: p.season_notes || null,
          water_notes: p.water_notes || null,
          planted: p.planted ?? false,
          water_interval_days: p.water_interval_days ? Number(p.water_interval_days) : null,
          last_watered_at: p.last_watered_at ? new Date(p.last_watered_at).toISOString() : null,
          reminders_enabled: p.reminders_enabled ?? true,
          greenhouse_notes: [p.greenhouse_pref, p.greenhouse_notes].filter(Boolean).join("\n") || null,
          feeding_notes: p.feeding_notes || null,
          soil_notes: p.soil_notes || null,
          temperature_notes: p.temperature_notes || null,
          humidity_notes: p.humidity_notes || null,
          winter_hardiness: p.winter_hardiness || null,
          winter_notes: p.winter_notes || null,
          pruning_notes: p.pruning_notes || null,
          pest_notes: p.pest_notes || null,
          toxic_to_humans: p.toxic_to_humans ?? false,
          toxic_to_cats: p.toxic_to_cats ?? false,
          toxicity_notes: p.toxicity_notes || null,
          sow_months: p.sow_months ?? [],
          sow_week: p.sow_week || null,
          sow_notes: p.sow_notes || null,
          bloom_months: p.bloom_months ?? [],
          bloom_week: p.bloom_week || null,
          bloom_notes: p.bloom_notes || null,
          propagation_methods: p.propagation_methods ?? [],
          propagation_notes: p.propagation_notes || null,
          harvest_months: p.harvest_months ?? [],
          harvest_week: p.harvest_week || null,
          harvest_notes: p.harvest_notes || null,
          general_notes: p.general_notes || null,
          photo_url: p.photo_url || null,
          created_by: session?.user.id,
        };
        const { error } = await supabase.from("plants").insert(row);
        if (error) errors.push(`${row.name}: ${error.message}`);
        else imported++;
      }
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      setImportMsg(errors.length > 0
        ? `${imported} toegevoegd, ${errors.length} fout(en): ${errors.join(" · ")}`
        : `${imported} plant${imported === 1 ? "" : "en"} toegevoegd!`);
    } catch {
      setImportMsg("Ongeldig JSON-bestand.");
    }
    e.target.value = "";
  }

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

  type FilterState = {
    category: string[];
    sun_needs: string[];
    greenhouse_pref: string[];
    lifecycle: string[];
    winter_hardiness: string[];
    toxic: string[];
    planted: "all" | "planted" | "not_planted";
    sow_months: string[];
    bloom_months: string[];
    harvest_months: string[];
    water: "all" | "overdue" | "soon";
    sort: "naam" | "water" | "categorie";
  };

  const initialFilters: FilterState = {
    category: [],
    sun_needs: [],
    greenhouse_pref: [],
    lifecycle: [],
    winter_hardiness: [],
    toxic: [],
    planted: "all",
    sow_months: [],
    bloom_months: [],
    harvest_months: [],
    water: "all",
    sort: "naam",
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  function patchFilter(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function daysLeftForSort(p: Plant): number {
    if (!p.planted || !p.water_interval_days) return 9999;
    if (!p.last_watered_at) return -9999;
    const dueAt =
      new Date(p.last_watered_at).getTime() +
      p.water_interval_days * 24 * 60 * 60 * 1000;
    return Math.ceil((dueAt - Date.now()) / (24 * 60 * 60 * 1000));
  }

  const filteredPlants = useMemo(() => {
    let result = plants;

    if (filters.category.length > 0) {
      result = result.filter((p) => p.category && filters.category.includes(p.category));
    }

    if (filters.sun_needs.length > 0) {
      result = result.filter((p) => {
        if (!p.sun_needs) return false;
        const plantSun = p.sun_needs.split(",");
        return filters.sun_needs.some((f) => plantSun.includes(f));
      });
    }

    if (filters.greenhouse_pref.length > 0) {
      result = result.filter((p) => {
        const pref = parseGreenhouseNotes(p.greenhouse_notes).pref;
        return filters.greenhouse_pref.includes(pref);
      });
    }

    if (filters.lifecycle.length > 0) {
      result = result.filter((p) => p.lifecycle && filters.lifecycle.includes(p.lifecycle));
    }

    if (filters.winter_hardiness.length > 0) {
      result = result.filter((p) => p.winter_hardiness && filters.winter_hardiness.includes(p.winter_hardiness));
    }

    if (filters.toxic.length > 0) {
      result = result.filter((p) => {
        if (filters.toxic.includes("Mens") && !p.toxic_to_humans) return false;
        if (filters.toxic.includes("Kat") && !p.toxic_to_cats) return false;
        return true;
      });
    }

    if (filters.planted !== "all") {
      result = result.filter((p) =>
        filters.planted === "planted" ? p.planted : !p.planted,
      );
    }

    if (filters.sow_months.length > 0) {
      result = result.filter((p) =>
        filters.sow_months.some((m) => p.sow_months.includes(m)),
      );
    }

    if (filters.bloom_months.length > 0) {
      result = result.filter((p) =>
        filters.bloom_months.some((m) => p.bloom_months.includes(m)),
      );
    }

    if (filters.harvest_months.length > 0) {
      result = result.filter((p) =>
        filters.harvest_months.some((m) => p.harvest_months.includes(m)),
      );
    }

    if (filters.water === "overdue") {
      result = result.filter((p) => waterStatus(p)?.overdue);
    } else if (filters.water === "soon") {
      result = result.filter((p) => {
        const days = daysLeftForSort(p);
        return days <= 3 && days > 0;
      });
    }

    if (filters.sort === "water") {
      result = [...result].sort((a, b) => daysLeftForSort(a) - daysLeftForSort(b));
    } else if (filters.sort === "categorie") {
      result = [...result].sort((a, b) => {
        const ai = PLANT_CATEGORY_OPTIONS.indexOf(a.category as (typeof PLANT_CATEGORY_OPTIONS)[number]);
        const bi = PLANT_CATEGORY_OPTIONS.indexOf(b.category as (typeof PLANT_CATEGORY_OPTIONS)[number]);
        const aIdx = ai === -1 ? 999 : ai;
        const bIdx = bi === -1 ? 999 : bi;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.name.localeCompare(b.name, "nl");
      });
    }

    return result;
  }, [plants, filters]);

  const groupedPlants = useMemo(() => {
    if (filters.sort !== "categorie") return null;
    const groups: { label: string; plants: Plant[] }[] = [];
    for (const cat of PLANT_CATEGORY_OPTIONS) {
      const ps = filteredPlants.filter((p) => p.category === cat);
      if (ps.length > 0) groups.push({ label: cat, plants: ps });
    }
    const other = filteredPlants.filter(
      (p) => !p.category || !PLANT_CATEGORY_OPTIONS.includes(p.category as (typeof PLANT_CATEGORY_OPTIONS)[number]),
    );
    if (other.length > 0) groups.push({ label: "Overig", plants: other });
    return groups;
  }, [filteredPlants, filters.sort]);

  const activeFilterCount =
    filters.category.length +
    filters.sun_needs.length +
    filters.greenhouse_pref.length +
    filters.lifecycle.length +
    filters.winter_hardiness.length +
    filters.toxic.length +
    (filters.planted !== "all" ? 1 : 0) +
    filters.sow_months.length +
    filters.bloom_months.length +
    filters.harvest_months.length +
    (filters.water !== "all" ? 1 : 0) +
    (filters.sort !== "naam" ? 1 : 0);

  function handleExport() {
    const data = plants.map((p) => ({
      name: p.name,
      category: p.category,
      species: p.species,
      fun_fact: p.fun_fact,
      location: p.location,
      lifecycle: p.lifecycle,
      size_cm: p.size_cm,
      sun_needs: p.sun_needs ? p.sun_needs.split(",") : [],
      season_notes: p.season_notes,
      water_notes: p.water_notes,
      water_interval_days: p.water_interval_days,
      greenhouse_pref: parseGreenhouseNotes(p.greenhouse_notes).pref || null,
      greenhouse_notes: parseGreenhouseNotes(p.greenhouse_notes).notes || null,
      feeding_notes: p.feeding_notes,
      soil_notes: p.soil_notes,
      temperature_notes: p.temperature_notes,
      winter_hardiness: p.winter_hardiness,
      winter_notes: p.winter_notes,
      pruning_notes: p.pruning_notes,
      pest_notes: p.pest_notes,
      toxic_to_humans: p.toxic_to_humans,
      toxic_to_cats: p.toxic_to_cats,
      toxicity_notes: p.toxicity_notes,
      sow_months: p.sow_months,
      sow_week: p.sow_week,
      sow_notes: p.sow_notes,
      bloom_months: p.bloom_months,
      bloom_week: p.bloom_week,
      bloom_notes: p.bloom_notes,
      propagation_methods: p.propagation_methods,
      propagation_notes: p.propagation_notes,
      harvest_months: p.harvest_months,
      harvest_week: p.harvest_week,
      harvest_notes: p.harvest_notes,
      general_notes: p.general_notes,
      photo_url: p.photo_url,
      planted: p.planted,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tuinieren-theme space-y-8">
      <header className="grid grid-cols-[auto_1fr] items-center gap-2">
        <Button
          size="lg"
          className="sv-button text-2xl"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Zoeken</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 text-xs sv-badge-ok rounded-full px-1.5 py-0.5">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <div className="flex items-center gap-2 justify-end">
          <Button
            size="lg"
            className="sv-button text-2xl"
            onClick={handleExport}
            disabled={plants.length === 0}
          >
            <Download className="h-4 w-4" /><span className="hidden sm:inline">Exporteer</span>
          </Button>
          <Button
            size="lg"
            className="sv-button text-2xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /><span className="hidden sm:inline">Importeer</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="lg" className="sv-button text-2xl">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Nieuwe plant</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh]">
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
                className="sv-button text-xl"
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
        </div>
      </header>

      {importMsg && (
        <p className="text-sm sv-muted text-right -mt-4">{importMsg}</p>
      )}

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
      ) : groupedPlants ? (
        <div className="space-y-6">
          {groupedPlants.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="sv-heading text-2xl">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.plants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredPlants.map((p) => <PlantCard key={p.id} p={p} onOpen={setView} />)}
        </div>
      )}

      <SeasonalOverview plants={plants} />

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
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-2xl max-h-[90vh]">
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
                  className="sv-button text-xl"
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
                <InfoRow label="Zon" value={view.sun_needs ? view.sun_needs.replace(/,/g, " · ") : null} />
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
                      className="sv-button text-xl"
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

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="tuinieren-theme sv-dialog max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="sv-heading text-3xl">Zoeken & filteren</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <SectionHeading>Sortering</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "naam", label: "Naam (A–Z)" },
                    { value: "water", label: "Water urgentie" },
                    { value: "categorie", label: "Categorie" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ sort: value })}
                    className={chipClass(filters.sort === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Categorie</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {PLANT_CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ category: toggleInArray(filters.category, opt) })
                    }
                    className={chipClass(filters.category.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Zon</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {SUN_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ sun_needs: toggleInArray(filters.sun_needs, opt) })
                    }
                    className={chipClass(filters.sun_needs.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Kas</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {GREENHOUSE_PREF_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      patchFilter({ greenhouse_pref: toggleInArray(filters.greenhouse_pref, opt) })
                    }
                    className={chipClass(filters.greenhouse_pref.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Zaaien</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ sow_months: toggleInArray(filters.sow_months, m) })
                    }
                    className={monthChipClass(filters.sow_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Bloeien</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ bloom_months: toggleInArray(filters.bloom_months, m) })
                    }
                    className={monthChipClass(filters.bloom_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Oogsten</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchFilter({ harvest_months: toggleInArray(filters.harvest_months, m) })
                    }
                    className={monthChipClass(filters.harvest_months.includes(m))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Water</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "overdue", label: "Te laat" },
                    { value: "soon", label: "Binnenkort (≤ 3 dagen)" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ water: value })}
                    className={chipClass(filters.water === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Ingeplant</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "all", label: "Alles" },
                    { value: "planted", label: "Ingeplant" },
                    { value: "not_planted", label: "Nog te planten" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchFilter({ planted: value })}
                    className={chipClass(filters.planted === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Levensduur</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {LIFECYCLE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ lifecycle: toggleInArray(filters.lifecycle, opt) })}
                    className={chipClass(filters.lifecycle.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Winterhardheid</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {WINTER_HARDINESS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ winter_hardiness: toggleInArray(filters.winter_hardiness, opt) })}
                    className={chipClass(filters.winter_hardiness.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionHeading>Giftig voor</SectionHeading>
              <div className="flex gap-2 flex-wrap">
                {["Mens", "Kat"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patchFilter({ toxic: toggleInArray(filters.toxic, opt) })}
                    className={warnChipClass(filters.toxic.includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter className="flex justify-between w-full">
            <Button
              variant="ghost"
              className="sv-button sv-button-ghost text-xl"
              onClick={() => setFilters(initialFilters)}
            >
              Reset
            </Button>
            <Button className="sv-button text-xl" onClick={() => setFilterOpen(false)}>
              Tonen ({filteredPlants.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
