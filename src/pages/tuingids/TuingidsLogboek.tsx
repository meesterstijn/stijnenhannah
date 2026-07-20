import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Plant } from "@/lib/supabase";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import {
  fetchPlants,
  fetchAllHarvestLogs,
  fetchAllPruningLogs,
  fetchAllRepotLogs,
} from "@/features/tuingids/lib/plantLogs";
import { buildAllLogboekEvents } from "@/features/tuingids/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { LogboekDashboard } from "@/features/tuingids/components/LogboekDashboard";
import { LogboekTimeline } from "@/features/tuingids/components/LogboekTimeline";
import { GrowthComparisonChart } from "@/features/tuingids/components/GrowthComparisonChart";
import type { LogEntry } from "@/features/tuingids/types";

type FormState = Omit<LogEntry, "id" | "created_at">;

const emptyForm = (): FormState => ({
  plant_id: null,
  plant_name: "",
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
});

export default function TuingidsLogboek() {
  const { entries, addEntry } = useGrowthLog();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: plants = [] } = useQuery<Plant[]>({
    queryKey: ["plants"],
    queryFn: fetchPlants,
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

  const events = useMemo(
    () => buildAllLogboekEvents({ entries, harvestLogs, pruningLogs, repotLogs, plants }),
    [entries, harvestLogs, pruningLogs, repotLogs, plants],
  );

  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function handleSave() {
    if (!form.plant_name.trim()) return;
    addEntry(form);
    setForm(emptyForm());
    setFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="sv-muted text-sm">Groei, foto's en observaties bijhouden.</p>
        <Button onClick={() => setFormOpen((v) => !v)} className="sv-button gap-2 shrink-0">
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

      <LogboekDashboard events={events} />

      <LogboekTimeline events={events} />

      <GrowthComparisonChart entries={entries} />
    </div>
  );
}
