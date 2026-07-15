import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type DailyPrompt,
  type DailyPromptRun,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { enablePushNotifications, getPushPermissionState } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bell, Sparkles, Check } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

async function fetchDailyPrompt(): Promise<DailyPrompt | null> {
  const { data, error } = await supabase
    .from("daily_prompt")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchRuns(): Promise<DailyPromptRun[]> {
  const { data, error } = await supabase
    .from("daily_prompt_runs")
    .select("*")
    .order("run_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function formatRunDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function Dagvraag() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["daily_prompt"],
    queryFn: fetchDailyPrompt,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["daily_prompt_runs"],
    queryFn: fetchRuns,
  });

  const [promptDraft, setPromptDraft] = useState("");
  const [hourDraft, setHourDraft] = useState(8);
  const [minuteDraft, setMinuteDraft] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (config && !initialized) {
      setPromptDraft(config.prompt);
      setHourDraft(config.hour);
      setMinuteDraft(config.minute);
      setInitialized(true);
    }
  }, [config, initialized]);

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

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (config?.id) {
        const { error } = await supabase
          .from("daily_prompt")
          .update({
            prompt: promptDraft,
            hour: hourDraft,
            minute: minuteDraft,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("daily_prompt").insert({
          prompt: promptDraft,
          hour: hourDraft,
          minute: minuteDraft,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_prompt"] });
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Elke dag een antwoord
        </p>
        <h1 className="font-serif text-4xl font-semibold mt-2">Dagvraag</h1>
        <p className="text-muted-foreground mt-2">
          Stel een vraag of prompt in die elke dag automatisch aan Gemini wordt
          gesteld. Je krijgt een melding, en het volledige antwoord staat
          hieronder.
        </p>
      </header>

      {pushState !== "granted" && pushState !== "unsupported" && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
          <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="flex-1 text-sm text-muted-foreground">
            Zet meldingen aan om het dagelijkse antwoord op je telefoon te
            ontvangen.
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
      {pushState === "unsupported" && (
        <p className="text-xs text-muted-foreground px-1">
          Meldingen worden niet ondersteund in deze browser. Voeg de site toe
          aan je beginscherm om ze op je telefoon te kunnen gebruiken.
        </p>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
        <p className="font-serif text-lg font-semibold">Instellingen</p>
        {configLoading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <Textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              placeholder="Bijv. Geef een korte samenvatting van het belangrijkste wereldnieuws van vandaag."
              rows={3}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground shrink-0">Tijdstip</p>
              <select
                value={String(hourDraft).padStart(2, "0")}
                onChange={(e) => setHourDraft(Number(e.target.value))}
                className="text-xs bg-background/60 border border-border/40 rounded-md px-2 py-1.5 text-muted-foreground focus:outline-none"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">:</span>
              <select
                value={String(minuteDraft).padStart(2, "0")}
                onChange={(e) => setMinuteDraft(Number(e.target.value))}
                className="text-xs bg-background/60 border border-border/40 rounded-md px-2 py-1.5 text-muted-foreground focus:outline-none"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <Button
              onClick={() => saveConfig.mutate()}
              disabled={!promptDraft.trim() || saveConfig.isPending}
              className="rounded-xl w-full sm:w-auto"
            >
              {saveConfig.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" /> Opslaan
                </>
              )}
            </Button>
          </>
        )}
      </div>

      <div className="space-y-3">
        <p className="font-serif text-lg font-semibold">Eerdere antwoorden</p>
        {runsLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
            <Sparkles
              className="h-8 w-8 mx-auto text-muted-foreground"
              strokeWidth={1.4}
            />
            <p className="text-sm text-muted-foreground mt-3">
              Nog geen antwoorden — stel hierboven een prompt en tijdstip in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-2"
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {formatRunDate(run.run_date)}
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {run.response}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
