import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Plant } from "@/lib/supabase";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tuingids</p>
          <h1 className="font-serif text-3xl font-semibold mt-1">Groeilogboek</h1>
          <p className="text-muted-foreground text-sm mt-1">Groei, foto's en observaties bijhouden.</p>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)} className="rounded-xl gap-2 shrink-0 mt-1">
          <Plus className="h-4 w-4" /> Toevoegen
        </Button>
      </div>

      {formOpen && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <p className="font-semibold text-sm">Nieuwe notitie</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plant</label>
              <select
                value={form.plant_name}
                onChange={(e) => patch({ plant_name: e.target.value, plant_id: plants.find((p) => p.name === e.target.value)?.id ?? null })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Kies plant...</option>
                {plants.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {!form.plant_name && <Input placeholder="Of typ een naam" onChange={(e) => patch({ plant_name: e.target.value })} className="mt-1" />}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Datum</label>
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hoogte (cm)</label>
              <Input type="number" min={0} placeholder="bijv. 45" value={form.height_cm ?? ""} onChange={(e) => patch({ height_cm: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Bloemen</label>
              <Input type="number" min={0} placeholder="0" value={form.flower_count ?? ""} onChange={(e) => patch({ flower_count: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vruchten</label>
              <Input type="number" min={0} placeholder="0" value={form.fruit_count ?? ""} onChange={(e) => patch({ fruit_count: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Foto URL (optioneel)</label>
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
            <Button onClick={handleSave} disabled={!form.plant_name.trim()} className="rounded-xl">Opslaan</Button>
            <Button variant="ghost" onClick={() => setFormOpen(false)} className="rounded-xl">Annuleer</Button>
          </div>
        </div>
      )}

      {plantNames.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterPlant("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterPlant === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
          >
            Alle planten
          </button>
          {plantNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilterPlant(name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterPlant === name ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
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
          <div className="absolute left-[22px] top-6 bottom-6 w-px bg-border/60" />
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
      <div className="shrink-0 h-11 w-11 rounded-full bg-muted border-2 border-background flex items-center justify-center text-lg z-10">
        {entry.photo_url ? <img src={entry.photo_url} alt="" className="h-full w-full rounded-full object-cover" /> : "🌱"}
      </div>
      <div className="flex-1 rounded-2xl border border-border/60 bg-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{entry.plant_name}</p>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
          <div className="flex items-center gap-1">
            {entry.watered && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full px-2 py-0.5">💧</span>}
            {entry.fertilized && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full px-2 py-0.5">🌿</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {entry.height_cm !== null && <span className="text-xs bg-muted rounded-full px-2 py-0.5">📏 {entry.height_cm} cm</span>}
          {entry.flower_count !== null && <span className="text-xs bg-muted rounded-full px-2 py-0.5">🌸 {entry.flower_count} bloemen</span>}
          {entry.fruit_count !== null && <span className="text-xs bg-muted rounded-full px-2 py-0.5">🍅 {entry.fruit_count} vruchten</span>}
        </div>

        {entry.notes && (
          <div>
            <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>{entry.notes}</p>
            {entry.notes.length > 100 && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-primary mt-0.5">
                {expanded ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />}
                {expanded ? " Minder" : " Meer"}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3 inline" /> verwijderen
        </button>
      </div>
    </div>
  );
}
