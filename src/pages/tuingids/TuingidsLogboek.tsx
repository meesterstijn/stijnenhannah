import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { EmptyState } from "@/features/tuingids/components/EmptyState";
import type { LogEntry } from "@/features/tuingids/types";

type FormState = Omit<LogEntry, "id" | "created_at">;

const emptyForm = (): FormState => ({
  plant_id: null,
  plant_name: "",
  date: new Date().toISOString().slice(0, 10),
  height_cm: null,
  flower_count: null,
  fruit_count: null,
  notes: "",
  watered: false,
  fertilized: false,
  photo_url: "",
});

export default function TuingidsLogboek() {
  const { entries, addEntry, deleteEntry } = useGrowthLog();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterPlant, setFilterPlant] = useState("all");

  const { data: plants = [] } = useQuery({
    queryKey: ["plants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plants").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Plant, "id" | "name">[];
    },
  });

  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function handleSave() {
    if (!form.plant_name.trim()) return;
    addEntry(form);
    setForm(emptyForm());
    setFormOpen(false);
  }

  const displayed = entries.filter(
    (e) => filterPlant === "all" || e.plant_name === filterPlant,
  );

  const plantNames = [...new Set(entries.map((e) => e.plant_name))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] sv-muted">Tuingids</p>
          <h1 className="sv-heading text-3xl mt-1">Groeilogboek</h1>
          <p className="sv-muted text-sm mt-1">Groei, foto's en observaties bijhouden.</p>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)} className="sv-button gap-2 shrink-0 mt-1">
          <Plus className="h-4 w-4" /> Toevoegen
        </Button>
      </div>

      {formOpen && (
        <div className="sv-panel p-5 space-y-4">
          <p className="sv-heading text-xl">Nieuwe notitie</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs sv-muted">Plant</label>
              <select
                value={form.plant_name}
                onChange={(e) => patch({ plant_name: e.target.value, plant_id: plants.find((p) => p.name === e.target.value)?.id ?? null })}
                className="w-full px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Kies plant...</option>
                {plants.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {!form.plant_name && <Input placeholder="Of typ een naam" onChange={(e) => patch({ plant_name: e.target.value })} className="mt-1" />}
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

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!form.plant_name.trim()} className="sv-button">Opslaan</Button>
            <Button variant="ghost" onClick={() => setFormOpen(false)} className="sv-button sv-button-ghost">Annuleer</Button>
          </div>
        </div>
      )}

      {plantNames.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterPlant("all")}
            className={`sv-chip px-3 py-1.5 text-xs font-medium${filterPlant === "all" ? " active" : ""}`}
          >
            Alle planten
          </button>
          {plantNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilterPlant(name)}
              className={`sv-chip px-3 py-1.5 text-xs font-medium${filterPlant === name ? " active" : ""}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <EmptyState emoji="📷" title="Nog geen notities" description="Voeg je eerste groeinotitie toe via de knop hierboven." />
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-[22px] top-6 bottom-6 w-px" style={{ background: "var(--sv-wood-dark)", opacity: 0.3 }} />
          {displayed.map((entry) => (
            <LogEntryCard key={entry.id} entry={entry} onDelete={deleteEntry} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogEntryCard({ entry, onDelete }: { entry: LogEntry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(entry.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex gap-4 pb-4">
      <div className="sv-icon-slot shrink-0 h-11 w-11 rounded-full flex items-center justify-center text-lg z-10">
        {entry.photo_url ? <img src={entry.photo_url} alt="" className="h-full w-full rounded-full object-cover" /> : "🌱"}
      </div>
      <div className="flex-1 sv-panel p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="sv-heading text-xl">{entry.plant_name}</p>
            <p className="text-xs sv-muted">{date}</p>
          </div>
          <div className="flex items-center gap-1">
            {entry.watered && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">💧</span>}
            {entry.fertilized && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🌿</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {entry.height_cm !== null && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">📏 {entry.height_cm} cm</span>}
          {entry.flower_count !== null && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🌸 {entry.flower_count} bloemen</span>}
          {entry.fruit_count !== null && <span className="sv-badge-ok text-xs rounded-full px-2 py-0.5">🍅 {entry.fruit_count} vruchten</span>}
        </div>

        {entry.notes && (
          <div>
            <p className={`text-sm sv-muted ${expanded ? "" : "line-clamp-2"}`}>{entry.notes}</p>
            {entry.notes.length > 100 && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs sv-muted mt-0.5">
                {expanded ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />}
                {expanded ? " Minder" : " Meer"}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="text-xs sv-muted hover:opacity-60 transition-opacity"
        >
          <Trash2 className="h-3 w-3 inline" /> verwijderen
        </button>
      </div>
    </div>
  );
}
