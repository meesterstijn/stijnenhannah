import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

type CleaningTask = {
  id: string;
  name: string;
  last_done_at: string | null;
  interval_days: number;
  position: number;
};

const INTERVAL_OPTIONS = [
  { label: "1 maand", value: 30 },
  { label: "2 maanden", value: 60 },
  { label: "3 maanden", value: 90 },
  { label: "6 maanden", value: 180 },
  { label: "1 jaar", value: 365 },
];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(days: number): string {
  if (days === 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (days < 14) return "1 week geleden";
  if (days < 30) return `${Math.floor(days / 7)} weken geleden`;
  if (days < 60) return "1 maand geleden";
  if (days < 365) return `${Math.floor(days / 30)} maanden geleden`;
  return `${Math.floor(days / 365)} jaar geleden`;
}

function statusDot(days: number | null, interval: number): string {
  if (days === null) return "bg-muted-foreground/30";
  if (days < interval * 0.75) return "bg-green-500";
  if (days < interval) return "bg-amber-400";
  return "bg-red-500";
}

export default function Schoonmaak() {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["cleaning_tasks"],
    queryFn: async (): Promise<CleaningTask[]> => {
      const { data, error } = await supabase
        .from("cleaning_tasks")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cleaning_tasks")
        .update({ last_done_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  const updateInterval = useMutation({
    mutationFn: async ({ id, interval_days }: { id: string; interval_days: number }) => {
      const { error } = await supabase
        .from("cleaning_tasks")
        .update({ interval_days })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  const sorted = [...tasks].sort((a, b) => {
    const dA = daysSince(a.last_done_at);
    const dB = daysSince(b.last_done_at);
    const pA = dA === null ? 2 : dA / a.interval_days;
    const pB = dB === null ? 2 : dB / b.interval_days;
    return pB - pA;
  });

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-2xl font-semibold flex-1">Schoonmaak</h1>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            editMode ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          {editMode ? "Klaar" : "Bewerken"}
        </button>
      </div>

      {!editMode && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Gedaan</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Bijna tijd</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Te doen</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border/60 shadow-sm divide-y divide-border/40">
          {sorted.map((task) => {
            const days = daysSince(task.last_done_at);
            return (
              <div key={task.id} className="flex items-center gap-4 px-5 py-4">
                {!editMode && (
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot(days, task.interval_days)}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.name}</p>
                  {!editMode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {days === null ? "Nog niet gedaan" : formatDaysAgo(days)}
                    </p>
                  )}
                  {editMode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Huidig: {INTERVAL_OPTIONS.find((o) => o.value === task.interval_days)?.label ?? `${task.interval_days} dagen`}
                    </p>
                  )}
                </div>
                {editMode ? (
                  <select
                    value={task.interval_days}
                    onChange={(e) =>
                      updateInterval.mutate({ id: task.id, interval_days: Number(e.target.value) })
                    }
                    className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {INTERVAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl shrink-0 h-8 text-xs gap-1"
                    onClick={() => markDone.mutate(task.id)}
                    disabled={markDone.isPending && markDone.variables === task.id}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Gedaan
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
