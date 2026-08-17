import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { enablePushNotifications, getPushPermissionState } from "@/lib/push";
import {
  Check,
  Bell,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModernPageHeader } from "@/components/modern-page-header";
import {
  ModernSection,
  ModernEmptyState,
  cardSurface,
} from "@/components/modern-surfaces";

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
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatDaysLeft(days: number, interval: number): string {
  const left = interval - days;
  if (left < 0) return `${Math.abs(left)} dagen te laat`;
  if (left === 0) return "Vandaag te doen";
  if (left === 1) return "Morgen";
  return `Nog ${left} dagen`;
}

// Bewust binair (nog niet nodig / te doen) — geen apart "bijna tijd"-tussenstadium
// meer, dat voegde vooral ruis toe zonder een duidelijke actie op te leveren.
function statusDot(days: number | null, interval: number): string {
  if (days === null) return "bg-red-500";
  return days < interval ? "bg-green-500" : "bg-red-500";
}

export default function Schoonmaak() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskInterval, setNewTaskInterval] = useState(90);

  const [pushState, setPushState] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    getPushPermissionState().then(setPushState);
  }, []);

  async function handleEnablePush() {
    if (!session?.user.id) return;
    setPushLoading(true);
    setPushError(null);
    try {
      await enablePushNotifications(session.user.id);
      setPushState("granted");
    } catch (err) {
      setPushError((err as Error).message);
    } finally {
      setPushLoading(false);
    }
  }

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  const updateInterval = useMutation({
    mutationFn: async ({
      id,
      interval_days,
    }: {
      id: string;
      interval_days: number;
    }) => {
      const { error } = await supabase
        .from("cleaning_tasks")
        .update({ interval_days })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  const addTask = useMutation({
    mutationFn: async ({
      name,
      interval_days,
    }: {
      name: string;
      interval_days: number;
    }) => {
      const nextPosition =
        tasks.reduce((max, t) => Math.max(max, t.position), 0) + 1;
      const { error } = await supabase
        .from("cleaning_tasks")
        .insert({ name, interval_days, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] });
      setNewTaskName("");
      setNewTaskInterval(90);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cleaning_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cleaning_tasks"] }),
  });

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    addTask.mutate({
      name: newTaskName.trim(),
      interval_days: newTaskInterval,
    });
  }

  const sorted = [...tasks].sort((a, b) => {
    const dA = daysSince(a.last_done_at);
    const dB = daysSince(b.last_done_at);
    const pA = dA === null ? 2 : dA / a.interval_days;
    const pB = dB === null ? 2 : dB / b.interval_days;
    return pB - pA;
  });

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ModernPageHeader
        icon={Sparkles}
        eyebrow="Overzicht"
        title="Schoonmaak"
        back={{ to: "/" }}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditMode((v) => !v)}
            className={`rounded-xl gap-1.5 text-sm ${editMode ? "text-primary font-medium" : "text-muted-foreground"}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? "Klaar" : "Bewerken"}
          </Button>
        }
      />

      {pushState !== "granted" && pushState !== "unsupported" && (
        <div
          className={`flex items-center gap-3 ${cardSurface({ padding: "sm" })}`}
        >
          <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="flex-1 text-sm text-muted-foreground">
            Zet meldingen aan om een seintje te krijgen zodra een taak weer aan
            de beurt is.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs shrink-0"
            onClick={handleEnablePush}
            disabled={pushLoading}
          >
            {pushLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Inschakelen"
            )}
          </Button>
        </div>
      )}
      {pushError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
          {pushError}
        </p>
      )}

      {!editMode && (
        <div
          className={`flex flex-wrap gap-4 text-xs text-muted-foreground ${cardSurface({ padding: "sm" })}`}
        >
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
            Nog niet nodig
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Te doen
          </span>
        </div>
      )}

      {editMode && (
        <ModernSection title="Nieuwe taak">
          <form
            onSubmit={handleAddTask}
            className={`flex gap-2 ${cardSurface({ padding: "sm" })}`}
          >
            <Input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Bijv. Ramen zemen"
              className="bg-background/60 border-border/70 focus-visible:ring-primary/30"
              autoComplete="off"
            />
            <select
              value={newTaskInterval}
              onChange={(e) => setNewTaskInterval(Number(e.target.value))}
              className="text-xs rounded-xl border border-border/70 bg-background/60 px-3 shrink-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              className="rounded-xl shrink-0"
              disabled={!newTaskName.trim() || addTask.isPending}
            >
              {addTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </form>
        </ModernSection>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <ModernEmptyState
          icon={Sparkles}
          title="Nog geen schoonmaaktaken"
          description="Voeg hierboven je eerste taak toe."
        />
      ) : (
        <div
          className={`${cardSurface({ padding: "none" })} divide-y divide-border/40`}
        >
          {sorted.map((task) => {
            const days = daysSince(task.last_done_at);
            return (
              <div
                key={task.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20"
              >
                {!editMode && (
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot(days, task.interval_days)}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.name}</p>
                  {!editMode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {days === null
                        ? "Nog niet gedaan"
                        : formatDaysLeft(days, task.interval_days)}
                    </p>
                  )}
                  {editMode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Huidig:{" "}
                      {INTERVAL_OPTIONS.find(
                        (o) => o.value === task.interval_days,
                      )?.label ?? `${task.interval_days} dagen`}
                    </p>
                  )}
                </div>
                {editMode ? (
                  <>
                    <select
                      value={task.interval_days}
                      onChange={(e) =>
                        updateInterval.mutate({
                          id: task.id,
                          interval_days: Number(e.target.value),
                        })
                      }
                      className="text-xs rounded-xl border border-border/70 bg-background/60 px-3 py-2 shrink-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {INTERVAL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTask.mutate(task.id)}
                      disabled={
                        deleteTask.isPending && deleteTask.variables === task.id
                      }
                      aria-label="Taak verwijderen"
                    >
                      {deleteTask.isPending &&
                      deleteTask.variables === task.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl shrink-0 h-8 text-xs gap-1"
                    onClick={() => markDone.mutate(task.id)}
                    disabled={
                      markDone.isPending && markDone.variables === task.id
                    }
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
